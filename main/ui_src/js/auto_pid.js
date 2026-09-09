// --- AUTO PID & VEHICLE PROFILE MANAGEMENT ---

let latest_car_models = null;

const pidEntryStyles = `
    .pid-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        margin-top: 0.5rem;
        border: 2px solid var(--gray-300);
        border-radius: 8px;
    }
    .header-right {
        display: flex;
        gap: 0.5rem;
    }
    .collapse-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0.25rem 0.5rem;
        color: var(--gray-700);
    }
    .pid-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        transition: height 0.3s ease;
    }
    .pid-content.hidden {
        display: none;
    }
`;

// Inject styles once on script evaluation
(function injectPidStyles() {
    const style = document.createElement('style');
    style.textContent = pidEntryStyles;
    document.head.appendChild(style);
})();

function toggleCarModel() {
    const carSpecificEl = document.getElementById("car_specific");
    const carModelSelect = document.getElementById("car_model");
    if (!carSpecificEl || !carModelSelect) return;

    const carSpecific = carSpecificEl.value;
    carModelSelect.disabled = (carSpecific === "disable");

    if (typeof toggleDiscovery === "function") {
        toggleDiscovery();
    }
}

function toggleStandardPIDOptions() {
    const standardPidsSelect = document.getElementById("standard_pids");
    const ecuProtocolSelect = document.getElementById("ecu_protocol");
    const availablePidsSelect = document.getElementById("available_pids");
    const scanPidButton = document.getElementById("scan_pids_button");

    const isEnabled = standardPidsSelect.value === "enable";
    ecuProtocolSelect.disabled = !isEnabled;
    availablePidsSelect.disabled = !isEnabled;
    scanPidButton.disabled = !isEnabled;
}

function toggleDestinationAndCycle() {
    const grouping = document.getElementById("grouping").value;
    const destinationField = document.getElementById("destination");
    const cycleField = document.getElementById("group_cycle");
    const groupDestTypeFeild = document.getElementById("group_dest_type");

    if (grouping === "enable") {
        destinationField.disabled = false;
        cycleField.disabled = false;
        groupDestTypeFeild.disabled = false;
    } else {
        destinationField.disabled = true;
        cycleField.disabled = true;
        groupDestTypeFeild.disabled = true;
    }
}

function toggleDiscovery() {
    const discovery = document.getElementById("ha_discovery");
    if (discovery) {
        discovery.disabled = true;
        discovery.value = "disable";
    }
}

function toggleSendToFields() {
    const groupingValue = document.getElementById("grouping")?.value || 'disable';
    const table = document.getElementById("automate_table");
    if (!table) return;

    const rows = table.getElementsByClassName('pid-entry');
    if (!rows.length) return;

    Array.from(rows).forEach(row => {
        const sendToInput = row.querySelector('.send-to-input');
        if (sendToInput) {
            sendToInput.disabled = (groupingValue === "Group ALL");
        }
    });
}

function enableAutoStoreButton() {
    const storeButton = document.querySelector('button.store');
    if (storeButton) {
        storeButton.disabled = false;
    }
    const customStore = document.getElementById("custom_pid_store");
    if (customStore) {
        customStore.disabled = false;
    }
}

function addRowAutoTable() {
    addCollapsibleRow();
    enableAutoStoreButton();
}

function loadCarModels(data) {
    const carModelSelect = document.getElementById("car_model");
    if (data && Array.isArray(data.supported)) {
        carModelSelect.innerHTML = "";
        data.supported.forEach(model => {
            const option = document.createElement("option");
            option.value = model;
            option.text = model;
            carModelSelect.appendChild(option);
        });
    } else {
        console.error("Invalid data format or missing 'supported' property.");
    }
    toggleCarModel();
    toggleDestinationAndCycle();
    toggleSendToFields();
    toggleStandardPIDOptions();
}

async function fetchVehicleProfiles() {
    try {
        if (!navigator.onLine) {
            throw new Error('No internet connection');
        }

        const response = await fetch('https://raw.githubusercontent.com/meatpiHQ/wican-fw/main/vehicle_profiles.json');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        latest_car_models = data;
        const carModels = ["Not Selected"];
        if (data && Array.isArray(data.cars)) {
            data.cars.forEach(car => {
                if (car.car_model) {
                    carModels.push(car.car_model);
                }
            });
        }
        loadCarModels({ "supported": carModels });
        enableAutoStoreButton();
    } catch (error) {
        console.error('Problem fetching vehicle profiles:', error);
        showNotification("Unable to fetch vehicle_profiles.json. " + error.message, "red");
    }
}

function loadLocalCarModels() {
    const fileInput = document.getElementById("car_data_file");
    if (!fileInput || fileInput.files.length === 0) {
        showNotification("No files selected!", "red");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (event) {
        try {
            const jsonData = JSON.parse(event.target.result);
            let data;

            if (jsonData.car_model && jsonData.pids) {
                showNotification("Single car format detected. Fetching parameter definitions...", "blue");
                try {
                    const paramsResponse = await fetch('https://raw.githubusercontent.com/meatpiHQ/wican-fw/refs/heads/main/.vehicle_profiles/params.json');
                    const paramsData = await paramsResponse.json();
                    const convertedCar = convertSingleCarFormat(jsonData, paramsData);
                    data = { cars: [convertedCar] };
                    showNotification("Single car format converted successfully!", "green");
                } catch (fetchError) {
                    console.warn('Failed to fetch params.json, using basic conversion:', fetchError);
                    data = { cars: [convertSingleCarBasic(jsonData)] };
                    showNotification("Car model loaded (basic format - no internet connection)", "yellow");
                }
            } else {
                data = jsonData.car_model ? { cars: [jsonData] } : jsonData;
            }

            latest_car_models = data;
            const carModels = ["Not Selected"];
            if (data && Array.isArray(data.cars)) {
                data.cars.forEach(car => {
                    if (car.car_model) {
                        carModels.push(car.car_model);
                    }
                });
            }

            loadCarModels({ "supported": carModels });
            enableAutoStoreButton();

            if (!jsonData.car_model || !jsonData.pids) {
                showNotification("Car models loaded successfully!", "green");
            }
        } catch (e) {
            showNotification("Invalid JSON file!", "red");
            console.error('JSON parse error:', e);
        }
    };
    reader.readAsText(file);
}

async function scanAvailablePIDs() {
    const scanButton = document.querySelector('#scan_pids_button');
    const addButton = document.querySelector('#add_pid_button');

    try {
        scanButton.disabled = true;
        scanButton.textContent = "Scanning...";
        addButton.disabled = true;

        const ecuProtocol = document.getElementById('ecu_protocol').value;
        const response = await fetch(`/scan_available_pids?protocol=${ecuProtocol}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const pidSelect = document.getElementById('available_pids');
        pidSelect.innerHTML = '';
        if (data.text) {
            showNotification(data.text, "red");
        } else if (data.std_pids && Array.isArray(data.std_pids) && data.std_pids.length > 0) {
            data.std_pids.forEach(pid => {
                const option = document.createElement('option');
                option.value = pid;
                option.textContent = pid;
                pidSelect.appendChild(option);
            });
            addButton.disabled = false;
            showNotification("PID scan complete", "green");
        } else {
            showNotification("No PIDs found. Try a different protocol or check if ignition is ON", "orange");
        }
    } catch (error) {
        console.error('PID scan error:', error);
        showNotification("PID scan failed: " + error.message, "red");
    } finally {
        scanButton.disabled = false;
        scanButton.textContent = "Scan PIDs";
    }
}

function addCollapsibleRow(rowData = {}) {
    const container = document.querySelector('.pid-entries');
    if (!container) return;

    const entry = document.createElement('div');
    entry.className = 'pid-entry';

    entry.innerHTML = `
        <div class="pid-header">
            <div class="header-left">
                <button type="button" class="collapse-btn">▼</button>
                <span class="pid-title">New PID</span>
            </div>
            <div class="header-right">
                <button type="button" class="delete-btn">Delete</button>
            </div>
        </div>
        <div class="pid-content hidden">
            <table class="compact-form-table">
                <tr>
                    <td>Name:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
                    <td><input type="text" class="name-input" value="${rowData.Name || ''}" placeholder="Parameter Name"></td>
                </tr>
                <tr>
                    <td>Init:</td>
                    <td><input type="text" class="init-input" value="${rowData.Init || ''}" placeholder="PID Init"></td>
                </tr>
                <tr>
                    <td>PID:</td>
                    <td><input type="text" class="pid-input" value="${rowData.PID || ''}" placeholder="PID"></td>
                </tr>
                <tr>
                    <td>Expression:</td>
                    <td><input type="text" class="expression-input" value="${rowData.Expression || ''}" placeholder="Enter expression"></td>
                </tr>
                <tr>
                    <td>Min Value:</td>
                    <td><input type="number" class="min-value-input" value="${rowData.MinValue || ''}" step="0.01" placeholder="Minimum value"></td>
                </tr>
                <tr>
                    <td>Max Value:</td>
                    <td><input type="number" class="max-value-input" value="${rowData.MaxValue || ''}" step="0.01" placeholder="Maximum value"></td>
                </tr>
                <tr>
                    <td>Period(ms):</td>
                    <td><input type="number" class="period-input" value="${rowData.Period || ''}" placeholder="ms"></td>
                </tr>
                <tr>
                    <td>Destination Type:</td>
                    <td><select class="type-select">
                        <option value="Default" ${rowData.Type === 'Default' ? 'selected' : ''}>Default</option>
                        <option value="MQTT_Topic" ${rowData.Type === 'MQTT_Topic' ? 'selected' : ''}>MQTT_Topic</option>
                        <option value="MQTT_WallBox" ${rowData.Type === 'MQTT_WallBox' ? 'selected' : ''}>MQTT_WallBox</option>
                    </select></td>
                </tr>
                <tr>
                    <td>Send_to:</td>
                    <td><input type="text" class="send-to-input" value="${rowData.Send_to || ''}" placeholder="Enter destination"></td>
                </tr>
            </table>
        </div>
    `;

    const header = entry.querySelector('.pid-header');
    const deleteBtn = entry.querySelector('.delete-btn');
    const collapseBtn = entry.querySelector('.collapse-btn');
    const content = entry.querySelector('.pid-content');
    const parameterTitle = entry.querySelector('.pid-title');
    const nameInput = entry.querySelector('.name-input');
    const pidInput = entry.querySelector('.pid-input');

    deleteBtn.addEventListener('click', () => {
        entry.remove();
        enableAutoStoreButton();
    });

    const toggleCollapse = (e) => {
        e.stopPropagation();
        const isHidden = content.style.display === 'none' || getComputedStyle(content).display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        collapseBtn.textContent = isHidden ? '▲' : '▼';
    };

    header.addEventListener('click', toggleCollapse);
    collapseBtn.addEventListener('click', toggleCollapse);

    parameterTitle.textContent = rowData.Name ? rowData.Name : 'New PID';
    const updateTitle = () => {
        parameterTitle.textContent = `${nameInput.value || 'New Parameter'}`;
    };

    nameInput.addEventListener('input', updateTitle);
    pidInput.addEventListener('input', updateTitle);

    entry.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('input', enableAutoStoreButton);
    });

    container.appendChild(entry);
}

function addSelectedPID(rowData = {}) {
    const pidSelect = document.getElementById('available_pids');
    const selectedPID = rowData.Name || (pidSelect ? pidSelect.value : '');

    if (!selectedPID) return;

    const container = document.querySelector('.std-pid-entries');
    if (!container) return;

    const entry = document.createElement('div');
    entry.className = 'std-pid-entry';

    entry.innerHTML = `
        <div class="pid-header">
            <div class="header-left">
                <button type="button" class="collapse-btn">▼</button>
                <span class="pid-title">${selectedPID}</span>
            </div>
            <div class="header-right">
                <button type="button" class="delete-btn">Delete</button>
            </div>
        </div>
        <div class="pid-content" style="display: none;">
            <table class="compact-form-table">
                <tr>
                    <td>Name:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
                    <td><input type="text" class="name-input" value="${selectedPID}" readonly></td>
                </tr>
                <tr>
                    <td>Receive Header:</td>
                    <td><input type="text" class="receive-header-input" value="${rowData.ReceiveHeader || ''}" placeholder="Optional Receive Header" maxlength="8"></td>
                </tr>
                <tr>
                    <td>Period(ms):</td>
                    <td><input type="number" class="period-input" value="${rowData.Period || '1000'}" min="100" max="120000"></td>
                </tr>
                <tr>
                    <td>Destination Type:</td>
                    <td><select class="type-select">
                        <option value="Default" ${rowData.Type === 'Default' ? 'selected' : ''}>Default</option>
                        <option value="MQTT_Topic" ${rowData.Type === 'MQTT_Topic' ? 'selected' : ''}>MQTT_Topic</option>
                        <option value="MQTT_WallBox" ${rowData.Type === 'MQTT_WallBox' ? 'selected' : ''}>MQTT_WallBox</option>
                    </select></td>
                </tr>
                <tr>
                    <td>Destination:</td>
                    <td><input type="text" class="send-to-input" value="${rowData.Send_to || ''}" placeholder="Enter destination"></td>
                </tr>
            </table>
        </div>
    `;

    const header = entry.querySelector('.pid-header');
    const deleteBtn = entry.querySelector('.delete-btn');
    const collapseBtn = entry.querySelector('.collapse-btn');
    const content = entry.querySelector('.pid-content');

    deleteBtn.addEventListener('click', () => {
        entry.remove();
        enableAutoStoreButton();
    });

    const toggleCollapse = (e) => {
        e.stopPropagation();
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        collapseBtn.textContent = isHidden ? '▲' : '▼';
    };

    header.addEventListener('click', toggleCollapse);
    collapseBtn.addEventListener('click', toggleCollapse);

    entry.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('input', enableAutoStoreButton);
    });

    container.appendChild(entry);
    enableAutoStoreButton();
}

function addCarParameter(rowData = {}) {
    if (!rowData.name) return;

    const container = document.querySelector('.specific-pid-entries');
    if (!container) return;

    const entry = document.createElement('div');
    entry.className = 'specific-pid-entry';

    entry.innerHTML = `
        <div class="pid-header">
            <div class="header-left">
                <button type="button" class="collapse-btn">▼</button>
                <span class="pid-title">${rowData.name}</span>
            </div>
            <div class="header-right">
                <button type="button" class="delete-btn">Delete</button>
            </div>
        </div>
        <div class="pid-content" style="display: none;">
            <table class="compact-form-table">
                <tr>
                    <td>Name:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
                    <td><input type="text" class="name-input" value="${rowData.name}"></td>
                </tr>
                <tr>
                    <td>PID:</td>
                    <td><input type="text" class="pid-input" value="${rowData.pid || ''}" placeholder="PID"></td>
                </tr>
                <tr>
                    <td>PID Init:</td>
                    <td><input type="text" class="pid-init-input" value="${rowData.pid_init || ''}" placeholder="Init"></td>
                </tr>
                <tr>
                    <td>Expression:</td>
                    <td><input type="text" class="expression-input" value="${rowData.expression || ''}" placeholder="Expression"></td>
                </tr>
                <tr>
                    <td>Unit:</td>
                    <td><input type="text" class="unit-input" value="${rowData.unit || ''}" placeholder="Unit"></td>
                </tr>
                <tr>
                    <td>Class:</td>
                    <td><input type="text" class="class-input" value="${rowData.class || ''}" placeholder="Class"></td>
                </tr>
                <tr>
                    <td>Min Value:</td>
                    <td><input type="number" class="min-input" value="${rowData.min || ''}" step="0.01" placeholder="Min"></td>
                </tr>
                <tr>
                    <td>Max Value:</td>
                    <td><input type="number" class="max-input" value="${rowData.max || ''}" step="0.01" placeholder="Max"></td>
                </tr>
                <tr>
                    <td>Period(ms):</td>
                    <td><input type="number" class="period-input" value="${rowData.period || '5000'}" min="100" max="60000"></td>
                </tr>
                <tr>
                    <td>Destination Type:</td>
                    <td><select class="type-select">
                        <option value="Default" ${rowData.type === 'Default' ? 'selected' : ''}>Default</option>
                        <option value="MQTT_Topic" ${rowData.type === 'MQTT_Topic' ? 'selected' : ''}>MQTT_Topic</option>
                        <option value="MQTT_WallBox" ${rowData.type === 'MQTT_WallBox' ? 'selected' : ''}>MQTT_WallBox</option>
                    </select></td>
                </tr>
                <tr>
                    <td>Destination:</td>
                    <td><input type="text" class="send-to-input" value="${rowData.send_to || ''}" placeholder="Destination"></td>
                </tr>
            </table>
        </div>
    `;

    const header = entry.querySelector('.pid-header');
    const deleteBtn = entry.querySelector('.delete-btn');
    const collapseBtn = entry.querySelector('.collapse-btn');
    const content = entry.querySelector('.pid-content');

    deleteBtn.addEventListener('click', () => {
        entry.remove();
        enableAutoStoreButton();
    });

    const toggleCollapse = (e) => {
        e.stopPropagation();
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        collapseBtn.textContent = isHidden ? '▲' : '▼';
    };

    header.addEventListener('click', toggleCollapse);
    collapseBtn.addEventListener('click', toggleCollapse);

    entry.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('input', enableAutoStoreButton);
    });

    container.appendChild(entry);
    enableAutoStoreButton();
}

function loadautoPIDCarData() {
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        if (this.responseText !== "NONE") {
            const obj = JSON.parse(this.responseText);
            const carModels = [];
            if (obj && Array.isArray(obj.cars)) {
                obj.cars.forEach(car => {
                    if (car.car_model) {
                        carModels.push(car.car_model);
                    }
                    if (car.pids) {
                        const specInit = document.getElementById("specific_init");
                        if (specInit) specInit.value = car.init;
                        car.pids.forEach(pid => {
                            if (pid.parameters) {
                                pid.parameters.forEach(param => {
                                    addCarParameter({
                                        name: param.name,
                                        expression: param.expression,
                                        unit: param.unit,
                                        class: param.class,
                                        period: param.period,
                                        type: param.type,
                                        min: param.min,
                                        max: param.max,
                                        send_to: param.send_to,
                                        pid: pid.pid,
                                        pid_init: pid.pid_init
                                    });
                                });
                            }
                        });
                    }
                });
            }
            loadCarModels({ "supported": carModels });
        } else {
            toggleCarModel();
            toggleDestinationAndCycle();
            toggleSendToFields();
            toggleStandardPIDOptions();
        }
    };
    xhttp.open("GET", "/load_auto_pid_car_data");
    xhttp.send();
}

function loadautoPID() {
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        if (this.responseText !== "NONE") {
            const data = JSON.parse(this.responseText);
            loadAutoTable(data);
            const customStore = document.getElementById("custom_pid_store");
            if (customStore) customStore.disabled = true;
        }
    };
    xhttp.onerror = function (error) {
        console.error("Error loading auto PID:", error);
    };
    xhttp.open("GET", "/load_auto_pid");
    xhttp.send();
}

function loadAutoTable(jsonData) {
    try {
        const data = jsonData;

        const initialisationElement = document.getElementById("initialisation");
        if (initialisationElement) {
            initialisationElement.value = data.initialisation || '';
        }

        const automateTable = document.getElementById("automate_table");
        if (!automateTable) {
            console.error("Automate table not found");
            return;
        }

        const setElementValue = (id, value, defaultValue = '') => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value || defaultValue;
            }
        };

        setElementValue("car_specific", data.car_specific, 'disable');
        setElementValue("webhook_data_mode", data.webhook_data_mode, 'full');
        setElementValue("ha_discovery", 'disable');
        setElementValue("grouping", data.grouping, 'disable');
        setElementValue("autopid_polling", data.autopid_polling, 'enable');
        setElementValue("group_cycle", data.cycle, '5000');
        setElementValue("destination", data.destination, '');
        setElementValue("car_model", data.car_model, '');
        setElementValue("standard_pids", data.standard_pids, 'disable');
        setElementValue("ecu_protocol", data.ecu_protocol, '6');
        setElementValue("group_dest_type", data.group_dest_type, 'Default');

        if (data.pids && Array.isArray(data.pids)) {
            data.pids.forEach((pidData) => {
                addCollapsibleRow({
                    Name: pidData.Name || '',
                    Init: pidData.Init || '',
                    PID: pidData.PID || '',
                    Expression: pidData.Expression || '',
                    MinValue: pidData.MinValue || '',
                    MaxValue: pidData.MaxValue || '',
                    Period: pidData.Period || '',
                    Type: pidData.Type || 'Default',
                    Send_to: pidData.Send_to || ''
                });
            });
        }

        if (data.std_pids && Array.isArray(data.std_pids)) {
            data.std_pids.forEach((pidData) => {
                addSelectedPID({
                    Name: pidData.Name || '',
                    ReceiveHeader: pidData.ReceiveHeader || '',
                    Period: pidData.Period || '',
                    Type: pidData.Type || 'Default',
                    Send_to: pidData.Send_to || ''
                });
            });
        }

        requestAnimationFrame(() => {
            try {
                ["car_specific", "grouping", "group_dest_type", "ecu_protocol", "standard_pids"].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.dispatchEvent(new Event('change'));
                });

                if (typeof toggleCarModel === 'function') toggleCarModel();
                if (typeof toggleDestinationAndCycle === 'function') toggleDestinationAndCycle();
                if (typeof toggleSendToFields === 'function') toggleSendToFields();
                if (typeof toggleStandardPIDOptions === 'function') toggleStandardPIDOptions();
            } catch (error) {
                console.error('Error in UI updates:', error);
            }
        });
    } catch (error) {
        console.error('Error in loadAutoTable:', error);
        showNotification("Error loading table data: " + error.message, "red");
    }
}

async function storeAutoTableData() {
    try {
        const custom_pid_data = [];
        const std_pid_data = [];

        const entries = document.querySelectorAll('.pid-entry');
        const standardEntries = document.querySelectorAll('.std-pid-entry');

        const initialisationValue = document.getElementById("initialisation")?.value || '';
        const groupingValue = document.getElementById("grouping")?.value || 'disable';
        const autopid_pollingValue = document.getElementById("autopid_polling")?.value || 'enable';
        const groupDestTypeValue = document.getElementById("group_dest_type")?.value || 'Default';
        const ha_discoveryValue = document.getElementById("ha_discovery")?.value || 'disable';
        const webhookDataModeValue = document.getElementById("webhook_data_mode")?.value || 'full';
        const destinationValue = document.getElementById("destination")?.value || '';
        const cycleField = document.getElementById("group_cycle");
        const cycleValue = cycleField?.value || '5000';
        const carSpecificValue = document.getElementById("car_specific")?.value || 'disable';
        const carModelField = document.getElementById("car_model");
        const standard_pidsValue = document.getElementById("standard_pids")?.value || 'disable';
        const ecu_protocolValue = document.getElementById("ecu_protocol")?.value || '6';
        const carModelValue = carModelField?.value || '';

        if (carSpecificValue === "enable" && (!carModelValue || carModelValue.length === 0 || carModelValue === "Not Selected")) {
            throw new Error("Car model must be selected");
        }

        let carData = {
            car_model: carModelValue,
            init: document.getElementById("specific_init")?.value || '',
            pids: []
        };

        const specificPidEntries = document.querySelectorAll('.specific-pid-entry');
        if (specificPidEntries.length > 0) {
            carData.pids = Array.from(specificPidEntries).map(entry => {
                return {
                    pid: entry.querySelector('.pid-input').value,
                    pid_init: entry.querySelector('.pid-init-input').value,
                    parameters: [{
                        name: entry.querySelector('.name-input').value,
                        expression: entry.querySelector('.expression-input').value,
                        unit: entry.querySelector('.unit-input').value,
                        class: entry.querySelector('.class-input').value,
                        period: entry.querySelector('.period-input').value,
                        min: entry.querySelector('.min-input').value,
                        max: entry.querySelector('.max-input').value,
                        type: entry.querySelector('.type-select').value,
                        send_to: entry.querySelector('.send-to-input').value
                    }]
                };
            });
        }

        if (carSpecificValue === "enable") {
            await fetch('/store_car_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cars: [carData] })
            }).then(response => response.text())
                .catch(error => console.error('Error:', error));
        }

        if (cycleField && !cycleField.disabled && (!/^\d+$/.test(cycleValue) || parseInt(cycleValue) < 1000)) {
            showNotification("Cycle must be a number greater than 1000", "red");
            return false;
        }

        if (entries?.length) {
            entries.forEach(entry => {
                const pidData = {
                    Name: entry.querySelector('.name-input')?.value || '',
                    Init: entry.querySelector('.init-input')?.value || '',
                    PID: entry.querySelector('.pid-input')?.value || '',
                    Expression: entry.querySelector('.expression-input')?.value || '',
                    MinValue: entry.querySelector('.min-value-input')?.value || '',
                    MaxValue: entry.querySelector('.max-value-input')?.value || '',
                    Period: entry.querySelector('.period-input')?.value || '',
                    Type: entry.querySelector('.type-select')?.value || 'Default',
                    Send_to: entry.querySelector('.send-to-input')?.value || ''
                };

                if (!pidData.Name.trim() && !pidData.PID.trim() && !pidData.Expression.trim()) {
                    return;
                }

                if (pidData.Name.length === 0 || pidData.Name.length >= 32) {
                    throw new Error("Name must not be empty and must be less than 32 characters");
                }
                if (pidData.PID.length === 0 || pidData.PID.length >= 10) {
                    throw new Error("PID must not be empty and must be less than 10 characters");
                }
                if (pidData.Expression.length === 0 || pidData.Expression.length >= 64) {
                    throw new Error("Expression must not be empty and must be less than 64 characters");
                }
                if (!/^\d+$/.test(pidData.Period) || (parseInt(pidData.Period) < 100 && parseInt(pidData.Period) !== 0)) {
                    throw new Error("Period must be a number greater than 100");
                }
                if (pidData.Send_to.length >= 64) {
                    throw new Error("Send_to must be less than 64 characters");
                }
                custom_pid_data.push(pidData);
            });
        }

        if (standardEntries?.length) {
            standardEntries.forEach(entry => {
                const stdPIDData = {
                    Name: entry.querySelector('.name-input')?.value || '',
                    ReceiveHeader: entry.querySelector('.receive-header-input')?.value || '',
                    Period: entry.querySelector('.period-input')?.value || '',
                    Type: entry.querySelector('.type-select')?.value || 'Default',
                    Send_to: entry.querySelector('.send-to-input')?.value || ''
                };

                if (!stdPIDData.Name.trim() && !stdPIDData.ReceiveHeader.trim()) {
                    return;
                }

                if (stdPIDData.Name.length === 0 || stdPIDData.Name.length >= 32) {
                    throw new Error("Name must not be empty and must be less than 32 characters");
                }
                if (!/^\d+$/.test(stdPIDData.Period) || (parseInt(stdPIDData.Period) < 1000 && parseInt(stdPIDData.Period) !== 0)) {
                    throw new Error("Period must be a number greater than 1000");
                }
                if (stdPIDData.Send_to.length >= 64) {
                    throw new Error("Send_to must be less than 64 characters");
                }
                std_pid_data.push(stdPIDData);
            });
        }

        const jsonData = {
            initialisation: initialisationValue,
            webhook_data_mode: webhookDataModeValue,
            grouping: groupingValue,
            autopid_polling: autopid_pollingValue,
            group_dest_type: groupDestTypeValue,
            destination: destinationValue,
            cycle: cycleValue,
            car_specific: carSpecificValue,
            ha_discovery: ha_discoveryValue,
            car_model: carModelValue,
            pids: custom_pid_data,
            std_pids: std_pid_data,
            standard_pids: standard_pidsValue,
            ecu_protocol: ecu_protocolValue
        };

        const webhookUrlEl = document.getElementById("webhook_url");
        const webhookIntervalEl = document.getElementById("webhook_interval");
        const webhookEnEl = document.getElementById("webhook_en");
        if (webhookUrlEl) {
            const wUrl = webhookUrlEl.value.trim();
            const wEn = webhookEnEl ? (webhookEnEl.value === "enable") : true;
            const wInt = webhookIntervalEl ? parseInt(webhookIntervalEl.value, 10) : 60;
            if (wUrl && (wUrl.startsWith("http://") || wUrl.startsWith("https://"))) {
                await fetch('/api/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: wUrl,
                        enabled: wEn,
                        interval: isNaN(wInt) || wInt < 1 ? 60 : wInt
                    })
                }).catch(e => console.warn('Webhook save failed', e));
            } else if (!wUrl && !wEn) {
                await fetch('/api/webhook', { method: 'DELETE' }).catch(() => { });
            }
        }

        const response = await fetch('store_auto_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonData)
        });

        if (response.ok) {
            showNotification("Settings saved successfully", "green");
            const storeBtn = document.querySelector(".store");
            if (storeBtn) storeBtn.disabled = true;
            const customStore = document.getElementById("custom_pid_store");
            if (customStore) customStore.disabled = true;
            return true;
        } else {
            throw new Error("Server returned status " + response.status);
        }
    } catch (error) {
        showNotification(error.message, "red");
        return false;
    }
}