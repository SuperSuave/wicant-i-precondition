(function () {
    function resolveSafeUrl(url) {
        if (typeof url !== 'string') return url;
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('ws://') || url.startsWith('wss://') || url.startsWith('data:')) {
            return url;
        }
        const clean = url.startsWith('/') ? url : ('/' + url);
        if (window.location.protocol === 'blob:' || window.location.protocol === 'file:' || !window.location.host) {
            const base = (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http'))
                ? window.location.origin
                : 'https://wican.local';
            return base + clean;
        }
        return clean;
    }

    const origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        const safe = resolveSafeUrl(url);
        return origXhrOpen.call(this, method, safe, ...rest);
    };

    const origFetch = window.fetch;
    window.fetch = function (input, init) {
        if (typeof input === 'string') {
            input = resolveSafeUrl(input);
        }
        return origFetch.call(this, input, init);
    };
})();

window._canDoIsDirty = false;
window._suppressCanDoDirty = false;
window.markCanDoDirty = function () {
    window._canDoIsDirty = true;
    const fab = document.getElementById("can_do_anchored_save_fab");
    if (fab) {
        fab.style.display = "inline-flex";
        fab.classList.add("dirty");
    }
    return "dirty";
};
window.clearCanDoDirty = function () {
    window._canDoIsDirty = false;
    const fab = document.getElementById("can_do_anchored_save_fab");
    if (fab) {
        fab.classList.remove("dirty");
    }
    return "cleared";
};
document.addEventListener('DOMContentLoaded', async (event) => {
    const submitBtn = document.getElementById("submit_button");
    if (submitBtn) submitBtn.disabled = true;

    if (typeof fetchDeviceTime === "function") fetchDeviceTime();
    if (typeof loadCanDoCatalog === "function") {
        try {
            await loadCanDoCatalog();
        } catch (e) {
            console.error("Failed to load catalog on init:", e);
        }
    }

    if (typeof loadCanDoRulesUI === "function") {
        loadCanDoRulesUI();
    }
});
let latest_car_models = null;
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

// 1. UPDATED: Toast Snackbar System (No full backgrounds)
function showNotification(message, color = "blue", duration = 4000) {
    const notification = document.getElementById("notification");
    if (!notification) return;
    const colorMap = { red: "#ef4444", green: "#10b981", blue: "#3b82f6", yellow: "#f59e0b" };
    notification.style.setProperty('--toast-accent', colorMap[color] || colorMap.blue);
    notification.innerHTML = message;
    notification.classList.remove("show");
    void notification.offsetWidth;
    notification.classList.add("show");
    notification.onclick = () => notification.classList.remove("show");
    if (window.notificationTimeout) clearTimeout(window.notificationTimeout);
    window.notificationTimeout = setTimeout(() => { notification.classList.remove("show"); }, duration);
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
        console.log(data);
        latest_car_models = data;
        const carModels = [];
        carModels.push("Not Selected");
        if (data && Array.isArray(data.cars)) {
            data.cars.forEach(car => {
                if (car.car_model) {
                    carModels.push(car.car_model);
                }
            });
        }
        console.log(carModels);
        var mod = { "supported": carModels };
        loadCarModels(mod);
        enableAutoStoreButton();

    } catch (error) {
        console.error('There was a problem with the fetch operation:', error);
        showNotification("Unable to fetch vehicle_profiles.json. " + error.message, "red");
    }
}

function toggleCarModel() {
    const carSpecific = document.getElementById("car_specific").value;
    const carModelSelect = document.getElementById("car_model");
    if (carSpecific === "disable") {
        carModelSelect.disabled = true;
    } else {
        carModelSelect.disabled = false;
    }
    toggleDiscovery();
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
    const carSpecific = document.getElementById("car_specific").value;
    const discovery = document.getElementById("ha_discovery");

    discovery.disabled = true;
    discovery.value = "disable";
}

function txCheckBoxChanged() {
    if (document.getElementById("mqtt_tx_en_checkbox").checked) {
        document.getElementById("mqtt_tx_topic").disabled = false;
    } else {
        document.getElementById("mqtt_tx_topic").disabled = true;
    }
}

function rxCheckBoxChanged() {
    if (document.getElementById("mqtt_rx_en_checkbox").checked) {
        document.getElementById("mqtt_rx_topic").disabled = false;
    } else {
        document.getElementById("mqtt_rx_topic").disabled = true;
    }
}

function loadLocalCarModels() {
    const fileInput = document.getElementById("car_data_file");

    if (fileInput.files.length == 0) {
        showNotification("No files selected!", "red");
        return;
    }

    const file = fileInput.files[0];

    const reader = new FileReader();
    reader.onload = async function (event) {
        try {
            const jsonData = JSON.parse(event.target.result);
            let data;

            // Check if it's a single car format (like Zeekr) with car_model property
            if (jsonData.car_model && jsonData.pids) {
                showNotification("Single car format detected. Fetching parameter definitions...", "blue");

                try {
                    // Fetch params.json to get parameter definitions
                    const paramsResponse = await fetch('https://raw.githubusercontent.com/meatpiHQ/wican-fw/refs/heads/main/.vehicle_profiles/params.json');
                    const paramsData = await paramsResponse.json();

                    // Convert single car format to vehicle_profiles.json format
                    const convertedCar = convertSingleCarFormat(jsonData, paramsData);
                    data = { cars: [convertedCar] };

                    showNotification("Single car format converted successfully!", "green");
                } catch (fetchError) {
                    console.warn('Failed to fetch params.json, using basic conversion:', fetchError);
                    // Fallback: basic conversion without parameter enrichment
                    data = { cars: [convertSingleCarBasic(jsonData)] };
                    showNotification("Car model loaded (basic format - no internet connection)", "yellow");
                }
            } else {
                // Existing multi-car format
                data = jsonData.car_model ? { cars: [jsonData] } : jsonData;
            }

            latest_car_models = data;
            const carModels = [];
            carModels.push("Not Selected");

            if (data && Array.isArray(data.cars)) {
                data.cars.forEach(car => {
                    if (car.car_model) {
                        carModels.push(car.car_model);
                    }
                });
            }

            console.log(carModels);
            var mod = { "supported": carModels };
            loadCarModels(mod);
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

function addRowAutoTable() {
    addCollapsibleRow();
    enableAutoStoreButton();
}
async function scanAvailablePIDs() {
    const scanButton = document.querySelector('#scan_pids_button');
    const addButton = document.querySelector('#add_pid_button');

    try {
        // Reset states at start
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
        console.error('Error:', error);
        showNotification("PID scan failed: " + error.message, "red");
    } finally {
        // Always reset button state
        scanButton.disabled = false;
        scanButton.textContent = "Scan PIDs";
    }
}
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
function addCollapsibleRow(rowData = {}) {
    const container = document.querySelector('.pid-entries');
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
                            <td><input type="text" class="name-input" value="${rowData.Name || ''}" 
                                placeholder="Parameter Name"></td>
                        </tr>
                        <tr>
                            <td>Init:</td>
                            <td><input type="text" class="init-input" value="${rowData.Init || ''}" 
                                placeholder="PID Init"></td>
                        </tr>
                        <tr>
                            <td>PID:</td>
                            <td><input type="text" class="pid-input" value="${rowData.PID || ''}" 
                                placeholder="PID"></td>
                        </tr>
                        <tr>
                            <td>Expression:</td>
                            <td><input type="text" class="expression-input" value="${rowData.Expression || ''}" 
                                placeholder="Enter expression"></td>
                        </tr>
                        <tr>
                            <td>Min Value:</td>
                            <td><input type="number" class="min-value-input" value="${rowData.MinValue || ''}" 
                                step="0.01" placeholder="Minimum value"></td>
                        </tr>
                        <tr>
                            <td>Max Value:</td>
                            <td><input type="number" class="max-value-input" value="${rowData.MaxValue || ''}" 
                                step="0.01" placeholder="Maximum value"></td>
                        </tr>
                        <tr>
                            <td>Period(ms):</td>
                            <td><input type="number" class="period-input" value="${rowData.Period || ''}" 
                                placeholder="ms"></td>
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
                            <td><input type="text" class="send-to-input" value="${rowData.Send_to || ''}"
                                placeholder="Enter destination"></td>
                        </tr>
                    </table>
                </div>
                `;
    console.log("addCollapsibleRow:", rowData);
    console.log("Send_to value:", rowData.Send_to);
    // Add these CSS styles
    const style = document.createElement('style');
    style.textContent = pidEntryStyles;
    document.head.appendChild(style);
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
    const selectedPID = rowData.Name || pidSelect.value;

    if (selectedPID) {
        const container = document.querySelector('.std-pid-entries');
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
                                <td><input type="text" class="receive-header-input" value="${rowData.ReceiveHeader || ''}" 
                                    placeholder="Optional Receive Header" maxlength="8"></td>
                            </tr>
                            <tr>
                                <td>Period(ms):</td>
                                <td><input type="number" class="period-input" value="${rowData.Period || '1000'}" 
                                    min="100" max="120000"></td>
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
                                <td><input type="text" class="send-to-input" value="${rowData.Send_to || ''}" 
                                    placeholder="Enter destination"></td>
                            </tr>
                        </table>
                    </div>
                `;


        const style = document.createElement('style');
        style.textContent = pidEntryStyles;
        document.head.appendChild(style);
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
}

function addCarParameter(rowData = {}) {
    if (rowData.name) {
        const container = document.querySelector('.specific-pid-entries');
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
                                <td><input type="text" class="send-to-input" value="${rowData.send_to || ''}" 
                                    placeholder="Destination"></td>
                            </tr>
                        </table>
                    </div>
                `;



        const style = document.createElement('style');
        style.textContent = pidEntryStyles;
        document.head.appendChild(style);
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
}

// Update the loadAutoTable function to work with the new structure
function loadAutoTable(jsonData) {
    try {
        console.log("Raw jsonData:", jsonData);
        const data = jsonData;

        // First set the initialisation value
        const initialisationElement = document.getElementById("initialisation");
        if (initialisationElement) {
            initialisationElement.value = data.initialisation || '';
        }

        // Clear existing content
        const automateTable = document.getElementById("automate_table");
        if (!automateTable) {
            console.error("Automate table not found");
            return;
        }

        // Set form values safely
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
            data.pids.forEach((pidData, index) => {
                console.log(`Loading PID ${index}:`, pidData);
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
            data.std_pids.forEach((pidData, index) => {
                console.log(`Loading Standard PID ${index}:`, pidData);
                addSelectedPID({
                    Name: pidData.Name || '',
                    ReceiveHeader: pidData.ReceiveHeader || '',
                    Period: pidData.Period || '',
                    Type: pidData.Type || 'Default',
                    Send_to: pidData.Send_to || ''
                });
            });
        }

        // Update UI states after elements are created
        requestAnimationFrame(() => {
            try {
                const carSpecificElement = document.getElementById("car_specific");
                if (carSpecificElement) {
                    carSpecificElement.dispatchEvent(new Event('change'));
                }

                const groupingElement = document.getElementById("grouping");
                if (groupingElement) {
                    groupingElement.dispatchEvent(new Event('change'));
                }

                const groupDestTypeElement = document.getElementById("group_dest_type");
                if (groupDestTypeElement) {
                    groupDestTypeElement.dispatchEvent(new Event('change'));
                }

                const ecuProtocolElement = document.getElementById("ecu_protocol");
                if (ecuProtocolElement) {
                    ecuProtocolElement.dispatchEvent(new Event('change'));
                }

                const standardPidsElement = document.getElementById("standard_pids");
                if (standardPidsElement) {
                    standardPidsElement.dispatchEvent(new Event('change'));
                }

                if (typeof toggleCarModel === 'function') toggleCarModel();
                if (typeof toggleDestinationAndCycle === 'function') toggleDestinationAndCycle();
                if (typeof toggleSendToFields === 'function') toggleSendToFields();
                if (typeof toggleStandardPIDOptions === 'function') toggleStandardPIDOptions();
            } catch (error) {
                console.error('Error in UI updates:', error);
            }
        });
        console.log("loadAutoTable completed successfully");

    } catch (error) {
        console.error('Error in loadAutoTable:', error);
        showNotification("Error loading table data: " + error.message, "red");
    }
}

function showTrackPopup() {
    const textInput = document.getElementById("track_popup_text");
    const popupButton = document.getElementById("track_popup_button");
    if (textInput.value.length === 0) {
        showNotification("Enter track popup text", "red");
        return;
    }

    const xhttp = new XMLHttpRequest();
    popupButton.disabled = true;
    xhttp.onload = function () {
        popupButton.disabled = false;
        if (this.status >= 200 && this.status < 300) {
            showNotification(this.responseText, "green");
        } else {
            showNotification(this.responseText || "Failed to show track popup", "red");
        }
    };
    xhttp.onerror = function () {
        popupButton.disabled = false;
        showNotification("Failed to show track popup", "red");
    };
    xhttp.open("POST", "/track_popup");
    xhttp.setRequestHeader("Content-Type", "text/plain; charset=UTF-8");
    xhttp.send(textInput.value);
}

function enableAutoStoreButton() {
    const storeButton = document.querySelector('button.store');
    if (storeButton) {
        storeButton.disabled = false;
    }
    document.getElementById("custom_pid_store").disabled = false;
}

async function storeAutoTableData() {
    try {
        // Get all PID entries with null checks
        const custom_pid_data = [];
        const std_pid_data = [];

        // Get entries with null checks
        const entries = document.querySelectorAll('.pid-entry');
        const standardEntries = document.querySelectorAll('.std-pid-entry');

        // Get form values with null checks
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
        if (carSpecificValue == "enable" && (!carModelValue || carModelValue.length === 0 || carModelValue === "Not Selected")) {
            throw new Error("Car model must be selected");
        }

        let carData = {
            car_model: carModelValue,
            init: document.getElementById("specific_init").value,
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

        // Only send car data if car_specific is enabled
        if (carSpecificValue === "enable") {
            await fetch('/store_car_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cars: [carData] })
            }).then(response => response.text())
                .then(data => console.log('Success:', data))
                .catch(error => console.error('Error:', error));
        }



        if (!cycleField.disabled && (!/^\d+$/.test(cycleValue) || parseInt(cycleValue) < 1000)) {
            showNotification("Cycle must be a number greater than 1000", "red");
            return false;
        }

        // Process each PID entry
        if (entries?.length) {
            entries.forEach((entry, index) => {
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

                // Skip completely empty / unconfigured rows
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
                if (!/^\d+$/.test(pidData.Period) || (parseInt(pidData.Period) < 100 && parseInt(pidData.Period) != 0)) {
                    throw new Error("Period must be a number greater than 100");
                }
                if (pidData.Send_to.length >= 64) {
                    throw new Error("Send_to must be less than 64 characters");
                }
                custom_pid_data.push(pidData);
            });
        }

        if (standardEntries?.length) {
            standardEntries.forEach((entry, index) => {
                const stdPIDData = {
                    Name: entry.querySelector('.name-input')?.value || '',
                    ReceiveHeader: entry.querySelector('.receive-header-input')?.value || '',
                    Period: entry.querySelector('.period-input')?.value || '',
                    Type: entry.querySelector('.type-select')?.value || 'Default',
                    Send_to: entry.querySelector('.send-to-input')?.value || ''
                };

                // Skip completely empty / unconfigured rows
                if (!stdPIDData.Name.trim() && !stdPIDData.ReceiveHeader.trim()) {
                    return;
                }

                if (stdPIDData.Name.length === 0 || stdPIDData.Name.length >= 32) {
                    throw new Error("Name must not be empty and must be less than 32 characters");
                }
                if (!/^\d+$/.test(stdPIDData.Period) || (parseInt(stdPIDData.Period) < 1000 && parseInt(stdPIDData.Period) != 0)) {
                    throw new Error("Period must be a number greater than 1000");
                }
                if (stdPIDData.Send_to.length >= 64) {
                    throw new Error("Send_to must be less than 64 characters");
                }
                std_pid_data.push(stdPIDData);
            });
        }

        // Prepare data object for sending
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

        // Save WebHook configuration if present
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

        // Send to server
        await fetch('store_auto_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jsonData)
        })
            .then(response => response.text())
            .then(result => {
                showNotification("Settings saved successfully", "green");
                document.querySelector(".store").disabled = true;
                document.getElementById("custom_pid_store").disabled = true;
            })
            .catch(error => {
                showNotification("Error saving settings: " + error.message, "red");
                return false;
            });

        return true;

    } catch (error) {
        showNotification(error.message, "red");
        return false;
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

var canData = [];

function toggleSidebarDrawer() {
    const sidebar = document.getElementById("main_sidebar");
    const backdrop = document.getElementById("sidebar_backdrop");
    if (!sidebar) return;
    const isOpen = sidebar.classList.contains("drawer-open");
    if (isOpen) {
        closeSidebarDrawer();
    } else {
        sidebar.classList.add("drawer-open");
        if (backdrop) backdrop.classList.add("active");
    }
}

function closeSidebarDrawer() {
    const sidebar = document.getElementById("main_sidebar");
    const backdrop = document.getElementById("sidebar_backdrop");
    if (sidebar) sidebar.classList.remove("drawer-open");
    if (backdrop) backdrop.classList.remove("active");
}

function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.style.display = "block";
    }

    if (evt && evt.currentTarget) {
        evt.currentTarget.className += " active";
    } else {
        const btn = document.querySelector(`.tablinks[onclick*="'${tabName}'"]`);
        if (btn) btn.className += " active";
    }

    const mobileTitle = document.getElementById("mobile_tab_name");
    if (mobileTitle) {
        const activeBtn = document.querySelector(`.tablinks[onclick*="'${tabName}'"] b`);
        if (activeBtn) mobileTitle.textContent = activeBtn.textContent;
    }

    // Automatically close drawer on mobile upon navigating
    if (window.innerWidth <= 768) {
        closeSidebarDrawer();
    }

    const submitBtn = document.getElementById("submit_button");
    if (submitBtn) {
        const configTabs = ["autopid_tab", "connectivity_tab", "can_hardware_tab", "system_tab"];
        submitBtn.style.display = configTabs.includes(tabName) ? "inline-block" : "none";
    }

    const canDoFab = document.getElementById("can_do_anchored_save_fab");
    if (canDoFab) {
        canDoFab.style.display = (tabName === "automate") ? "inline-flex" : "none";
    }

    try {
        localStorage.setItem("wican_active_tab", tabName);
        if (window.history && window.history.replaceState) {
            history.replaceState(null, null, "#" + tabName);
        }
    } catch (e) { }

    // Reset scroll position to top
    window.scrollTo(0, 0);
    const contentDiv = document.querySelector(".content");
    if (contentDiv) contentDiv.scrollTop = 0;
}

// --- MULTI-NETWORK STA CONFIG HELPERS ---
function renderStaNetworksList(networks) {
    const container = document.getElementById("sta_networks_container");
    if (!container) return;
    container.innerHTML = "";
    let list = (networks && Array.isArray(networks) && networks.length > 0) ? networks : [];
    if (list.length === 0) {
        const s = document.getElementById("ssid_value")?.value || "";
        const p = document.getElementById("pass_value")?.value || "";
        const sec = document.getElementById("sta_security")?.value || "wpa3";
        if (s) {
            list.push({ ssid: s, pass: p, security: sec });
        } else {
            list.push({ ssid: "MeatPi", pass: "TomatoSauce", security: "wpa3" });
        }
    }
    list.forEach((net, idx) => {
        renderStaNetworkItem(container, net, idx + 1);
    });
    updateStaNetworksUI();
}

function renderStaNetworkItem(container, data = {}, priority = 1) {
    const div = document.createElement("div");
    div.className = "sta-net-card";

    div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="sta-net-title">
                            Priority <span class="sta-net-priority">${priority}</span>:
                        </span>
                        <div style="display: flex; align-items: center; gap: 0.3rem;">
                            <button type="button" class="system-button can-do-btn-move" onclick="moveStaNetworkItem(this, -1)" title="Increase Priority">▲</button>
                            <button type="button" class="system-button can-do-btn-move" onclick="moveStaNetworkItem(this, 1)" title="Decrease Priority">▼</button>
                            <button type="button" class="delete-btn" onclick="removeStaNetworkItem(this)" title="Remove Network"><svg style="width:14px;height:14px;fill:currentColor;"><use href="#icon-trash"/></svg></button>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 90px; gap: 0.5rem; align-items: center;">
                        <div>
                            <label>SSID:</label>
                            <input type="text" class="sta-net-ssid" value="${data.ssid || ''}" placeholder="Wi-Fi SSID" oninput="updateLegacyStaFields()">
                        </div>
                        <div>
                            <label>Password:</label>
                            <div class="sta-net-pass-wrap">
                                <input type="password" class="sta-net-pass" value="${data.pass || ''}" placeholder="Password" oninput="updateLegacyStaFields()">
                                <button type="button" class="sta-net-toggle-pass" onclick="togglePassVisibility(this)" title="Toggle Password">Show</button>
                            </div>
                        </div>
                        <div>
                            <label>Security:</label>
                            <select class="sta-net-sec" onchange="updateLegacyStaFields()">
                                <option value="wpa3" ${data.security === 'wpa3' ? 'selected' : ''}>WPA3</option>
                                <option value="wpa2" ${data.security === 'wpa2' ? 'selected' : ''}>WPA2</option>
                            </select>
                        </div>
                    </div>
                `;
    container.appendChild(div);
    updateStaNetworksUI();
}

function addStaNetworkRow() {
    const container = document.getElementById("sta_networks_container");
    if (!container) return;
    const currentCount = container.querySelectorAll(".sta-net-card").length;
    if (currentCount >= 5) {
        showNotification("Maximum of 5 Wi-Fi networks supported", "yellow", 3000);
        return;
    }
    renderStaNetworkItem(container, { ssid: "", pass: "", security: "wpa3" }, currentCount + 1);
    updateLegacyStaFields();
}

function removeStaNetworkItem(btn) {
    const card = btn.closest(".sta-net-card");
    if (!card) return;
    const container = card.parentElement;
    card.remove();
    renumberStaNetworks(container);
    updateLegacyStaFields();
}

function moveStaNetworkItem(btn, dir) {
    const card = btn.closest(".sta-net-card");
    if (!card) return;
    const container = card.parentElement;
    const cards = Array.from(container.querySelectorAll(".sta-net-card"));
    const idx = cards.indexOf(card);
    if (idx === -1) return;

    if (dir === -1 && idx > 0) {
        container.insertBefore(card, cards[idx - 1]);
    } else if (dir === 1 && idx < cards.length - 1) {
        container.insertBefore(card, cards[idx + 1].nextElementSibling);
    }
    renumberStaNetworks(container);
    updateLegacyStaFields();
}

function renumberStaNetworks(container) {
    if (!container) return;
    container.querySelectorAll(".sta-net-card").forEach((card, idx) => {
        const p = card.querySelector(".sta-net-priority");
        if (p) p.textContent = idx + 1;
    });
    updateStaNetworksUI();
}

function togglePassVisibility(btn) {
    const input = btn.parentElement.querySelector("input");
    if (!input) return;
    input.type = (input.type === "password") ? "text" : "password";
}

function getStaNetworksData() {
    const container = document.getElementById("sta_networks_container");
    if (!container) return [];
    const list = [];
    container.querySelectorAll(".sta-net-card").forEach(card => {
        const ssid = card.querySelector(".sta-net-ssid")?.value.trim() || "";
        const pass = card.querySelector(".sta-net-pass")?.value || "";
        const sec = card.querySelector(".sta-net-sec")?.value || "wpa3";
        if (ssid) {
            list.push({ ssid: ssid, pass: pass, security: sec });
        }
    });
    return list;
}

function updateLegacyStaFields() {
    const nets = getStaNetworksData();
    const first = nets[0] || { ssid: "", pass: "", security: "wpa3" };
    const s = document.getElementById("ssid_value");
    const p = document.getElementById("pass_value");
    const sec = document.getElementById("sta_security");
    if (s) s.value = first.ssid;
    if (p) p.value = first.pass;
    if (sec) sec.value = first.security;
}

function updateStaNetworksUI() {
    const container = document.getElementById("sta_networks_container");
    const addBtn = document.getElementById("btn_add_wifi_net");
    if (addBtn) addBtn.disabled = false;
    if (container) {
        container.querySelectorAll("input, select, button").forEach(el => {
            el.disabled = false;
        });
    }
}

// 4. UPDATED: submit_enable (Reading Checkboxes instead of selectedIndex)
function submit_enable() {
    const isAp = (document.getElementById("wifi_mode").value == "AP");
    const ssidEl = document.getElementById("ssid_value"), passEl = document.getElementById("pass_value"), secEl = document.getElementById("sta_security");
    if (ssidEl) ssidEl.disabled = isAp;
    if (passEl) passEl.disabled = isAp;
    if (secEl) secEl.disabled = isAp;

    const bleEl = document.getElementById("ble_status");
    if (isAp) {
        bleEl.disabled = false;
        document.getElementById("ap_auto_disable").disabled = true;
    } else {
        bleEl.disabled = true;
        bleEl.checked = false;
    }
    if (typeof updateStaNetworksUI === "function") updateStaNetworksUI();

    if (!bleEl.checked) {
        const warn = document.getElementById("ble_warning_div");
        if (warn) warn.style.display = "block";
        const mqttEl = document.getElementById("mqtt_en");
        if (mqttEl) { mqttEl.checked = false; mqttEl.disabled = true; }
        const mqttDiv = document.getElementById("mqtt_en_div");
        if (mqttDiv) mqttDiv.style.display = "none";
    } else {
        const warn = document.getElementById("ble_warning_div");
        if (warn) warn.style.display = "none";
        const mqttEl = document.getElementById("mqtt_en");
        if (mqttEl) mqttEl.disabled = false;
    }

    // Un-disable save button
    document.getElementById("submit_button").disabled = false;
}
function initAppTheme() {
    let savedTheme = "system";
    try {
        savedTheme = localStorage.getItem("wican_theme") || "system";
    } catch (e) { }

    const sidebarSel = document.getElementById("theme_select");
    const systemSel = document.getElementById("system_theme_select");
    if (sidebarSel) sidebarSel.value = savedTheme;
    if (systemSel) systemSel.value = savedTheme;

    applyAppTheme(savedTheme);
}

function setAppTheme(theme) {
    try {
        localStorage.setItem("wican_theme", theme);
    } catch (e) { }

    const sidebarSel = document.getElementById("theme_select");
    const systemSel = document.getElementById("system_theme_select");
    if (sidebarSel) sidebarSel.value = theme;
    if (systemSel) systemSel.value = theme;

    applyAppTheme(theme);
}

function applyAppTheme(theme) {
    if (theme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
    } else if (theme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
    } else {
        const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (isDark) {
            document.documentElement.setAttribute("data-theme", "dark");
        } else {
            document.documentElement.setAttribute("data-theme", "light");
        }
    }
}

initAppTheme();

// Listen for OS system theme changes if in system mode
if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        let current = "system";
        try {
            current = localStorage.getItem("wican_theme") || "system";
        } catch (e) { }
        if (current === "system") {
            applyAppTheme("system");
        }
    });
}

function initActiveTab() {
    let savedTab = null;
    try {
        savedTab = localStorage.getItem("wican_active_tab");
    } catch (e) { }

    if (window.location.hash) {
        const hashTab = window.location.hash.substring(1);
        if (document.getElementById(hashTab)) {
            savedTab = hashTab;
        }
    }

    // Map legacy tab names to new tabs if someone loads a cached tab name
    if (savedTab === "status_view") savedTab = "dashboard_tab";
    if (savedTab === "wifi_settings") savedTab = "connectivity_tab";
    if (savedTab === "power_saving_tab" || savedTab === "about_tab") savedTab = "system_tab";

    if (savedTab && document.getElementById(savedTab)) {
        openTab(null, savedTab);
    } else {
        const defaultBtn = document.getElementById("defaultOpen");
        if (defaultBtn) defaultBtn.click();
    }
}
initActiveTab();
(function () {
    const canDoFab = document.getElementById("can_do_anchored_save_fab");
    const autoTab = document.getElementById("automate");
    if (canDoFab) {
        const isAutoActive = autoTab && (autoTab.style.display === "block");
        canDoFab.style.display = isAutoActive ? "inline-flex" : "none";
    }
})();

function formatAge(ageMs) {
    const seconds = Math.max(0, Math.round(ageMs / 1000));
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
}

// ==========================================================================
// CAN STATE MONITOR WIDGET & PAYLOAD PATTERN MATCHING
// ==========================================================================

function escapeHtml(str) {
    return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseCanDoPattern(patternStr) {
    if (!patternStr || typeof patternStr !== "string") return [];
    return patternStr.trim().split(/\s+/).map(tok => {
        if (tok === '*') return { type: 'any' };
        if (tok.startsWith('!')) {
            return { type: 'not', value: parseInt(tok.slice(1), 16) };
        }
        if (tok.endsWith('*')) {
            return { type: 'nibble_hi', value: parseInt(tok[0], 16) };
        }
        if (tok.startsWith('*')) {
            return { type: 'nibble_lo', value: parseInt(tok[1], 16) };
        }
        return { type: 'eq', value: parseInt(tok, 16) };
    });
}

function matchCanDoPayload(hexData, tokens) {
    if (!hexData || !tokens || tokens.length === 0) return false;
    if (hexData.length < tokens.length * 2) return false;
    for (let i = 0; i < tokens.length; i++) {
        const byteStr = hexData.slice(i * 2, i * 2 + 2);
        const byteVal = parseInt(byteStr, 16);
        if (isNaN(byteVal)) return false;
        const tok = tokens[i];
        if (tok.type === 'any') continue;
        if (tok.type === 'eq' && byteVal !== tok.value) return false;
        if (tok.type === 'not' && byteVal === tok.value) return false;
        if (tok.type === 'nibble_hi' && (byteVal >> 4) !== tok.value) return false;
        if (tok.type === 'nibble_lo' && (byteVal & 0x0F) !== tok.value) return false;
    }
    return true;
}

function getCanDoMonitorableItems() {
    const items = [];
    if (!CAN_DO_CATALOG || !Array.isArray(CAN_DO_CATALOG.commands)) return items;

    CAN_DO_CATALOG.commands.forEach(cmd => {
        if (!cmd || !cmd.can_id) return;

        // Only include commands with trigger or condition roles
        const roles = cmd.roles || [];
        if (roles.length > 0 && !roles.includes("trigger") && !roles.includes("condition")) {
            return;
        }

        const matchPattern = cmd.match_payload || cmd.to_payload || cmd.from_payload;
        const hasOptions = Array.isArray(cmd.options) && cmd.options.some(o => o.match_payload || o.payload || o.to_payload || o.from_payload);

        if (matchPattern || hasOptions) {
            items.push({
                id: cmd.id || cmd.name,
                name: cmd.name,
                category: cmd.category || "General",
                can_id: cmd.can_id,
                match_payload: matchPattern,
                options: cmd.options
            });
        }
    });

    if (typeof getCustomCondPresets === "function") {
        const custom = getCustomCondPresets();
        if (Array.isArray(custom)) {
            custom.forEach((cp, idx) => {
                if (cp && cp.can_id) {
                    items.push({
                        id: `custom_cond_${idx}`,
                        name: cp.name || `Custom Condition #${idx + 1}`,
                        category: "My Saved Conditions",
                        can_id: cp.can_id,
                        match_payload: cp.match_payload,
                        options: cp.options
                    });
                }
            });
        }
    }

    return items;
}
window._canDoStateCache = {};


// ==========================================================================
// DYNAMIC WIDGET DASHBOARD SYSTEM
// ==========================================================================
window._dashEditMode = false;
window._lastStatusObj = null;

// 3. UPDATED: Dynamic Dashboard Catalog (SVG Icons & Status Dots)
const DASH_WIDGET_CATALOG = {
    batt_12v: {
        id: "batt_12v", name: "12V Auxiliary Battery", icon: "", category: "Power",
        render: function (isEditMode) {
            return `<div class="dash-card-header"><span class="dash-card-title"><svg class="icon"><use href="#icon-battery-12v"/></svg> 12V Aux Battery</span>
                                    <div class="dash-card-actions"><div id="dash_batt_status_badge" class="dash-status"><span class="status-dot green"></span> Healthy</div></div></div>
                                    <div><div class="dash-metric-row"><span id="dash_batt_voltage_val" class="dash-metric-val">--.- V</span></div>
                                    <div class="dash-progress-track" style="margin-bottom: 0.6rem; height: 4px;"><div id="dash_batt_gauge" class="dash-progress-fill dash-gauge-level-good" style="width: 75%;"></div></div>
                                    <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.4rem;"><span>Low (12.0V)</span><span>Normal (12.6V)</span><span>Charging</span></div></div>`;
        },
        update: function (obj) {
            const el = document.getElementById("dash_batt_voltage_val"), bad = document.getElementById("dash_batt_status_badge");
            if (!obj || !obj.batt_voltage) return;
            if (el) el.textContent = obj.batt_voltage;
            const v = parseFloat(obj.batt_voltage);
            if (!isNaN(v) && bad) {
                bad.innerHTML = (v >= 13.5) ? '<span class="status-dot blue"></span> Charging' : (v >= 12.4) ? '<span class="status-dot green"></span> Healthy' : '<span class="status-dot red"></span> Low';
            }
        }
    },
    hv_battery: {
        id: "hv_battery", name: "HV Traction Battery", icon: "", category: "EV Battery",
        render: function (isEditMode) {
            return `<div class="dash-card-header"><span class="dash-card-title"><svg class="icon"><use href="#icon-battery-hv"/></svg> HV Traction Battery</span>
                                    <div class="dash-card-actions"><div id="dash_hv_state_badge" class="dash-status"><span class="status-dot blue"></span> Active</div></div></div>
                                    <div><div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 0.2rem;"><span id="dash_hv_temp_val" class="dash-metric-val">--.-°C</span><span id="dash_hv_temp_unit_label" class="dash-metric-label">Cell Temp</span></div>
                                    <div id="dash_hv_subtext" class="dash-subtext" style="margin-bottom: 0.6rem;">Waiting for CAN bus telemetry...</div>
                                    <div style="padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.08); margin-bottom: 0.4rem;"><div style="display: flex; align-items: baseline; gap: 6px;"><span id="dash_hv_soc_val" class="dash-metric-val" style="font-size: 1.5rem;">--%</span><span class="dash-metric-label">State of Charge</span></div></div></div>`;
        },
        update: function (obj) {
            // Update this inside your existing logic
            const hvBadgeEl = document.getElementById("dash_hv_state_badge");
            if (hvBadgeEl && obj && obj.battery_temp_valid) {
                const avgC = ((parseFloat(obj.battery_temp_min_c) + parseFloat(obj.battery_temp_max_c)) / 2);
                if (avgC >= 21) { hvBadgeEl.innerHTML = '<span class="status-dot green"></span> Optimal'; }
                else if (avgC >= 15) { hvBadgeEl.innerHTML = '<span class="status-dot blue"></span> Moderate'; }
                else { hvBadgeEl.innerHTML = '<span class="status-dot yellow"></span> Cold'; }
            }
        }
    },
    precon: {
        id: "precon", name: "EV Preconditioning", icon: "", category: "Quick Action",
        render: function (isEditMode) {
            return `<div class="dash-card-header"><span class="dash-card-title"><svg class="icon"><use href="#icon-radiator"/></svg> Preconditioning</span>
                                    <div class="dash-card-actions"><div id="dash_precon_badge" class="dash-status"><span class="status-dot gray"></span> Inactive</div></div></div>
                                    <div><div style="margin-bottom: 0.8rem;"><div class="settings-desc">Heats HV traction battery pack to optimal DC fast charging temperature.</div></div></div>
                                    <button type="button" id="dash_precon_toggle_btn" onclick="preconActivate()" class="dash-outline-btn" style="width: 100%;">Activate Preconditioning</button>`;
        },
        update: function (obj) {
            const preconBadge = document.getElementById("dash_precon_badge"), preconBtn = document.getElementById("dash_precon_toggle_btn");
            if (!obj) return;
            if (obj.precondition_active) {
                if (preconBadge) preconBadge.innerHTML = '<span class="status-dot green"></span> Heating';
                if (preconBtn) { preconBtn.textContent = "Stop Preconditioning"; preconBtn.style.color = "#ef4444"; preconBtn.style.borderColor = "#ef4444"; }
            } else {
                if (preconBadge) preconBadge.innerHTML = '<span class="status-dot gray"></span> Inactive';
                if (preconBtn) { preconBtn.textContent = "Activate Preconditioning"; preconBtn.style.color = ""; preconBtn.style.borderColor = ""; }
            }
        }
    },
    network: {
        id: "network", name: "Network & Wireless", icon: "", category: "System",
        render: function (isEditMode) {
            return `<div class="dash-card-header"><span class="dash-card-title"><svg class="icon"><use href="#icon-network"/></svg> Network</span>
                                    <div class="dash-card-actions"><div id="dash_net_badge" class="dash-status"><span class="status-dot blue"></span> AP Mode</div></div></div>
                                    <div><div class="dash-kv-list"><div class="dash-kv-row"><span class="dash-kv-label">Mode:</span><strong id="dash_wifi_mode_text" class="dash-kv-val">AP</strong></div>
                                    <div class="dash-kv-row"><span class="dash-kv-label">Station IP:</span><strong id="dash_sta_ip_text" class="dash-kv-val" style="font-family: monospace;">192.168.3.1</strong></div></div></div>
                                    <button type="button" onclick="openTab(event, 'connectivity_tab')" class="dash-outline-btn" style="width: 100%; border: none; background: rgba(255,255,255,0.04);">Configure Networks</button>`;
        },
        update: function (obj) { /* Existing network logic */ }
    }
    // Keep your existing can_hw, can_do, and device_clock widgets but update their render() strings to match this pattern.
};

const DEFAULT_DASH_WIDGETS = ["batt_12v", "hv_battery", "precon", "can_do", "network", "can_hw"];

function getWatchedCanDoSignals(instanceId) {
    try {
        const store = JSON.parse(localStorage.getItem("wican_state_widgets") || "{}");
        return store[instanceId] || [];
    } catch (e) { return []; }
}

function saveWatchedCanDoSignals(instanceId, list) {
    try {
        const store = JSON.parse(localStorage.getItem("wican_state_widgets") || "{}");
        store[instanceId] = list;
        localStorage.setItem("wican_state_widgets", JSON.stringify(store));
        if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
    } catch (e) { }
}

function getCanDoActionButtons(instanceId) {
    try {
        const store = JSON.parse(localStorage.getItem("wican_dash_can_do_buttons") || "{}");
        return store[instanceId] || [];
    } catch (e) { return []; }
}

function saveCanDoActionButtons(instanceId, list) {
    try {
        const store = JSON.parse(localStorage.getItem("wican_dash_can_do_buttons") || "{}");
        store[instanceId] = list;
        localStorage.setItem("wican_dash_can_do_buttons", JSON.stringify(store));
        if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
    } catch (e) { }
}

function getAvailableCanDoRulesList() {
    if (Array.isArray(window._cachedCanDoRules) && window._cachedCanDoRules.length > 0) {
        return window._cachedCanDoRules.map((r, idx) => ({ id: `rule_${idx}`, name: r.name || `Rule #${idx + 1}`, data: r }));
    }
    const cards = document.querySelectorAll("#can_do_rules_container .can-do-rule-card");
    if (cards.length > 0) {
        const list = [];
        cards.forEach((c, idx) => {
            const rData = extractCanDoRuleData(c);
            if (rData) list.push({ id: `rule_${idx}`, name: rData.name || `Rule #${idx + 1}`, data: rData });
        });
        if (list.length > 0) return list;
    }
    return [{ id: "rule_0", name: "E-GMP Battery Preconditioning", data: getDefaultPreconditionRule() }];
}

async function executeDashboardCanDoButton(instanceId, idx, btn) {
    const list = getCanDoActionButtons(instanceId);
    const item = list[idx];
    if (!item) return;

    const rules = getAvailableCanDoRulesList();
    const matched = rules.find(r => r.id === item.ruleId || r.name === item.ruleName);
    const ruleData = matched ? matched.data : item.ruleData;

    if (!ruleData) {
        showNotification("Rule configuration not found. Please re-configure button.", "yellow", 3000);
        return;
    }

    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<span>Executing...</span>`;
    btn.disabled = true;

    try {
        const res = await fetch("/test_can_do_rule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ruleData)
        });
        if (!res.ok) throw new Error("Status " + res.status);
        btn.innerHTML = `<span>Done!</span>`;
        btn.style.background = "var(--m3-tonal-act-color)";
        showNotification(`Executed "${item.customLabel || item.ruleName}" successfully!`, "green", 3000);
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.background = "";
            btn.disabled = false;
        }, 1800);
    } catch (err) {
        btn.innerHTML = `<span>Failed</span>`;
        btn.style.background = "var(--md-sys-color-error)";
        showNotification(`Execution failed: ${err.message || err}`, "red", 3500);
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.background = "";
            btn.disabled = false;
        }, 2000);
    }
}

function addDashboardCanDoButton(instanceId, btnElem) {
    const card = btnElem.closest(".dash-card");
    if (!card) return;
    const select = card.querySelector(".dash-can-do-rule-select");
    const iconInput = card.querySelector(".dash-can-do-btn-icon");
    const labelInput = card.querySelector(".dash-can-do-btn-label");

    const ruleId = select ? select.value : "";
    if (!ruleId) {
        showNotification("Please select a CAN Do automation rule", "yellow", 2500);
        return;
    }

    const rules = getAvailableCanDoRulesList();
    const chosen = rules.find(r => r.id === ruleId);
    const ruleName = chosen ? chosen.name : ruleId;
    const customLabel = labelInput ? labelInput.value.trim() : "";
    const icon = (iconInput && iconInput.value.trim()) ? iconInput.value.trim() : "";

    const list = getCanDoActionButtons(instanceId);
    list.unshift({ ruleId: ruleId, ruleName: ruleName, customLabel: customLabel, icon: icon, ruleData: chosen ? chosen.data : null });
    saveCanDoActionButtons(instanceId, list);

    if (labelInput) labelInput.value = "";
    if (select) select.value = "";

    renderDashboardGrid();
    if (window._lastStatusObj) updateDashboardCards(window._lastStatusObj);
    showNotification(`Added button for "${customLabel || ruleName}"!`, "green", 2000);
}

function moveDashboardCanDoButton(instanceId, idx, dir) {
    const list = getCanDoActionButtons(instanceId);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const item = list.splice(idx, 1)[0];
    list.splice(targetIdx, 0, item);
    saveCanDoActionButtons(instanceId, list);
    renderDashboardGrid();
    if (window._lastStatusObj) updateDashboardCards(window._lastStatusObj);
}

function handleCanDoBtnDragStart(event, instanceId, idx) {
    event.dataTransfer.setData("text/plain", JSON.stringify({ instanceId: instanceId, idx: idx }));
    event.dataTransfer.effectAllowed = "move";
}

function handleCanDoBtnDrop(event, instanceId, targetIdx, elem) {
    event.preventDefault();
    if (elem) elem.style.opacity = "1";
    try {
        const data = JSON.parse(event.dataTransfer.getData("text/plain") || "{}");
        if (data.instanceId === instanceId && typeof data.idx === "number" && data.idx !== targetIdx) {
            const list = getCanDoActionButtons(instanceId);
            const item = list.splice(data.idx, 1)[0];
            list.splice(targetIdx, 0, item);
            saveCanDoActionButtons(instanceId, list);
            renderDashboardGrid();
            if (window._lastStatusObj) updateDashboardCards(window._lastStatusObj);
        }
    } catch (e) { }
}

function removeDashboardCanDoButton(instanceId, idx) {
    const list = getCanDoActionButtons(instanceId);
    if (idx >= 0 && idx < list.length) {
        list.splice(idx, 1);
        saveCanDoActionButtons(instanceId, list);
        renderDashboardGrid();
        if (window._lastStatusObj) updateDashboardCards(window._lastStatusObj);
    }
}

function addWatchedCanDoSignal(instanceId, btnElem) {
    const card = btnElem.closest(".dash-card");
    if (!card) return;
    const picker = card.querySelector(".can-do-signal-picker");
    const labelInput = card.querySelector(".can-do-signal-label");
    const catalogId = picker ? picker.value : "";
    const customLabel = labelInput ? labelInput.value.trim() : "";

    if (!catalogId) {
        showNotification("Please select a CAN signal to monitor", "yellow", 2500);
        return;
    }

    const list = getWatchedCanDoSignals(instanceId);
    list.unshift({ catalogId: catalogId, customLabel: customLabel });
    saveWatchedCanDoSignals(instanceId, list);

    if (labelInput) labelInput.value = "";
    if (picker) picker.value = "";

    renderDashboardGrid();
    if (window._lastStatusObj) updateDashboardCards(window._lastStatusObj);
    updateCanDoStateWidgets();
    showNotification("Added signal to monitor card!", "green", 2000);
}

function removeWatchedCanDoSignal(instanceId, signalIdx) {
    const list = getWatchedCanDoSignals(instanceId);
    if (signalIdx >= 0 && signalIdx < list.length) {
        list.splice(signalIdx, 1);
        saveWatchedCanDoSignals(instanceId, list);
        renderDashboardGrid();
        if (window._lastStatusObj) updateDashboardCards(window._lastStatusObj);
    }
}

function getWidgetDef(instanceId) {
    if (DASH_WIDGET_CATALOG[instanceId]) {
        return DASH_WIDGET_CATALOG[instanceId];
    }
    if (instanceId.startsWith("can_state_")) {
        return DASH_WIDGET_CATALOG.can_state_monitor;
    }
    if (instanceId.startsWith("can_do_btn_")) {
        return DASH_WIDGET_CATALOG.can_do_buttons;
    }
    return null;
}

function getDashboardWidgetLayout() {
    try {
        const saved = localStorage.getItem("wican_dash_widgets");
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Load backing stores for custom widgets
                const stateWidgets = JSON.parse(localStorage.getItem("wican_state_widgets") || "{}");
                const can_doButtons = JSON.parse(localStorage.getItem("wican_dash_can_do_buttons") || "{}");

                return parsed.filter(id => {
                    if (DASH_WIDGET_CATALOG[id]) return true;
                    if (id.startsWith("can_state_")) return stateWidgets.hasOwnProperty(id);
                    if (id.startsWith("can_do_btn_")) return can_doButtons.hasOwnProperty(id);
                    return false;
                });
            }
        }
    } catch (e) { }
    return [...DEFAULT_DASH_WIDGETS];
}

function saveDashboardWidgetLayout(layoutArray) {
    try {
        localStorage.setItem("wican_dash_widgets", JSON.stringify(layoutArray));
    } catch (e) { }
    renderDashboardGrid();
    if (window._lastStatusObj) {
        updateDashboardCards(window._lastStatusObj);
    }
}

function renderWidgetEditControlsHTML(widgetId, isEditMode) {
    if (!isEditMode) return "";
    return `
                    <div class="dash-widget-edit-bar">
                        <button type="button" class="dash-widget-btn" onclick="moveDashboardWidget('${widgetId}', -1)" title="Move Widget Left / Up">▲</button>
                        <button type="button" class="dash-widget-btn" onclick="moveDashboardWidget('${widgetId}', 1)" title="Move Widget Right / Down">▼</button>
                        <button type="button" class="dash-widget-btn dash-widget-del-btn" onclick="removeDashboardWidget('${widgetId}')" title="Hide this widget"><svg style="width:14px;height:14px;fill:currentColor;"><use href="#icon-trash"/></svg></button>
                    </div>`;
}

function toggleDashboardEditMode() {
    window._dashEditMode = !window._dashEditMode;
    const toolbar = document.getElementById("dash_edit_toolbar");
    const btn = document.getElementById("dash_edit_btn");
    if (toolbar) toolbar.style.display = window._dashEditMode ? "flex" : "none";
    if (btn) {
        btn.textContent = window._dashEditMode ? "✓ Done" : "Customize";
        btn.style.background = window._dashEditMode ? "var(--md-sys-color-primary)" : "";
        btn.style.color = window._dashEditMode ? "var(--md-sys-color-on-primary)" : "";
    }
    renderDashboardGrid();
    if (window._lastStatusObj) {
        updateDashboardCards(window._lastStatusObj);
    }
}

function moveDashboardWidget(widgetId, dir) {
    const layout = getDashboardWidgetLayout();
    const idx = layout.indexOf(widgetId);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= layout.length) return;
    layout.splice(idx, 1);
    layout.splice(newIdx, 0, widgetId);
    saveDashboardWidgetLayout(layout);
}


function removeDashboardWidget(instanceId) {
    const layout = getDashboardWidgetLayout();
    const filtered = layout.filter(id => id !== instanceId);
    if (filtered.length === 0) {
        showNotification("Cannot remove all widgets. At least 1 widget must remain.", "red", 3000);
        return;
    }

    let wasCustom = false;
    if (instanceId.startsWith("can_state_")) {
        wasCustom = true;
        try {
            const store = JSON.parse(localStorage.getItem("wican_state_widgets") || "{}");
            delete store[instanceId];
            localStorage.setItem("wican_state_widgets", JSON.stringify(store));
        } catch (e) { }
    }

    if (instanceId.startsWith("can_do_btn_")) {
        wasCustom = true;
        try {
            const store = JSON.parse(localStorage.getItem("wican_dash_can_do_buttons") || "{}");
            delete store[instanceId];
            localStorage.setItem("wican_dash_can_do_buttons", JSON.stringify(store));
        } catch (e) { }
    }

    saveDashboardWidgetLayout(filtered);
    if (wasCustom && typeof autoSaveCanDoRules === "function") {
        autoSaveCanDoRules();
    }
    showNotification("Removed widget card from dashboard", "blue", 2500);
}

function addDashboardWidget(widgetId) {
    if (!widgetId) return;
    const layout = getDashboardWidgetLayout();

    if (widgetId === "can_state_monitor" || widgetId.startsWith("can_state_")) {
        let nextIdx = 0;
        while (layout.includes(`can_state_${nextIdx}`)) nextIdx++;
        const newInstId = `can_state_${nextIdx}`;
        layout.push(newInstId);
        saveDashboardWidgetLayout(layout);
        if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
        showNotification("Added new CAN State Monitor card!", "green", 2500);
        return;
    }

    if (widgetId === "can_do_buttons" || widgetId.startsWith("can_do_btn_")) {
        let nextIdx = 0;
        while (layout.includes(`can_do_btn_${nextIdx}`)) nextIdx++;
        const newInstId = `can_do_btn_${nextIdx}`;
        layout.push(newInstId);
        saveDashboardWidgetLayout(layout);
        if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
        showNotification("Added new CAN Do Buttons card!", "green", 2500);
        return;
    }

    if (!layout.includes(widgetId) && DASH_WIDGET_CATALOG[widgetId]) {
        layout.push(widgetId);
        saveDashboardWidgetLayout(layout);
        showNotification(`Added widget: ${DASH_WIDGET_CATALOG[widgetId].name}!`, "green", 2500);
    }
}

function resetDashboardWidgets() {
    if (confirm("Reset dashboard back to the default 6-card layout?")) {
        localStorage.removeItem("wican_dash_widgets");
        renderDashboardGrid();
        if (window._lastStatusObj) updateDashboardCards(window._lastStatusObj);
        showNotification("Dashboard reset to default layout!", "green", 2500);
    }
}

function renderDashboardGrid() {
    const container = document.getElementById("dash_grid_container");
    if (!container) return;
    const layout = getDashboardWidgetLayout();
    container.innerHTML = "";

    layout.forEach(instanceId => {
        const w = getWidgetDef(instanceId);
        if (!w) return;
        const card = document.createElement("div");
        card.className = "dash-card";
        card.setAttribute("data-widget-id", instanceId);
        card.innerHTML = w.render(window._dashEditMode, instanceId);
        container.appendChild(card);
    });

    if (window._dashEditMode) {
        const inactiveWidgets = Object.keys(DASH_WIDGET_CATALOG).filter(id => id === "can_state_monitor" || id === "can_do_buttons" || !layout.includes(id));
        const addCard = document.createElement("div");
        addCard.className = "dash-add-widget-card";

        addCard.innerHTML = `
                        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-heading);">Add Widget to Dashboard</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); max-width: 280px;">Select an available widget from the catalog to add to your grid:</div>
                        <div style="display: flex; align-items: center; gap: 8px; width: 100%; max-width: 280px; margin-top: 4px;">
                            <select id="dash_new_widget_select" style="font-size: 0.82rem; padding: 6px 8px; font-weight: 600;">
                                ${inactiveWidgets.map(id => `<option value="${id}">${DASH_WIDGET_CATALOG[id].icon} ${DASH_WIDGET_CATALOG[id].name}</option>`).join("")}
                            </select>
                            <button type="button" class="system-button" onclick="addDashboardWidget(document.getElementById('dash_new_widget_select').value)" style="padding: 6px 14px; font-size: 0.82rem; font-weight: 700; cursor: pointer; white-space: nowrap;">Add</button>
                        </div>`;

        container.appendChild(addCard);
    }
}

function initDashboardWidgets() {
    renderDashboardGrid();
}
document.addEventListener("DOMContentLoaded", initDashboardWidgets);

function updateDashboardCards(obj) {
    if (!obj) return;
    window._lastStatusObj = obj;

    // Dispatch update to all active registered widgets
    const layout = getDashboardWidgetLayout();
    layout.forEach(widgetId => {
        const w = DASH_WIDGET_CATALOG[widgetId];
        if (w && typeof w.update === "function") {
            w.update(obj);
        }
    });

    // Profile pill & clock pill in header
    const profilePill = document.getElementById("dash_profile_pill");
    if (profilePill) {
        const modelSel = document.getElementById("can_do_vehicle_model");
        const trimSel = document.getElementById("can_do_vehicle_trim");
        const mText = modelSel?.selectedOptions[0]?.text || "All Gen5W";
        const tText = (trimSel && trimSel.value && trimSel.value !== "all_egmp" && trimSel.value !== modelSel?.value) ? ` (${trimSel.selectedOptions[0]?.text || ''})` : "";
        profilePill.textContent = `${mText}${tText}`;
    }
    const timePill = document.getElementById("dash_time_pill");
    const devTime = document.getElementById("device_time_display");
    if (timePill && devTime && devTime.textContent && devTime.textContent !== "--:--:--") {
        timePill.textContent = `${devTime.textContent}`;
    }
}

function updateCanDoStateWidgets() {
    const layout = getDashboardWidgetLayout();
    const monitorCards = layout.filter(id => id.startsWith("can_state_") || id === "can_state_monitor");
    if (monitorCards.length === 0) return;

    fetch("/api/can_states")
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (!data) return;
            const states = data.states || data;
            window._canDoStateCache = states;

            monitorCards.forEach(instanceId => {
                const ind = document.getElementById(`can_do_live_indicator_${instanceId}`);
                if (ind) {
                    ind.classList.remove("offline");
                }
            });

            const items = getCanDoMonitorableItems();

            monitorCards.forEach(instanceId => {
                const cardElem = document.querySelector(`.dash-card[data-widget-id="${instanceId}"]`);
                if (!cardElem) return;

                const watchedList = getWatchedCanDoSignals(instanceId);
                const rowElems = cardElem.querySelectorAll(".can-do-watched-container > .dash-kv-row");

                watchedList.forEach((w, idx) => {
                    const row = rowElems[idx];
                    if (!row) return;

                    const badgeEl = row.querySelector(".can-do-state-badge");
                    const ageEl = row.querySelector(".can-do-age-label");
                    const itemDef = items.find(i => i.id === w.catalogId);

                    if (!itemDef) {
                        if (badgeEl) { badgeEl.textContent = "Unknown"; badgeEl.className = "dash-badge badge-gray can-do-state-badge"; }
                        if (ageEl) ageEl.textContent = "Age: --";
                        return;
                    }

                    let stateObj = null;
                    if (itemDef.can_id) {
                        const parsed = parseInt(itemDef.can_id, 16);
                        if (!isNaN(parsed)) {
                            const normKey = "0x" + parsed.toString(16).toUpperCase();
                            stateObj = states[normKey] || states[normKey.toLowerCase()] || states[itemDef.can_id];
                        }
                    }
                    if (!stateObj) {
                        stateObj = states[itemDef.can_id] || states[itemDef.can_id?.toLowerCase()];
                    }

                    if (!stateObj) {
                        if (badgeEl) { badgeEl.textContent = "Waiting..."; badgeEl.className = "dash-badge badge-gray can-do-state-badge"; }
                        if (ageEl) ageEl.textContent = "Age: --";
                        return;
                    }

                    const ageMs = stateObj.age_ms || 0;
                    const ageSec = Math.round(ageMs / 1000);
                    const isStale = ageMs > 30000;
                    if (ageEl) {
                        ageEl.textContent = `Age: ${ageSec < 60 ? ageSec + 's' : Math.floor(ageSec / 60) + 'm'}${isStale ? ' (Idle)' : ''}`;
                        ageEl.style.color = isStale ? "var(--text-muted)" : "inherit";
                    }

                    const payloadHex = stateObj.data || stateObj.payload || "";

                    let activeOption = null;
                    if (itemDef.options && Array.isArray(itemDef.options)) {
                        activeOption = itemDef.options.find(opt => {
                            const pattern = opt.match_payload || opt.payload;
                            if (!pattern) return false;
                            const tokens = parseCanDoPattern(pattern);
                            return matchCanDoPayload(payloadHex, tokens);
                        });
                    }

                    if (activeOption) {
                        if (badgeEl) {
                            badgeEl.textContent = activeOption.label;
                            badgeEl.className = isStale ? "dash-badge badge-yellow can-do-state-badge" : "dash-badge badge-green can-do-state-badge";
                        }
                    } else if (itemDef.match_payload) {
                        const tokens = parseCanDoPattern(itemDef.match_payload);
                        const isMatch = matchCanDoPayload(payloadHex, tokens);
                        if (badgeEl) {
                            badgeEl.textContent = isMatch ? (isStale ? "Active (Idle)" : "Active") : "Inactive";
                            badgeEl.className = isMatch ? (isStale ? "dash-badge badge-yellow can-do-state-badge" : "dash-badge badge-green can-do-state-badge") : "dash-badge badge-gray can-do-state-badge";
                        }
                    } else {
                        if (badgeEl) {
                            badgeEl.textContent = isStale ? "Idle" : "Seen";
                            badgeEl.className = isStale ? "dash-badge badge-gray can-do-state-badge" : "dash-badge badge-blue can-do-state-badge";
                        }
                    }
                });
            });
        })
        .catch(() => {
            monitorCards.forEach(instanceId => {
                const ind = document.getElementById(`can_do_live_indicator_${instanceId}`);
                if (ind) {
                    ind.classList.add("offline");
                }
            });
        });
}

setInterval(() => {
    const dashTab = document.getElementById("dashboard_tab");
    if (dashTab && dashTab.style.display !== "none") {
        updateCanDoStateWidgets();
    }
}, 3000);

function checkStatus() {
    try {
        const xhttp = new XMLHttpRequest();
        xhttp.onload = function () {
            try {
                var obj = JSON.parse(this.responseText);
                if (obj.wifi_mode == "APStation") {
                    document.getElementById("wifi_mode_current").innerHTML = "AP+Station";
                } else if (obj.wifi_mode == "AP") {
                    document.getElementById("wifi_mode_current").innerHTML = "AP";
                }
                if (document.getElementById("sta_status")) document.getElementById("sta_status").innerHTML = obj.sta_status || "Connected";
                if (document.getElementById("ap_channel_status")) document.getElementById("ap_channel_status").innerHTML = obj.ap_ch || "6";
                if (document.getElementById("sta_ip")) document.getElementById("sta_ip").innerHTML = obj.sta_ip || "-";
                if (document.getElementById("mdns")) document.getElementById("mdns").innerHTML = obj.mdns || "-";
                if (document.getElementById("can_bitrate_status")) document.getElementById("can_bitrate_status").innerHTML = obj.can_datarate || "500K";
                if (obj.can_mode == "normal" && document.getElementById("can_mode_status")) {
                    document.getElementById("can_mode_status").innerHTML = "Normal";
                } else if (obj.can_mode == "silent" && document.getElementById("can_mode_status")) {
                    document.getElementById("can_mode_status").innerHTML = "Silent";
                }
                if (obj.can_bus_count && obj.can_bus_count > 1) {
                    document.querySelectorAll(".can1_row").forEach(row => row.style.display = "");
                    if (obj.can1_datarate && document.getElementById("can1_datarate")) {
                        document.getElementById("can1_datarate").value = obj.can1_datarate;
                    }
                    if (obj.can1_mode && document.getElementById("can1_mode")) {
                        document.getElementById("can1_mode").value = obj.can1_mode;
                    }
                    if (obj.can1_en && document.getElementById("can1_en")) {
                        document.getElementById("can1_en").value = obj.can1_en;
                    }
                    if (obj.can_fwd_mode && document.getElementById("can_fwd_mode")) {
                        document.getElementById("can_fwd_mode").value = obj.can_fwd_mode;
                    }
                }
                if (document.getElementById("port_type_status")) {
                    document.getElementById("port_type_status").innerHTML = (obj.port_type == "tcp") ? "TCP" : "UDP";
                }
                if (document.getElementById("battery_soc_status")) {
                    if (obj.battery_soc_valid) {
                        document.getElementById("battery_soc_status").textContent = `${obj.battery_soc_pct}%; (${formatAge(obj.battery_soc_age_ms)} ago)`;
                    } else {
                        document.getElementById("battery_soc_status").textContent = "Waiting for CAN data";
                    }
                }
                if (document.getElementById("battery_temp_status")) {
                    if (obj.battery_temp_valid) {
                        document.getElementById("battery_temp_status").textContent = `Min: ${obj.battery_temp_min_c} °C; Max: ${obj.battery_temp_max_c} °C; (${formatAge(obj.battery_temp_age_ms)} ago)`;
                    } else {
                        document.getElementById("battery_temp_status").textContent = "Waiting for CAN data";
                    }
                }
                if (document.getElementById("precondition_requested_status")) {
                    document.getElementById("precondition_requested_status").textContent = obj.precondition_requested ? "Yes" : "No";
                }
                if (document.getElementById("precondition_active_status")) {
                    document.getElementById("precondition_active_status").textContent = obj.precondition_starting ? "Starting" : (obj.precondition_active ? "Yes" : "No");
                }
                if (document.getElementById("precon_activate_button")) {
                    document.getElementById("precon_activate_button").value = obj.precondition_requested ? "Stop Preconditioning" : "Activate";
                }
                if (document.getElementById("port_status")) document.getElementById("port_status").innerHTML = obj.port || "3333";
                if (document.getElementById("fw_version")) document.getElementById("fw_version").innerHTML = obj.fw_version || "-";
                if (document.getElementById("hw_version")) document.getElementById("hw_version").innerHTML = obj.hw_version || "-";
                if (document.getElementById("git_version")) document.getElementById("git_version").innerHTML = obj.git_version || "-";
                if (document.getElementById("protocol") && obj.protocol) document.getElementById("protocol").value = obj.protocol;
                if (document.getElementById("batt_voltage")) document.getElementById("batt_voltage").innerHTML = obj.batt_voltage || "--.-";
                if (obj.can_do_stats && Array.isArray(obj.can_do_stats)) {
                    updateCanDoActivityStats(obj.can_do_stats);
                }
                if ("capture_active" in obj) {
                    const badge = document.getElementById("can_do_capture_active_badge");
                    if (badge) {
                        badge.style.display = obj.capture_active ? "inline-block" : "none";
                    }
                }
                updateDashboardCards(obj);
            } catch (err) {
                console.warn("Status parse error:", err);
            }
        };
        xhttp.onerror = function () {
            // Fallback mock update in preview mode if server is not reachable
            if (window.location.protocol === 'blob:' || window.location.protocol === 'file:') {
                updateDashboardCards({
                    batt_voltage: "13.8",
                    battery_soc_valid: true,
                    battery_soc_pct: 74,
                    battery_temp_valid: true,
                    battery_temp_min_c: 21,
                    battery_temp_max_c: 24,
                    precondition_active: false
                });
            }
        };
        xhttp.open("GET", "/check_status");
        xhttp.send();
    } catch (e) {
        console.warn("checkStatus XHR error:", e);
    }
}
function loadCANFLT() {
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        if (this.responseText === "NONE") {
            return;
        }
        var obj = JSON.parse(this.responseText);
        if (this.responseText != "NONE") {
            if (Array.isArray(obj.can_flt)) {
                obj.can_flt.forEach((item) => {
                    restoreCANFLTRow(item["CANID"], item["Name"], item["PID"], item["PIDIndex"], item["StartBit"], item["BitLength"], item["Expression"], item["Cycle"]);
                });
            }
        }
    };
    xhttp.open("GET", "/load_canflt");
    xhttp.send();
}

function loadautoPIDCarData() {
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        console.log("Car models:", this.responseText);
        if (this.responseText != "NONE") {
            var obj = JSON.parse(this.responseText);
            // Create array of car models
            const carModels = [];
            if (obj && Array.isArray(obj.cars)) {
                obj.cars.forEach(car => {
                    if (car.car_model) {
                        carModels.push(car.car_model);
                    }

                    // Load parameters for each PID
                    if (car.pids) {
                        document.getElementById("specific_init").value = car.init;
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
            // Load car models dropdown
            var modifiedObj = { "supported": carModels };
            loadCarModels(modifiedObj);
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
    console.log("Loading auto PID data..."); // Debug log
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        console.log("Server response:", this.responseText); // Debug log
        if (this.responseText !== "NONE") {
            const data = JSON.parse(this.responseText);
            loadAutoTable(data);
            document.getElementById("custom_pid_store").disabled = true;
        } else {
            console.log("No PID data found on server");
        }
    };
    xhttp.onerror = function (error) {
        console.error("Error loading auto PID:", error);
    };
    xhttp.open("GET", "/load_auto_pid");
    xhttp.send();
}

function postCANFLT() {
    var obj = {};
    obj["can_flt"] = canData;
    var canfltJSON = JSON.stringify(obj);
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        showNotification(this.responseText, "green");
        submit_enable();
    };
    xhttp.open("POST", "/store_canflt");
    xhttp.send(canfltJSON);
}

// 6. UPDATED: postConfig (Saving Checkbox States)
function postConfig() {
    var obj = {};
    const bools = ["webhook_en", "grouping", "autopid_polling", "ap_auto_disable", "mqtt_en", "ble_status", "sleep_status"];
    bools.forEach(id => {
        const el = document.getElementById(id);
        if (el) obj[id] = el.checked ? "enable" : "disable";
    });

    obj["wifi_mode"] = document.getElementById("wifi_mode").value;
    obj["webhook_en"] = document.getElementById("webhook_en").value;
    obj["ap_ch"] = document.getElementById("ap_ch_value").value;
    updateLegacyStaFields();
    obj["sta_ssid"] = document.getElementById("ssid_value").value;
    obj["sta_pass"] = document.getElementById("pass_value").value;
    obj["sta_security"] = document.getElementById("sta_security").value || "wpa3";
    obj["sta_networks"] = getStaNetworksData();
    obj["can_datarate"] = document.getElementById("can_datarate").value;
    obj["can_mode"] = document.getElementById("can_mode").value;
    obj["can1_datarate"] = document.getElementById("can1_datarate").value;
    obj["can1_mode"] = document.getElementById("can1_mode").value;
    obj["can1_en"] = document.getElementById("can1_en").value;
    obj["can_fwd_mode"] = document.getElementById("can_fwd_mode").value;
    obj["port_type"] = document.getElementById("port_type").value;
    obj["port"] = document.getElementById("tcp_port_value").value;
    obj["ap_pass"] = document.getElementById("ap_pass_value").value;
    obj["protocol"] = document.getElementById("protocol").value;
    obj["ble_pass"] = document.getElementById("ble_pass_value").value;
    obj["ble_status"] = document.getElementById("ble_status").value;
    obj["sleep_status"] = document.getElementById("sleep_status").value;
    obj["sleep_volt"] = document.getElementById("sleep_volt").value;
    obj["sleep_time"] = document.getElementById("sleep_time").value;
    obj["batt_alert"] = document.getElementById("batt_alert").value;
    obj["batt_alert_ssid"] = document.getElementById("batt_alert_ssid").value;
    obj["batt_alert_pass"] = document.getElementById("batt_alert_pass").value;
    obj["batt_alert_volt"] = document.getElementById("batt_alert_volt").value;
    // Build MQTT URLs: strip any existing mqtt:// prefix first so that
    // re-submits are idempotent (Load() strips the prefix into the input
    // field, but defensive stripping here prevents double-prefixing if
    // the field value somehow still has the scheme).
    obj["batt_alert_protocol"] = document.getElementById("batt_alert_protocol").value;
    let mqtt_txt = "mqtt://";
    let raw_batt_url = document.getElementById("batt_alert_url").value.replace(/^mqtt:\/\//, "");
    let mqtt_url_val = mqtt_txt.concat(raw_batt_url);
    obj["batt_alert_url"] = mqtt_url_val;
    obj["batt_alert_port"] = document.getElementById("batt_alert_port").value;
    obj["batt_alert_topic"] = document.getElementById("batt_alert_topic").value;
    obj["batt_alert_time"] = document.getElementById("batt_alert_time").value;
    obj["batt_mqtt_user"] = document.getElementById("batt_mqtt_user").value;
    obj["batt_mqtt_pass"] = document.getElementById("batt_mqtt_pass").value;
    obj["mqtt_en"] = document.getElementById("mqtt_en").value;
    // FIX: was using mqtt_txt (shared with batt_alert) on the wrong variable mqtt_txt2.
    let raw_mqtt_url = document.getElementById("mqtt_url").value.replace(/^mqtt:\/\//, "");
    let mqtt_url_val2 = mqtt_txt.concat(raw_mqtt_url);
    obj["mqtt_url"] = mqtt_url_val2;
    obj["mqtt_port"] = document.getElementById("mqtt_port").value;
    obj["mqtt_user"] = document.getElementById("mqtt_user").value;
    obj["mqtt_pass"] = document.getElementById("mqtt_pass").value;
    obj["keep_alive"] = document.getElementById("keep_alive").value;
    obj["mqtt_tx_topic"] = document.getElementById("mqtt_tx_topic").value;
    obj["ap_auto_disable"] = document.getElementById("ap_auto_disable").value;
    if (document.getElementById("mqtt_tx_en_checkbox").checked) {
        obj["mqtt_tx_en"] = "enable";
    } else {
        obj["mqtt_tx_en"] = "disable";
    }
    obj["mqtt_rx_topic"] = document.getElementById("mqtt_rx_topic").value;
    if (document.getElementById("mqtt_rx_en_checkbox").checked) {
        obj["mqtt_rx_en"] = "enable";
    } else {
        obj["mqtt_rx_en"] = "disable";
    }
    obj["mqtt_status_topic"] = document.getElementById("mqtt_status_topic").value;
    obj["mqtt_elm327_log"] = document.getElementById("mqtt_elm327_log").value;
    obj["precon_mode"] = document.getElementById("precon_mode")?.value || "once";
    obj["precon_button"] = document.getElementById("precon_button")?.value || "sw_star";
    obj["precon_press"] = document.getElementById("precon_press")?.value || "short";
    var configJSON = JSON.stringify(obj);

    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        showNotification(this.responseText, "green");
        document.getElementById("submit_button").disabled = true;
    };
    xhttp.open("POST", "/store_config");
    xhttp.setRequestHeader("Content-Type", "application/json");
    xhttp.send(JSON.stringify(obj));
}

function otaClick() {
    if (document.getElementById("ota_file").files.length == 0) {
        showNotification("No files selected!", "red");
        alert("No files selected!");
    } else {
        document.getElementById("ota_submit_button").disabled = true;
        showNotification("Updating please wait...", "green");
        setTimeout(function () {
            document.getElementById("ota_form").submit();
        }, 5000);
    }
}

function reboot() {
    document.getElementById("reboot_button").disabled = true;
    showNotification("Rebooting please reconnect...", "yellow");
    fetch("/system_reboot", { method: "POST", body: "reboot" }).catch(() => { });
}

function preconActivate() {
    fetch("/precondition_toggle", { method: "POST" })
        .then(res => res.text())
        .then(text => {
            showNotification(text, "green");
            setTimeout(checkStatus, 200);
        })
        .catch(() => {
            showNotification("Failed to toggle preconditioning", "red");
        });
}

function send_system_command(command) {
    fetch("/system_commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "command": command })
    }).catch(() => { });
}

async function downloadCfg() {
    const endpoints = [
        '/load_config',
        '/load_auto_pid_car_data',
        '/load_auto_pid',
        '/load_canflt'
    ];

    const delay = 500; // 500ms delay between requests
    let combinedData = {};
    let hasErrors = false;

    try {
        for (let i = 0; i < endpoints.length; i++) {
            const endpoint = endpoints[i];

            try {
                const response = await fetch(endpoint);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const key = endpoint.replace('/load_', '');
                combinedData[key] = data;
            } catch (fetchError) {
                hasErrors = true;
            }

            if (i < endpoints.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        if (Object.keys(combinedData).length === 0) {
            throw new Error('No data was successfully fetched from any endpoint');
        }

        const dataStr = JSON.stringify(combinedData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `config_${new Date().toISOString().split('T')[0]}.json`;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        return true;

    } catch (error) {
        alert('Failed to download configuration');
        return false;
    }
}

async function uploadCfg() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) return;

    const endpointMap = {
        'config': '/store_config',
        'auto_pid': '/store_auto_data',
        'auto_pid_car_data': '/store_car_data',
        'canflt': '/store_canflt'
    };

    const delay = 200;

    try {
        const reader = new FileReader();

        reader.onload = async function (e) {
            try {
                const jsonData = JSON.parse(e.target.result);
                let hasErrors = false;

                for (const [key, endpoint] of Object.entries(endpointMap)) {
                    if (jsonData[key]) {
                        try {
                            const response = await fetch(endpoint, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(jsonData[key])
                            });

                            if (!response.ok) {
                                hasErrors = true;
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }

                            // Add delay before next request
                            await new Promise(resolve => setTimeout(resolve, delay));

                        } catch (fetchError) {
                            hasErrors = true;
                        }
                    }
                }

                if (hasErrors) {
                    alert('Some configurations failed to upload');
                } else {
                    alert('Configuration uploaded successfully, Rebooting...');
                }

                // Clear the file input after upload
                fileInput.value = '';

            } catch (parseError) {
                alert('Failed to parse configuration file');
            }
        };

        reader.onerror = function () {
            alert('Error reading file');
        };

        reader.readAsText(file);

    } catch (error) {
        alert('Upload failed');
    }
}

// 5. UPDATED: Load (Loading Checkbox States)
function Load() {
    try {
        const xhttp = new XMLHttpRequest();
        xhttp.onload = function () {
            try {
                var obj = JSON.parse(this.responseText);

                const bools = ["webhook_en", "grouping", "autopid_polling", "ap_auto_disable", "mqtt_en", "ble_status", "sleep_status"];
                bools.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.checked = (obj[id] === "enable");
                });

                if (document.getElementById("ap_pass_value")) document.getElementById("ap_pass_value").value = obj.ap_pass || "Testpass";
                if (document.getElementById("tcp_port_value")) document.getElementById("tcp_port_value").value = obj.port || "3333";
                if (document.getElementById("ble_pass_value")) document.getElementById("ble_pass_value").value = obj.ble_pass || "000000";
                if (document.getElementById("sleep_volt")) document.getElementById("sleep_volt").value = obj.sleep_volt || "13.2";
                if (document.getElementById("sleep_volt_value")) document.getElementById("sleep_volt_value").textContent = obj.sleep_volt || "13.2";

                if (document.getElementById("mqtt_en_div")) {
                    document.getElementById("mqtt_en_div").style.display = (obj.mqtt_en === "enable") ? "block" : "none";
                }

                if (typeof checkStatus === "function") checkStatus();
                if (typeof loadCANFLT === "function") loadCANFLT();
                if (typeof loadautoPIDCarData === "function") loadautoPIDCarData();
                if (typeof loadautoPID === "function") loadautoPID();
                if (typeof loadWebhookConfig === "function") loadWebhookConfig();

                const subBtn = document.getElementById("submit_button");
                if (subBtn) subBtn.disabled = true;
            } catch (parseErr) {
                console.warn("Load config parse error:", parseErr);
            }
        };
        xhttp.onerror = function () {
            console.log("Device offline or running in preview mode. Initializing default controls.");
            if (typeof checkStatus === "function") checkStatus();
        };
        xhttp.open("GET", "/load_config");
        xhttp.send();
    } catch (xhrErr) {
        console.warn("Load XHR initialization error:", xhrErr);
    }
}

function bindEvents() {
    ws.onmessage = function (evt) {
        var received_msg = evt.data;
        if (received_msg[0] == "t") {
            var len = (received_msg[4] - "0") * 2;
            var data_str = "";
            var i;
            for (i = 0; i < len; i += 2) {
                data_str += received_msg.substr(i + 5, 2) + " ";
            }
            monitor_add_line(received_msg.substr(1, 3) + "h", "Std", received_msg[4], data_str, 0);
        } else if (received_msg[0] == "T") {
            var len = (received_msg[9] - "0") * 2;
            var data_str = "";
            var i;
            for (i = 0; i < len; i += 2) {
                data_str += received_msg.substr(i + 10, 2) + " ";
            }
            monitor_add_line(received_msg.substr(1, 8) + "h", "Ext", received_msg[9], data_str, 0);
        } else if (received_msg[0] == "r") {
            var len = (received_msg[4] - "0") * 2;
            monitor_add_line(received_msg.substr(1, 3) + "h", "RTR-Std", received_msg[4], 0, 0);
        } else if (received_msg[0] == "R") {
            var len = (received_msg[9] - "0") * 2;
            monitor_add_line(received_msg.substr(1, 8) + "h", "RTR-Ext", received_msg[9], 0, 0);
        }
    };
}

function ws_close() {
    ws.send("C" + cr);
    ws.close();
}

function mon_button_en(b) {
    if (b == 1) {
        document.getElementById("mon_button").value = "Start";
        document.getElementById("mon_datarate").disabled = false;
        document.getElementById("mon_filter").disabled = false;
        document.getElementById("mon_mask").disabled = false;
    } else {
        document.getElementById("mon_button").value = "Stop";
        document.getElementById("mon_datarate").disabled = true;
        document.getElementById("mon_filter").disabled = true;
        document.getElementById("mon_mask").disabled = true;
    }
}

function isNameUnique(name) {
    return canData.every((item) => item["Name"] !== name);
}

function addCANFLTRow() {
    var canId = parseInt(document.getElementById("canId").value);
    var startBit = parseInt(document.getElementById("startBit").value);
    var bitLength = parseInt(document.getElementById("bitLength").value);
    Length = parseInt(document.getElementById("bitLength").value);
    var cycle = parseInt(document.getElementById("cycle").value);
    var name = document.getElementById("name").value;
    var expression = document.getElementById("expression").value;
    var pid = parseInt(document.getElementById("pid").value);
    var pidi = parseInt(document.getElementById("pindex").value);
    if (isNaN(canId) || canId == "" || canId < 0 || canId > 536870912) {
        alert("CAN ID must be a valid number between 0 and 536870912");
        return;
    }
    if (isNaN(startBit) || isNaN(bitLength) || startBit > 64 - bitLength || bitLength <= 0 || bitLength > 64 || startBit < 0 || startBit > 63) {
        alert("startBit or bitLength error");
        return;
    }
    if (isNaN(cycle) || cycle < 100 || cycle > 10000) {
        alert("cycle must be between 100 and 10000");
        return;
    }
    if (name.length < 1 || name.length > 16) {
        alert("Name must be between 1 and 16 characters in length.");
        return;
    }
    if (expression.length < 1 || expression.length > 64) {
        alert("Expression must be between 1 and 64 characters in length.");
        return;
    }
    if (isNaN(pid) || pid < -1 || pid > 255) {
        alert("PID must be a number between -1 and 255");
        return;
    }
    if (isNaN(pidi) || pidi < 0 || pidi > 7) {
        alert("PID must be a number between 0 and 7");
        return;
    }
    if (isNameUnique(name)) {
        var table = document.getElementById("can_flt_table");
        var row = table.insertRow(-1);
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        var cell3 = row.insertCell(2);
        var cell4 = row.insertCell(3);
        var cell5 = row.insertCell(4);
        var cell6 = row.insertCell(5);
        var cell7 = row.insertCell(6);
        var cell8 = row.insertCell(7);
        var cell9 = row.insertCell(8);
        if (table.rows.length - 1 >= 100) {
            alert("Maximum row limit (100) reached.");
            return;
        }
        cell1.innerHTML = canId;
        cell2.innerHTML = name;
        cell3.innerHTML = pid;
        cell4.innerHTML = pidi;
        cell5.innerHTML = startBit;
        cell6.innerHTML = bitLength;
        cell7.innerHTML = expression;
        cell8.innerHTML = cycle;
        cell9.innerHTML = '<button style="width: 100%;" onclick="deleteCANFLTRow(this) ">Delete</button>';
        canData.push({
            CANID: canId,
            Name: name,
            PID: pid,
            PIDIndex: pidi,
            StartBit: startBit,
            BitLength: bitLength,
            Expression: expression,
            Cycle: cycle
        });
        document.getElementById("canId").value = "";
        document.getElementById("name").value = "";
        document.getElementById("pid").value = "";
        document.getElementById("pindex").value = "";
        document.getElementById("startBit").value = "";
        document.getElementById("bitLength").value = "";
        document.getElementById("expression").value = "";
        document.getElementById("cycle").value = "";
    } else {
        alert("Name must be unique.");
    }
    document.getElementById("store_canflt_button").disabled = false;
}

function deleteCANFLTRow(button) {
    var row = button.parentNode.parentNode;
    var canIdToDelete = row.cells[0].textContent;
    var indexToDelete = canData.findIndex((item) => item["CANID"] === parseInt(canIdToDelete));
    if (indexToDelete !== -1) {
        canData.splice(indexToDelete, 1);
    }
    row.parentNode.removeChild(row);
    document.getElementById("store_canflt_button").disabled = false;
}

function alert_elm327() {
    alert("If elm327 log is enabled then only CAN frames proccessed by elm327 will be sent to MQTT broker.");
}

function storeCANFLT() {
    postCANFLT();
    document.getElementById("store_canflt_button").disabled = true;
}

/* CAN_DO_CATALOG_START - Dynamic GitHub & SPIFFS Catalog Loader */
const CAN_DO_DOMAIN_TAXONOMY = {
    exterior_visibility: {
        id: "exterior_visibility",
        name: "Exterior & Visibility",
        icon: "snowflake",
        desc: "Lighting, wipers, glass, defoggers, mirrors, and rain sensors.",
        subdomains: {
            lighting: { id: "lighting", name: "Lighting", desc: "Headlights, hazard flashers, turn signals, reverse lights" },
            glass_wipers: { id: "glass_wipers", name: "Glass & Wipers", desc: "Windshield wipers, rear wipers, washers, rain sensors" },
            mirrors: { id: "mirrors", name: "Mirrors", desc: "Power folding mirrors, tilt-in-reverse, heated mirror glass" }
        }
    },
    access_body: {
        id: "access_body",
        name: "Access & Body",
        icon: "car",
        desc: "Doors, latches, central locking, trunk, hood, charge port, and windows.",
        subdomains: {
            doors_latches: { id: "doors_latches", name: "Doors & Latches", desc: "Driver/passenger doors, trunk, hood, charge port door" },
            locks_security: { id: "locks_security", name: "Locks & Security", desc: "Central locks, child locks, auto walk-away locks, alarm" },
            openings_roof: { id: "openings_roof", name: "Openings & Roof", desc: "Power windows, power sunroof/tilt, sunshade" }
        }
    },
    climate_thermal: {
        id: "climate_thermal",
        name: "Climate & Thermal",
        icon: "thermometer",
        desc: "Cabin HVAC, seat warmers/ventilation, heated steering wheel, and ambient temp.",
        subdomains: {
            hvac: { id: "hvac", name: "HVAC", desc: "Cabin target temp, blower fan, recirculation, AC, SYNC" },
            surface_warmers: { id: "surface_warmers", name: "Surface Warmers", desc: "Seat heaters, ventilated seats, heated steering wheel, rear defogger" },
            environment: { id: "environment", name: "Environment", desc: "Outdoor ambient air temp, cabin temperature, weather" }
        }
    },
    energy_powertrain: {
        id: "energy_powertrain",
        name: "Energy & Powertrain",
        icon: "battery-hv",
        desc: "High-voltage traction battery, charging, 12V auxiliary power, and drivetrain.",
        subdomains: {
            traction_battery: { id: "traction_battery", name: "Traction (HV) Battery", desc: "HV battery SOC, live cell temps, battery preconditioning" },
            charging_v2l: { id: "charging_v2l", name: "Charging & V2L", desc: "AC/DC charge limits, plug status, V2L discharge cutoff" },
            aux_12v: { id: "aux_12v", name: "Auxiliary (12V) Power", desc: "12V battery voltage, ICCU DC-DC converter, sleep/wake" },
            drivetrain_dynamics: { id: "drivetrain_dynamics", name: "Drivetrain & Dynamics", desc: "Gear (P/R/N/D), vehicle speed, brake pedal, drive modes" }
        }
    },
    cabin_media: {
        id: "cabin_media",
        name: "Cabin Controls & Media",
        icon: "car-seat",
        desc: "Steering wheel buttons, cluster OSD popups, ambient lighting, and active sound.",
        subdomains: {
            physical_switches: { id: "physical_switches", name: "Physical Switches", desc: "Steering wheel buttons (Star, Mode, Voice, Vol, Seek), AVN buttons" },
            displays_feedback: { id: "displays_feedback", name: "Displays & Feedback", desc: "Cluster OSD toasts, HUD height/brightness, cluster dimmer" },
            audio_atmosphere: { id: "audio_atmosphere", name: "Audio & Atmosphere", desc: "Active Sound Design (ASD), 64-color ambient footwell/door RGB lighting" }
        }
    },
    system_automation: {
        id: "system_automation",
        name: "System & Automation",
        icon: "settings",
        desc: "Time schedules, Home Assistant webhooks, MQTT events, delays, and logic flows.",
        subdomains: {
            schedule_time: { id: "schedule_time", name: "Schedule & Time", desc: "Weekdays/weekends, time windows, interval timers, daily clock" },
            network_integrations: { id: "network_integrations", name: "Network & Integrations", desc: "Home Assistant webhooks, MQTT alerts, deep-sleep ping pulses, raw CAN" },
            logic_flow: { id: "logic_flow", name: "Logic & Flow Control", desc: "If-Then-Else conditional branching, Choose blocks, AND/OR/NOT groups" }
        }
    }
};

function getCommandTaxonomy(cmd) {
    if (!cmd) return { domain: "system_automation", subdomain: "network_integrations" };
    if (cmd.domain && cmd.subdomain) {
        return { domain: cmd.domain, subdomain: cmd.subdomain };
    }
    const id = (cmd.id || "").toLowerCase();
    const name = (cmd.name || "").toLowerCase();
    const cat = (cmd.category || "").toLowerCase();
    const type = (cmd.type || "").toLowerCase();

    // 1. Exterior & Visibility
    if (id.includes("hazard") || name.includes("hazard") || name.includes("headlight") || name.includes("light") && (name.includes("turn") || name.includes("beam"))) {
        return { domain: "exterior_visibility", subdomain: "lighting" };
    }
    if (id.includes("wiper") || name.includes("wiper") || id.includes("rain") || name.includes("washer")) {
        return { domain: "exterior_visibility", subdomain: "glass_wipers" };
    }
    if (id.includes("mirror") || name.includes("mirror") || id.includes("rear_defog") || name.includes("defogger")) {
        return { domain: "exterior_visibility", subdomain: "mirrors" };
    }

    // 2. Access & Body
    if (id.includes("door") && !id.includes("lock") || id.includes("trunk") || id.includes("tailgate") || id.includes("hood") || id.includes("charge_port") || name.includes("door") && !name.includes("lock") || name.includes("trunk") || name.includes("hood") || name.includes("charge port")) {
        return { domain: "access_body", subdomain: "doors_latches" };
    }
    if (id.includes("lock") || name.includes("lock") || id.includes("alarm") || name.includes("security")) {
        return { domain: "access_body", subdomain: "locks_security" };
    }
    if (id.includes("sunroof") || name.includes("sunroof") || id.includes("window") || name.includes("window") || id.includes("sunshade")) {
        return { domain: "access_body", subdomain: "openings_roof" };
    }

    // 3. Climate & Thermal
    if (id.includes("target_temp") || id.includes("climate_sync") || id.includes("driver_only") || id.includes("climate_fan") || id.includes("recirc") || type === "climate_target" || name.includes("target cabin temp") || name.includes("sync mode") || name.includes("driver only") || name.includes("fan")) {
        return { domain: "climate_thermal", subdomain: "hvac" };
    }
    if (id.includes("seat") || name.includes("seat") || id.includes("heated_wheel") || name.includes("heated steering") || name.includes("ventilation")) {
        return { domain: "climate_thermal", subdomain: "surface_warmers" };
    }
    if (id.includes("temp_") || name.includes("outdoor temp") || name.includes("weather") || name.includes("humidity")) {
        return { domain: "climate_thermal", subdomain: "environment" };
    }

    // 4. Energy & Powertrain
    if (id.includes("precon") || type === "precondition" || name.includes("preconditioning") || id.includes("hv_soc") || name.includes("hv battery") || name.includes("batt temp") || name.includes("traction battery")) {
        return { domain: "energy_powertrain", subdomain: "traction_battery" };
    }
    if (id.includes("charge_limit") || name.includes("charge limit") || id.includes("charging") || name.includes("charging") || id.includes("v2l") || name.includes("v2l")) {
        return { domain: "energy_powertrain", subdomain: "charging_v2l" };
    }
    if (id.includes("12v") || id.includes("aux_") || id.includes("voltage") || type === "voltage" || name.includes("12v") || name.includes("aux battery") || name.includes("wake pulse")) {
        return { domain: "energy_powertrain", subdomain: "aux_12v" };
    }
    if (id.includes("speed") || type === "speed_zero" || id.includes("gear") || name.includes("speed") || name.includes("gear") || id.includes("brake") || name.includes("brake") || id.includes("ready") || id.includes("power_state") || id.includes("seatbelt")) {
        return { domain: "energy_powertrain", subdomain: "drivetrain_dynamics" };
    }

    // 5. Cabin Controls & Media
    if (id.startsWith("sw_") || id.includes("avn_star") || id.includes("touch_bar") || id.includes("camera_btn") || cat.includes("steering") || cat.includes("dashboard / center console") || name.includes("button") && !name.includes("heat")) {
        return { domain: "cabin_media", subdomain: "physical_switches" };
    }
    if (id.includes("brightness") || type === "popup" || name.includes("toast") || name.includes("popup") || name.includes("osd") || name.includes("hud") || cat.includes("cluster osd")) {
        return { domain: "cabin_media", subdomain: "displays_feedback" };
    }
    if (id.includes("ambient") || name.includes("ambient") || id.includes("asd") || name.includes("active sound") || name.includes("audio")) {
        return { domain: "cabin_media", subdomain: "audio_atmosphere" };
    }

    // 6. System & Automation
    if (id.includes("weekday") || id.includes("weekend") || id.includes("daytime") || id.includes("nighttime") || type === "time_window" || type === "day_of_week" || type === "clock" || type === "interval" || cat.includes("schedule")) {
        return { domain: "system_automation", subdomain: "schedule_time" };
    }
    if (type === "delay" || type === "choose" || type === "if_then" || type.includes("group")) {
        return { domain: "system_automation", subdomain: "logic_flow" };
    }
    return { domain: "system_automation", subdomain: "network_integrations" };
}

let CAN_DO_CATALOG = {
    catalog_version: "0.0.0",
    vehicles: [],
    commands: [],
};

const DEFAULT_CAN_DO_CATALOG_URL = "https://raw.githubusercontent.com/supersuave/wicant-i-precondition/main/main/can_do_catalog.json";

function getCanDoCatalogUrl() {
    let url = localStorage.getItem("wican_can_do_catalog_url") || DEFAULT_CAN_DO_CATALOG_URL;
    url = url.trim();
    // Convert github.com/.../blob/... to raw.githubusercontent.com/... if user pasted regular GitHub URL
    if (url.includes("github.com") && url.includes("/blob/")) {
        url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
    }
    return url;
}

function configureCatalogUrl() {
    const current = localStorage.getItem("wican_can_do_catalog_url") || DEFAULT_CAN_DO_CATALOG_URL;
    const input = prompt("Enter CAN Do Catalog raw JSON URL:\n(Leave empty to reset to default L1Z3/wicant-i-precondition)", current);
    if (input === null) return;
    const trimmed = input.trim();
    if (!trimmed || trimmed === DEFAULT_CAN_DO_CATALOG_URL) {
        localStorage.removeItem("wican_can_do_catalog_url");
        showNotification("Catalog URL reset to default (L1Z3/wicant-i-precondition).", "blue", 3000);
    } else {
        localStorage.setItem("wican_can_do_catalog_url", trimmed);
        showNotification("Catalog URL updated. Syncing now...", "blue", 3000);
    }
    syncCatalogFromGitHub(true);
}

function updateCatalogStatusUI(status, info) {
    const badge = document.getElementById("can_do_catalog_badge");
    if (!badge) return;
    const currentUrl = getCanDoCatalogUrl();
    const isCustom = (localStorage.getItem("wican_can_do_catalog_url") && localStorage.getItem("wican_can_do_catalog_url") !== DEFAULT_CAN_DO_CATALOG_URL);
    badge.className = "";
    badge.style.background = "";
    badge.style.color = "";
    if (status === "online") {
        badge.textContent = isCustom ? "Catalog: Online (Custom URL)" : "Catalog: Online (L1Z3)";
        badge.classList.add("catalog-online");
        badge.title = "Latest presets synced from " + currentUrl + " at " + (info || "");
    } else if (status === "device") {
        badge.textContent = "Catalog: Device Flash";
        badge.classList.add("catalog-device");
        badge.title = "Loaded from WiCAN offline storage";
    } else if (status === "cached") {
        badge.textContent = "Catalog: Cached";
        badge.classList.add("catalog-cached");
        badge.title = "Loaded from browser cache";
    } else if (status === "custom") {
        badge.textContent = "Catalog: Custom Imported";
        badge.classList.add("catalog-custom");
    } else {
        badge.textContent = "Catalog: Fallback";
        badge.classList.add("catalog-fallback");
    }
}

function syncCatalogToDevice(catalogData) {
    fetch("/store_can_do_catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catalogData)
    }).catch(err => console.log("Background SPIFFS catalog cache skipped:", err));
}

function mergeCatalogData(base, custom) {
    if (!custom) return base || CAN_DO_DEFAULT_FALLBACK_CATALOG;
    if (!base) return custom;

    // 1. Merge vehicles
    const vehiclesMap = new Map();
    (base.vehicles || []).forEach(v => vehiclesMap.set(v.id, { ...v }));
    (custom.vehicles || []).forEach(v => vehiclesMap.set(v.id, { ...(vehiclesMap.get(v.id) || {}), ...v }));
    const mergedVehicles = Array.from(vehiclesMap.values());

    // 2. Merge unified commands if present
    if ((base.commands && Array.isArray(base.commands)) || (custom.commands && Array.isArray(custom.commands))) {
        const cmdMap = new Map();
        (base.commands || []).forEach(c => cmdMap.set(c.id || c.name, { ...c }));
        (custom.commands || []).forEach(c => {
            const key = c.id || c.name;
            cmdMap.set(key, { ...(cmdMap.get(key) || {}), ...c });
        });
        return {
            catalog_version: custom.catalog_version || base.catalog_version || "3.1.0",
            infotainment_platform: custom.infotainment_platform || base.infotainment_platform || "",
            supported_model_years: custom.supported_model_years || base.supported_model_years || "",
            vehicles: mergedVehicles,
            commands: Array.from(cmdMap.values())
        };
    }

    // 3. Fallback: Merge trigger_presets
    const trigMap = new Map();
    (base.trigger_presets || []).forEach(t => trigMap.set(t.id || t.name, { ...t }));
    (custom.trigger_presets || []).forEach(t => {
        const key = t.id || t.name;
        trigMap.set(key, { ...(trigMap.get(key) || {}), ...t });
    });
    const mergedTriggers = Array.from(trigMap.values());

    // 4. Fallback: Merge action_presets (by category name, then by preset name)
    const catMap = new Map();
    (base.action_presets || []).forEach(cat => {
        catMap.set(cat.category, {
            category: cat.category,
            presets: (cat.presets || []).map(p => ({ ...p }))
        });
    });
    (custom.action_presets || []).forEach(cat => {
        if (!catMap.has(cat.category)) {
            catMap.set(cat.category, {
                category: cat.category,
                presets: (cat.presets || []).map(p => ({ ...p }))
            });
        } else {
            const existingCat = catMap.get(cat.category);
            const actMap = new Map();
            existingCat.presets.forEach(p => actMap.set(p.name, p));
            (cat.presets || []).forEach(p => actMap.set(p.name, { ...(actMap.get(p.name) || {}), ...p }));
            existingCat.presets = Array.from(actMap.values());
        }
    });
    const mergedActions = Array.from(catMap.values());

    return {
        catalog_version: custom.catalog_version || base.catalog_version,
        vehicles: mergedVehicles,
        trigger_presets: mergedTriggers,
        action_presets: mergedActions
    };
}

function getCatalogVehicles() {
    if (CAN_DO_CATALOG && Array.isArray(CAN_DO_CATALOG.vehicles) && CAN_DO_CATALOG.vehicles.length > 0) {
        return CAN_DO_CATALOG.vehicles;
    }
    return CAN_DO_DEFAULT_FALLBACK_CATALOG.vehicles || [];
}

async function loadCanDoCatalog() {
    const applyCatalog = (data, source, info) => {
        // Preserve custom imported/user presets if present in localStorage
        const customSaved = localStorage.getItem("wican_custom_imported_catalog");
        if (customSaved) {
            try {
                data = mergeCatalogData(data, JSON.parse(customSaved));
            } catch (e) { }
        }
        CAN_DO_CATALOG = data;
        localStorage.setItem("wican_can_do_catalog", JSON.stringify(data));
        updateCatalogStatusUI(source, info);
        populateVehicleDropdowns(data.vehicles);
        refreshAllCanDoPresetDropdowns();
    };

    // 1. Instant check from browser cache
    try {
        const cached = localStorage.getItem("wican_can_do_catalog");
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed.vehicles) && parsed.vehicles.length > 0) {
                applyCatalog(parsed, "cached");
            }
        }
    } catch (e) { }

    // 2. Fetch the compressed file served by the ESP32
    try {
        const res = await fetch("/can_do_catalog.json");
        if (res.ok) {
            const data = await res.json();
            if (data && (data.commands || data.vehicles)) {
                // Update if newer than cached
                if (
                    !CAN_DO_CATALOG ||
                    data.catalog_version !== CAN_DO_CATALOG.catalog_version
                ) {
                    applyCatalog(data, "device", data.catalog_version);
                }
            }
        }
    } catch (err) {
        console.warn("Failed to load /can_do_catalog.json from device:", err);
    }

    // 3. Optional: Background check upstream GitHub when internet is present
    if (navigator.onLine) {
        const catalogUrl = getCanDoCatalogUrl();
        fetch(catalogUrl + "?_t=" + Date.now(), { cache: "no-cache" })
            .then((res) => (res.ok ? res.json() : null))
            .then((remoteData) => {
                if (
                    remoteData &&
                    remoteData.catalog_version !== CAN_DO_CATALOG?.catalog_version
                ) {
                    applyCatalog(remoteData, "online", remoteData.catalog_version);
                    // Sync update to ESP32 flash storage
                    fetch("/store_can_do_catalog", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(remoteData),
                    }).catch(() => { });
                }
            })
            .catch(() => { });
    }
}

const GEN5W_MODEL_LIST = [
    { id: "all_egmp", name: "All Gen5W Models (Universal)", make: "Universal" },
    { id: "hyundai_ioniq5", name: "Hyundai Ioniq 5", make: "Hyundai" },
    { id: "kia_ev6", name: "Kia EV6", make: "Kia" },
    { id: "hyundai_ioniq6", name: "Hyundai Ioniq 6", make: "Hyundai" }
];

function populateVehicleDropdowns(vehicles) {
    if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
        vehicles = getCatalogVehicles();
    }
    const modelSel = document.getElementById("can_do_vehicle_model");
    const trimSel = document.getElementById("can_do_vehicle_trim");
    if (!modelSel) return;

    let savedModel = localStorage.getItem("wican_vehicle_model") || "all_egmp";
    let savedTrim = localStorage.getItem("wican_vehicle_trim") || localStorage.getItem("wican_vehicle_profile") || "all_egmp";

    // Auto-infer model family if a specific trim was saved previously
    if (savedTrim && savedTrim !== "all_egmp" && savedModel === "all_egmp") {
        const matchedVeh = vehicles.find(v => v.id === savedTrim);
        if (matchedVeh && matchedVeh.family) {
            savedModel = matchedVeh.family;
            localStorage.setItem("wican_vehicle_model", savedModel);
        }
    }

    modelSel.innerHTML = "";
    GEN5W_MODEL_LIST.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name;
        if (m.id === savedModel) opt.selected = true;
        modelSel.appendChild(opt);
    });

    const currentModelVal = modelSel.value || savedModel;
    populateTrimDropdown(currentModelVal, savedTrim, vehicles);
}

function populateTrimDropdown(selectedModel, currentTrimVal, vehicles) {
    const trimSel = document.getElementById("can_do_vehicle_trim");
    if (!trimSel) return;
    trimSel.innerHTML = "";

    const allOpt = document.createElement("option");
    allOpt.value = selectedModel;
    allOpt.textContent = "All Trims / Base Features";
    if (currentTrimVal === selectedModel || currentTrimVal === "all_egmp") allOpt.selected = true;
    trimSel.appendChild(allOpt);

    const matchingTrims = vehicles.filter(v => v.family === selectedModel && v.id !== selectedModel && v.id !== "all_egmp");
    matchingTrims.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.trim || t.name;
        if (t.id === currentTrimVal) opt.selected = true;
        trimSel.appendChild(opt);
    });
}

function syncCatalogFromGitHub(manual = true) {
    const catalogUrl = getCanDoCatalogUrl();
    showNotification("Syncing presets from " + catalogUrl + " ...", "blue", 2500);
    fetch(catalogUrl + (catalogUrl.includes("?") ? "&_t=" : "?_t=") + Date.now(), { cache: "no-cache" })
        .then(res => {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(data => {
            if (data && (data.commands || (data.trigger_presets && data.action_presets))) {
                // Smart merge with persistent custom user imports
                const customSaved = localStorage.getItem("wican_custom_imported_catalog");
                if (customSaved) {
                    try {
                        const customParsed = JSON.parse(customSaved);
                        data = mergeCatalogData(data, customParsed);
                    } catch (e) { }
                }
                CAN_DO_CATALOG = data;
                localStorage.setItem("wican_can_do_catalog", JSON.stringify(data));
                localStorage.setItem("wican_can_do_catalog_sync_time", new Date().toLocaleString());
                updateCatalogStatusUI("online", new Date().toLocaleTimeString());
                populateVehicleDropdowns(data.vehicles);
                refreshAllCanDoPresetDropdowns();
                syncCatalogToDevice(data);
                const totalCmds = data.commands ? data.commands.length : ((data.trigger_presets || []).length + (data.action_presets || []).reduce((acc, cat) => acc + (cat.presets || []).length, 0));
                const mergeNote = customSaved ? " (smart merged with your custom presets)" : "";
                showNotification(`✓ Synced successfully: ${totalCmds} unified commands updated${mergeNote}!`, "green", 4500);
            } else {
                throw new Error("Invalid catalog format");
            }
        })
        .catch(err => {
            showNotification("Could not reach repository (" + catalogUrl + "). Keeping current presets.", "red", 4500);
        });
}

function importCanDoCatalogFile(inputElem) {
    const file = inputElem.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data && (data.commands || (data.trigger_presets && data.action_presets))) {
                const shouldMerge = confirm("Merge imported presets with existing catalog?\n\n• Click OK to MERGE (recommended - preserves existing presets and adds/updates new ones)\n• Click Cancel to REPLACE (replaces entire catalog with this file)");
                if (shouldMerge) {
                    localStorage.setItem("wican_custom_imported_catalog", JSON.stringify(data));
                    CAN_DO_CATALOG = mergeCatalogData(CAN_DO_CATALOG, data);
                } else {
                    localStorage.removeItem("wican_custom_imported_catalog");
                    CAN_DO_CATALOG = data;
                }
                localStorage.setItem("wican_can_do_catalog", JSON.stringify(CAN_DO_CATALOG));
                updateCatalogStatusUI("custom");
                populateVehicleDropdowns(CAN_DO_CATALOG.vehicles);
                refreshAllCanDoPresetDropdowns();
                syncCatalogToDevice(CAN_DO_CATALOG);
                const totalCmds = CAN_DO_CATALOG.commands ? CAN_DO_CATALOG.commands.length : ((CAN_DO_CATALOG.trigger_presets || []).length + (CAN_DO_CATALOG.action_presets || []).reduce((acc, cat) => acc + (cat.presets || []).length, 0));
                showNotification(`✓ Presets ${shouldMerge ? "merged" : "loaded"}: ${totalCmds} commands available.`, "green", 4000);
            } else {
                showNotification("Invalid catalog format. Missing commands or trigger_presets.", "red", 4000);
            }
        } catch (err) {
            showNotification("Failed to parse catalog JSON: " + err, "red", 4000);
        }
        inputElem.value = "";
    };
    reader.readAsText(file);
}
/* CAN_DO_CATALOG_END */

function getSelectedVehicleProfile() {
    const trimSel = document.getElementById("can_do_vehicle_trim");
    if (trimSel && trimSel.value) return trimSel.value;
    const modelSel = document.getElementById("can_do_vehicle_model");
    if (modelSel && modelSel.value) return modelSel.value;
    const hiddenSel = document.getElementById("can_do_vehicle_profile");
    if (hiddenSel && hiddenSel.value) return hiddenSel.value;
    return localStorage.getItem("wican_vehicle_profile") || "all_egmp";
}

function initCanDoVehicleProfileUI() {
    populateVehicleDropdowns(getCatalogVehicles());
}

function getCanDoDeviceSettings() {
    let customPresets = {
        triggers: (typeof getCustomTrigPresets === "function") ? getCustomTrigPresets() : [],
        actions: (typeof getCustomActPresets === "function") ? getCustomActPresets() : [],
        conditions: (typeof getCustomCondPresets === "function") ? getCustomCondPresets() : []
    };
    let customWidgets = {
        state_widgets: {},
        dash_buttons: {},
        custom_cards: []
    };
    try {
        customWidgets.state_widgets = JSON.parse(localStorage.getItem("wican_state_widgets") || "{}");
    } catch (e) { }
    try {
        customWidgets.dash_buttons = JSON.parse(localStorage.getItem("wican_dash_can_do_buttons") || "{}");
    } catch (e) { }
    if (typeof getDashboardWidgetLayout === "function") {
        customWidgets.custom_cards = getDashboardWidgetLayout().filter(id => id.startsWith("can_state_") || id.startsWith("can_do_btn_"));
    }
    return {
        vehicle_model: localStorage.getItem("wican_vehicle_model") || "all_egmp",
        vehicle_trim: localStorage.getItem("wican_vehicle_trim") || "all_egmp",
        vehicle_profile: localStorage.getItem("wican_vehicle_profile") || "all_egmp",
        unit_system: localStorage.getItem("wican_unit_system") || "metric",
        custom_presets: customPresets,
        custom_widgets: customWidgets
    };
}

function changeCanDoVehicleModel(modelId, syncToDevice = true) {
    localStorage.setItem("wican_vehicle_model", modelId);
    populateTrimDropdown(modelId, modelId, getCatalogVehicles());
    const trimSel = document.getElementById("can_do_vehicle_trim");
    const activeProfile = (trimSel && trimSel.value) ? trimSel.value : modelId;
    localStorage.setItem("wican_vehicle_profile", activeProfile);
    localStorage.setItem("wican_vehicle_trim", activeProfile);

    const hiddenSel = document.getElementById("can_do_vehicle_profile");
    if (hiddenSel) hiddenSel.value = activeProfile;

    refreshAllCanDoPresetDropdowns();

    const modelSel = document.getElementById("can_do_vehicle_model");
    const mName = modelSel ? (modelSel.selectedOptions[0]?.text || modelId) : modelId;
    showNotification("Vehicle model set to: " + mName, "green", 3000);
    if (syncToDevice) {
        autoSaveCanDoRules();
    }
}

function changeCanDoVehicleTrim(trimId, syncToDevice = true) {
    const vehicles = getCatalogVehicles();
    const veh = vehicles.find(v => v.id === trimId);

    if (veh && veh.family && veh.family !== "all_egmp") {
        const modelSel = document.getElementById("can_do_vehicle_model");
        if (modelSel && modelSel.value !== veh.family) {
            modelSel.value = veh.family;
            localStorage.setItem("wican_vehicle_model", veh.family);
            populateTrimDropdown(veh.family, trimId, vehicles);
        }
    }

    localStorage.setItem("wican_vehicle_trim", trimId);
    localStorage.setItem("wican_vehicle_profile", trimId);

    const hiddenSel = document.getElementById("can_do_vehicle_profile");
    if (hiddenSel) hiddenSel.value = trimId;

    refreshAllCanDoPresetDropdowns();

    const trimSel = document.getElementById("can_do_vehicle_trim");
    const tName = trimSel ? (trimSel.selectedOptions[0]?.text || trimId) : trimId;
    showNotification("Trim level set to: " + tName, "green", 3000);
    if (syncToDevice) {
        autoSaveCanDoRules();
    }
}

function getUnitSystem() {
    const sel = document.getElementById("can_do_unit_system");
    if (sel && sel.value) return sel.value;
    return localStorage.getItem("wican_unit_system") || "metric";
}

function initUnitSystemUI() {
    const saved = localStorage.getItem("wican_unit_system") || "metric";
    const sel = document.getElementById("can_do_unit_system");
    if (sel) sel.value = saved;
}

function changeUnitSystem(unit, syncToDevice = true) {
    localStorage.setItem("wican_unit_system", unit);
    const isImperial = (unit === "imperial");

    // 1. Update climate target temperature inputs (Driver and Passenger)
    document.querySelectorAll(".can-do-act-target-temp, .can-do-act-pass-temp").forEach(inp => {
        const currentVal = parseFloat(inp.value);
        if (!isNaN(currentVal)) {
            if (isImperial) {
                // Convert Celsius to Fahrenheit (62 - 82)
                const fVal = Math.min(82, Math.max(62, Math.round(currentVal * 9 / 5 + 32)));
                inp.min = "62";
                inp.max = "82";
                inp.step = "1";
                inp.value = fVal;
            } else {
                // Convert Fahrenheit to Celsius (17.0 - 28.0)
                const cVal = Math.min(28.0, Math.max(17.0, Math.round(((currentVal - 32) * 5 / 9) * 2) / 2));
                inp.min = "17.0";
                inp.max = "28.0";
                inp.step = "0.5";
                inp.value = cVal.toFixed(1);
            }
        } else {
            inp.min = isImperial ? "62" : "17.0";
            inp.max = isImperial ? "82" : "28.0";
            inp.step = isImperial ? "1" : "0.5";
            inp.value = isImperial ? 72 : 21.0;
        }
    });

    // 2. Update visible temperature unit indicators
    document.querySelectorAll(".can-do-target-temp-unit").forEach(span => {
        span.textContent = isImperial ? "°F" : "°C";
    });

    // 3. Update speed condition labels in all active condition items
    document.querySelectorAll(".can-do-cond-type").forEach(sel => {
        const speedOpt = sel.querySelector("option[value='speed_zero']");
        if (speedOpt) {
            speedOpt.textContent = `Vehicle Speed == 0 ${isImperial ? "mph" : "km/h"} (Parked)`;
        }
    });

    // 4. Update distance/speed/pressure helper labels across the interface
    document.querySelectorAll(".can-do-unit-speed").forEach(el => {
        el.textContent = isImperial ? "mph" : "km/h";
    });
    document.querySelectorAll(".can-do-unit-distance").forEach(el => {
        el.textContent = isImperial ? "mi" : "km";
    });
    document.querySelectorAll(".can-do-unit-pressure").forEach(el => {
        el.textContent = isImperial ? "psi" : "bar";
    });

    refreshAllCanDoPresetDropdowns();

    document.querySelectorAll(".can-do-act-preset-picker").forEach(picker => {
        if (picker.value) applyCanDoActionPreset(picker);
    });

    document.querySelectorAll(".can-do-rule-card").forEach(card => {
        updateCanDoRuleSummaryPill(card);
    });

    showNotification(`Unit preference set to: ${isImperial ? "Imperial (mph, mi, °F, psi)" : "Metric (km/h, km, °C, bar)"}`, "green", 3000);
    if (syncToDevice) {
        autoSaveCanDoRules();
    }
}

function getCustomTrigPresets() {
    try {
        return JSON.parse(localStorage.getItem("wican_custom_trig_presets") || "[]");
    } catch (e) { return []; }
}

function saveCustomTrigPreset(presetObj) {
    const list = getCustomTrigPresets();
    list.push(presetObj);
    localStorage.setItem("wican_custom_trig_presets", JSON.stringify(list));
    refreshAllCanDoPresetDropdowns();
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
}

function getCustomActPresets() {
    try {
        return JSON.parse(localStorage.getItem("wican_custom_act_presets") || "[]");
    } catch (e) { return []; }
}

function saveCustomActPreset(presetObj) {
    const list = getCustomActPresets();
    list.push(presetObj);
    localStorage.setItem("wican_custom_act_presets", JSON.stringify(list));
    refreshAllCanDoPresetDropdowns();
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
}

function getCustomCondPresets() {
    try {
        return JSON.parse(localStorage.getItem("wican_custom_cond_presets") || "[]");
    } catch (e) { return []; }
}

function saveCustomCondPreset(presetObj) {
    const list = getCustomCondPresets();
    list.push(presetObj);
    localStorage.setItem("wican_custom_cond_presets", JSON.stringify(list));
    refreshAllCanDoPresetDropdowns();
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
}

function isPresetSupportedByVehicle(preset, vehicleId) {
    if (!preset) return false;
    if (!vehicleId || vehicleId === "all_egmp") return true;

    const selVeh = (CAN_DO_CATALOG.vehicles || []).find(v => v.id === vehicleId);

    // Check feature capability requirements (e.g. ventilated seats, heated steering wheel, 360 camera, touch bar)
    if (preset.requires_feature && selVeh && Array.isArray(selVeh.features)) {
        if (!selVeh.features.includes(preset.requires_feature)) {
            return false;
        }
    }

    // Check tags (all_egmp, family, or specific trim ID)
    if (!preset.tags || preset.tags.length === 0) return true;
    if (preset.tags.includes("all_egmp") || preset.tags.includes(vehicleId)) return true;
    if (selVeh && selVeh.family && preset.tags.includes(selVeh.family)) return true;

    return false;
}

function getFilteredTriggerPresets() {
    const vId = getSelectedVehicleProfile();
    let catalogTrigs = [];
    if (CAN_DO_CATALOG.commands && Array.isArray(CAN_DO_CATALOG.commands)) {
        catalogTrigs = CAN_DO_CATALOG.commands.filter(cmd => {
            const roles = cmd.roles || ["trigger"];
            return roles.includes("trigger");
        });
    } else if (CAN_DO_CATALOG.trigger_presets) {
        catalogTrigs = CAN_DO_CATALOG.trigger_presets;
    }
    const filtered = catalogTrigs.filter(p => isPresetSupportedByVehicle(p, vId));
    const custom = getCustomTrigPresets();
    return { builtIn: filtered, custom: custom };
}

function getFilteredActionPresets() {
    const vId = getSelectedVehicleProfile();
    let catalogActs = [];

    if (CAN_DO_CATALOG.commands && Array.isArray(CAN_DO_CATALOG.commands)) {
        catalogActs = CAN_DO_CATALOG.commands.filter(cmd => {
            const roles = cmd.roles || ["action"];
            return roles.includes("action");
        });
    } else if (CAN_DO_CATALOG.action_presets) {
        // Legacy fallback
        CAN_DO_CATALOG.action_presets.forEach(cat => {
            (cat.presets || []).forEach(p => catalogActs.push(p));
        });
    }

    const filtered = catalogActs.filter(p => isPresetSupportedByVehicle(p, vId));
    const custom = getCustomActPresets();

    const domainMap = new Map();
    if (custom.length > 0) {
        domainMap.set("⭐ My Saved Actions", custom);
    }

    filtered.forEach(p => {
        const tax = getCommandTaxonomy(p);
        const dDef = CAN_DO_DOMAIN_TAXONOMY[tax.domain] || { name: "System & Automation", subdomains: {} };
        const subDef = (dDef.subdomains && dDef.subdomains[tax.subdomain]) ? dDef.subdomains[tax.subdomain].name : (p.category || "General");
        const groupLabel = `${dDef.name} — ${subDef}`;

        if (!domainMap.has(groupLabel)) domainMap.set(groupLabel, []);
        domainMap.get(groupLabel).push(p);
    });

    const result = [];
    domainMap.forEach((presets, category) => {
        result.push({ category: category, presets: presets });
    });

    return result;
}

function getFilteredConditionPresets() {
    const vId = getSelectedVehicleProfile();
    let catalogConds = [];

    if (CAN_DO_CATALOG.commands && Array.isArray(CAN_DO_CATALOG.commands)) {
        catalogConds = CAN_DO_CATALOG.commands.filter(cmd => {
            const roles = cmd.roles || ["condition"];
            return roles.includes("condition");
        });
    } else if (CAN_DO_CATALOG.condition_presets) {
        // Legacy fallback
        CAN_DO_CATALOG.condition_presets.forEach(cat => {
            (cat.presets || []).forEach(p => catalogConds.push(p));
        });
    }

    const filtered = catalogConds.filter(p => isPresetSupportedByVehicle(p, vId));
    const custom = getCustomCondPresets();

    const domainMap = new Map();
    if (custom.length > 0) {
        domainMap.set("⭐ My Saved Conditions", custom);
    }

    filtered.forEach(p => {
        const tax = getCommandTaxonomy(p);
        const dDef = CAN_DO_DOMAIN_TAXONOMY[tax.domain] || { name: "System & Automation", subdomains: {} };
        const subDef = (dDef.subdomains && dDef.subdomains[tax.subdomain]) ? dDef.subdomains[tax.subdomain].name : (p.category || "General");
        const groupLabel = `${dDef.name} — ${subDef}`;

        if (!domainMap.has(groupLabel)) domainMap.set(groupLabel, []);
        domainMap.get(groupLabel).push(p);
    });

    const result = [];
    domainMap.forEach((presets, category) => {
        result.push({ category: category, presets: presets });
    });

    return result;
}

function renderTrigPresetOptionsHTML(selectedIdxStr = "") {
    const { builtIn, custom } = getFilteredTriggerPresets();
    let html = '<option value="">-- Select from Catalog --</option>';
    if (custom.length > 0) {
        html += '<optgroup label="⭐ My Saved Triggers">';
        custom.forEach((p, idx) => {
            const val = `c_${idx}`;
            html += `<option value="${val}" ${selectedIdxStr === val ? "selected" : ""}>${p.name}</option>`;
        });
        html += '</optgroup>';
    }

    // Group built-ins by 6 Top-Level Domains & Sub-Domains
    const domainMap = new Map();
    builtIn.forEach((p, idx) => {
        const tax = getCommandTaxonomy(p);
        const dDef = CAN_DO_DOMAIN_TAXONOMY[tax.domain] || { name: "System & Automation" };
        const subDef = (dDef.subdomains && dDef.subdomains[tax.subdomain]) ? dDef.subdomains[tax.subdomain].name : (p.category || "General");
        const groupLabel = `${dDef.name} — ${subDef}`;
        if (!domainMap.has(groupLabel)) domainMap.set(groupLabel, []);
        domainMap.get(groupLabel).push({ p, idx });
    });

    domainMap.forEach((items, groupLabel) => {
        html += `<optgroup label="${groupLabel}">`;
        items.forEach(({ p, idx }) => {
            const val = `b_${idx}`;
            html += `<option value="${val}" ${selectedIdxStr === val ? "selected" : ""}>${p.name}</option>`;
        });
        html += '</optgroup>';
    });
    return html;
}

function findMatchingActionPresetVal(data) {
    if (!data) return "";
    if (data.preset_val) return data.preset_val;
    const cats = getFilteredActionPresets();

    // 1. Check by explicit preset_name / preset_id
    if (data.preset_name || data.preset_id) {
        for (let cIdx = 0; cIdx < cats.length; cIdx++) {
            const cat = cats[cIdx];
            for (let pIdx = 0; pIdx < cat.presets.length; pIdx++) {
                const p = cat.presets[pIdx];
                if ((data.preset_id && p.id === data.preset_id) || (data.preset_name && (p.name === data.preset_name || p.name_imperial === data.preset_name))) {
                    return `${cIdx}:${pIdx}`;
                }
            }
        }
    }

    // 2. Smart Fingerprint Match: type / can_id / popup_message / precon_mode
    for (let cIdx = 0; cIdx < cats.length; cIdx++) {
        const cat = cats[cIdx];
        for (let pIdx = 0; pIdx < cat.presets.length; pIdx++) {
            const p = cat.presets[pIdx];
            if (p.type === "precondition" && data.type === "precondition") {
                if (p.precon_mode === (data.precon_mode || "persistent")) return `${cIdx}:${pIdx}`;
            }
            if (p.type === "climate_target" && (data.type === "climate_target" || data.target_temp_c !== undefined)) {
                return `${cIdx}:${pIdx}`;
            }
            if (p.type === "popup" && (data.type === "popup" || data.popup_message)) {
                if (p.popup_message && data.popup_message && (p.popup_message === data.popup_message || p.popup_message_imperial === data.popup_message)) {
                    return `${cIdx}:${pIdx}`;
                }
            }
            if (p.can_id && data.can_id && p.can_id.toLowerCase() === data.can_id.toLowerCase()) {
                if (p.popup_message && data.popup_message && p.popup_message === data.popup_message) {
                    return `${cIdx}:${pIdx}`;
                }
                if (p.options && Array.isArray(p.options) && data.payload) {
                    const hasMatchingPayload = p.options.some(o => o.payload && data.payload.includes(o.payload));
                    if (hasMatchingPayload) return `${cIdx}:${pIdx}`;
                }
            }
        }
    }
    return "";
}

function renderActPresetOptionsHTML(selectedValStr = "") {
    const isImperial = (getUnitSystem() === "imperial");
    const cats = getFilteredActionPresets();
    let html = '<option value="">-- Choose Pre-Configured Template (Optional) --</option>';
    cats.forEach((cat, catIdx) => {
        html += `<optgroup label="${cat.category}">`;
        cat.presets.forEach((p, pIdx) => {
            const val = `${catIdx}:${pIdx}`;
            const name = (isImperial && p.name_imperial) ? p.name_imperial : p.name;
            const isSelected = (selectedValStr === val || (selectedValStr && (selectedValStr === p.name || selectedValStr === p.id)));
            html += `<option value="${val}" data-name="${p.name}" ${isSelected ? "selected" : ""}>${name}</option>`;
        });
        html += '</optgroup>';
    });
    return html;
}

function findMatchingConditionPresetVal(data) {
    if (!data) return "";
    if (data.preset_val) return data.preset_val;
    const cats = getFilteredConditionPresets();
    if (data.preset_name || data.preset_id) {
        for (let cIdx = 0; cIdx < cats.length; cIdx++) {
            const cat = cats[cIdx];
            for (let pIdx = 0; pIdx < cat.presets.length; pIdx++) {
                const p = cat.presets[pIdx];
                if ((data.preset_id && p.id === data.preset_id) || (data.preset_name && p.name === data.preset_name)) {
                    return `${cIdx}:${pIdx}`;
                }
            }
        }
    }
    for (let cIdx = 0; cIdx < cats.length; cIdx++) {
        const cat = cats[cIdx];
        for (let pIdx = 0; pIdx < cat.presets.length; pIdx++) {
            const p = cat.presets[pIdx];
            if (p.type === "speed_zero" && data.type === "speed_zero") return `${cIdx}:${pIdx}`;
            if (p.can_id && data.can_id && p.can_id.toLowerCase() === data.can_id.toLowerCase()) {
                if (!p.match_payload || p.match_payload === data.match_payload) return `${cIdx}:${pIdx}`;
                if (p.options && Array.isArray(p.options) && data.match_payload) {
                    const hasMatch = p.options.some(o => o.match_payload === data.match_payload);
                    if (hasMatch) return `${cIdx}:${pIdx}`;
                }
            }
            if (p.type === "voltage" && data.type === "voltage" && p.voltage_val === data.voltage_val) return `${cIdx}:${pIdx}`;
            if (p.type === "day_of_week" && data.type === "day_of_week" && Array.isArray(p.days) && Array.isArray(data.days) && p.days.join() === data.days.join()) return `${cIdx}:${pIdx}`;
            if (p.type === "time_window" && data.type === "time_window" && p.start_time === data.start_time && p.end_time === data.end_time) return `${cIdx}:${pIdx}`;
        }
    }
    return "";
}

function renderCondPresetOptionsHTML(selectedValStr = "") {
    const cats = getFilteredConditionPresets();
    let html = '<option value="">-- Select from Catalog --</option>';
    cats.forEach((cat, catIdx) => {
        html += `<optgroup label="${cat.category}">`;
        cat.presets.forEach((p, pIdx) => {
            const val = `${catIdx}:${pIdx}`;
            const isSelected = (selectedValStr === val || (selectedValStr && (selectedValStr === p.name || selectedValStr === p.id)));
            html += `<option value="${val}" data-name="${p.name}" ${isSelected ? "selected" : ""}>${p.name}</option>`;
        });
        html += '</optgroup>';
    });
    return html;
}

function applyCanDoCondPreset(selectElem, notify = true) {
    const val = selectElem.value;
    const item = selectElem.closest(".can-do-condition-item");
    if (!item) return;
    if (!val) {
        const optionsBox = item.querySelector(".can-do-cond-options-container");
        if (optionsBox) {
            optionsBox.style.display = "none";
            optionsBox.innerHTML = "";
        }
        togglePresetToolbarButtons(item);
        return;
    }

    const parts = val.split(/[:_]/);
    const catIdx = parseInt(parts[0]);
    const pIdx = parseInt(parts[1]);

    const cats = getFilteredConditionPresets();
    const cat = cats[catIdx];
    const preset = cat?.presets[pIdx];
    if (!preset) return;

    if (preset.expression !== undefined) {
        const exp = item.querySelector(".can-do-cond-expr");
        if (exp) exp.value = preset.expression;
    }
    if (preset.can_id) {
        const cid = item.querySelector(".can-do-cond-can-id");
        if (cid) cid.value = preset.can_id;
    }
    if (preset.match_payload) {
        setByteGridString(item, "can-do-cond-can", preset.match_payload);
    }
    if (preset.voltage_val) {
        const vv = item.querySelector(".can-do-cond-voltage-val");
        if (vv) vv.value = preset.voltage_val;
    }
    if (preset.voltage_dir) {
        const vd = item.querySelector(".can-do-cond-voltage-dir");
        if (vd) vd.value = preset.voltage_dir;
    }
    if (preset.start_time) {
        const st = item.querySelector(".can-do-cond-start-time");
        if (st) st.value = preset.start_time;
    }
    if (preset.end_time) {
        const et = item.querySelector(".can-do-cond-end-time");
        if (et) et.value = preset.end_time;
    }
    if (preset.days && Array.isArray(preset.days)) {
        item.querySelectorAll(".can-do-cond-day").forEach(cb => {
            cb.checked = preset.days.includes(cb.value);
        });
    }
    if (preset.invert !== undefined) {
        const inv = item.querySelector(".can-do-cond-invert");
        if (inv) inv.checked = preset.invert;
    }

    // Check if preset has state options
    const optionsBox = item.querySelector(".can-do-cond-options-container");
    if (preset.options && Array.isArray(preset.options) && preset.options.length > 0) {
        const curPayload = getByteGridString(item, "can-do-cond-can");
        let activeOptIdx = -1;
        if (curPayload) {
            activeOptIdx = preset.options.findIndex(o => o.match_payload === curPayload);
        }
        if (activeOptIdx === -1) {
            activeOptIdx = Math.max(0, preset.options.findIndex(o => o.default === true));
        }
        if (optionsBox) {
            optionsBox.style.display = "block";
            const gridClass = preset.options.length > 4 ? "grid-many" : "grid-few";
            optionsBox.innerHTML = `
                            <div style="width: 100%;">
                                <div class="can-do-options-label">
                                    <span>Expected State:</span>
                                </div>
                                <div class="can-do-options-grid ${gridClass}">
                                    ${preset.options.map((opt, i) => {
                const isCur = (i === activeOptIdx);
                return `
                                        <button type="button" class="can-do-state-tile-btn can-do-cond-opt-pill-btn ${isCur ? 'active' : ''}" 
                                            onclick="applyCanDoCondOptionPill(this, ${catIdx}, ${pIdx}, ${i})">
                                            ${opt.label}
                                        </button>
                                        `;
            }).join("")}
                                </div>
                            </div>`;
        }
        const activeOpt = preset.options[activeOptIdx];
        if (activeOpt && activeOpt.match_payload) {
            setByteGridString(item, "can-do-cond-can", activeOpt.match_payload);
        }
    } else if (optionsBox) {
        optionsBox.style.display = "none";
        optionsBox.innerHTML = "";
    }

    item.dataset.presetType = preset.type || "param_range";
    if (notify) showNotification("Applied condition preset: " + preset.name, "blue", 2500);
    togglePresetToolbarButtons(item);
    const card = item.closest(".can-do-rule-card");
    if (card) updateCanDoRuleSummaryPill(card);
}

function applyCanDoCondOptionPill(btn, catIdx, pIdx, optIdx) {
    const item = btn.closest(".can-do-condition-item");
    if (!item) return;
    const cats = getFilteredConditionPresets();
    const preset = cats[catIdx]?.presets[pIdx];
    const opt = preset?.options ? preset.options[optIdx] : null;
    if (!opt) return;

    // Update active tile styling
    const box = item.querySelector(".can-do-cond-options-container");
    if (box) {
        box.querySelectorAll(".can-do-cond-opt-pill-btn").forEach((b, i) => {
            b.classList.toggle("active", i === optIdx);
            b.removeAttribute("style");
        });
    }

    // Apply payload match to byte grid
    if (opt.match_payload) {
        setByteGridString(item, "can-do-cond-can", opt.match_payload);
    }
    if (opt.expression !== undefined) {
        const exp = item.querySelector(".can-do-cond-expr");
        if (exp) exp.value = opt.expression;
    }

    showNotification(`Selected ${preset.name}: ${opt.label}`, "blue", 2500);
    const card = item.closest(".can-do-rule-card");
    if (card) updateCanDoRuleSummaryPill(card);
}

function applyCanDoTrigPreset(selectElem, notify = true) {
    const val = selectElem.value;
    const item = selectElem.closest(".can-do-trigger-item");
    if (!item) return;
    if (!val) {
        const optionsBox = item.querySelector(".can-do-trig-options-container");
        if (optionsBox) {
            optionsBox.style.display = "none";
            optionsBox.innerHTML = "";
        }
        togglePresetToolbarButtons(item);
        return;
    }

    const { builtIn, custom } = getFilteredTriggerPresets();
    let preset = null;
    let pType = "";
    let pIdx = 0;
    if (val.startsWith("c_")) {
        pIdx = parseInt(val.replace("c_", ""));
        preset = custom[pIdx];
        pType = "c";
    } else if (val.startsWith("b_")) {
        pIdx = parseInt(val.replace("b_", ""));
        preset = builtIn[pIdx];
        pType = "b";
    }

    if (preset) {
        if (preset.can_id) {
            const cid = item.querySelector(".can-do-trig-can-id");
            if (cid) cid.value = preset.can_id;
        }
        if (preset.bus !== undefined) {
            const b = item.querySelector(".can-do-trig-bus");
            if (b) b.value = preset.bus.toString();
        }
        if (preset.from_payload !== undefined) {
            setByteGridString(item, "can-do-trig-from", preset.from_payload);
        }
        if (preset.to_payload !== undefined) {
            setByteGridString(item, "can-do-trig-to", preset.to_payload);
        }
        if (preset.id) {
            const idInput = item.querySelector(".can-do-trig-id");
            if (idInput) idInput.value = preset.id;
        }
        if (preset.click_count !== undefined) {
            const cc = item.querySelector(".can-do-trig-click-count");
            if (cc) cc.value = preset.click_count.toString();
        }

        // Check if preset has state options
        const optionsBox = item.querySelector(".can-do-trig-options-container");
        if (preset.options && Array.isArray(preset.options) && preset.options.length > 0) {
            const curTo = getByteGridString(item, "can-do-trig-to");
            const curFrom = getByteGridString(item, "can-do-trig-from");
            let activeOptIdx = -1;
            if (curTo || curFrom) {
                activeOptIdx = preset.options.findIndex(o =>
                    (o.to_payload !== undefined && o.to_payload === curTo) ||
                    (o.from_payload !== undefined && o.from_payload === curFrom)
                );
            }
            if (activeOptIdx === -1) {
                activeOptIdx = Math.max(0, preset.options.findIndex(o => o.default === true));
            }
            if (optionsBox) {
                optionsBox.style.display = "block";
                const gridClass = preset.options.length > 4 ? "grid-many" : "grid-few";
                optionsBox.innerHTML = `
                                <div style="width: 100%;">
                                    <div class="can-do-options-label">
                                        <span>State Event:</span>
                                    </div>
                                    <div class="can-do-options-grid ${gridClass}">
                                        ${preset.options.map((opt, i) => {
                    const isCur = (i === activeOptIdx);
                    return `
                                            <button type="button" class="can-do-state-tile-btn can-do-trig-opt-pill-btn ${isCur ? 'active' : ''}"
                                                onclick="applyCanDoTrigOptionPill(this, '${pType}', ${pIdx}, ${i})">
                                                ${opt.label}
                                            </button>
                                            `;
                }).join("")}
                                    </div>
                                </div>`;
            }
            const activeOpt = preset.options[activeOptIdx];
            if (activeOpt) {
                if (activeOpt.from_payload !== undefined) setByteGridString(item, "can-do-trig-from", activeOpt.from_payload);
                if (activeOpt.to_payload !== undefined) setByteGridString(item, "can-do-trig-to", activeOpt.to_payload);
            }
        } else if (optionsBox) {
            optionsBox.style.display = "none";
            optionsBox.innerHTML = "";
        }

        if (notify) showNotification("Applied trigger preset: " + preset.name, "blue", 2500);
        const card = item.closest(".can-do-rule-card");
        if (card) {
            updateCanDoRuleTriggerDropdowns(card);
            updateCanDoRuleSummaryPill(card);
        }
    }
    togglePresetToolbarButtons(item);
}

function applyCanDoTrigOptionPill(btn, pType, pIdx, optIdx) {
    const item = btn.closest(".can-do-trigger-item");
    if (!item) return;
    const { builtIn, custom } = getFilteredTriggerPresets();
    const preset = (pType === "c") ? custom[pIdx] : builtIn[pIdx];
    const opt = preset?.options ? preset.options[optIdx] : null;
    if (!opt) return;

    // Update active tile styling
    const box = item.querySelector(".can-do-trig-options-container");
    if (box) {
        box.querySelectorAll(".can-do-trig-opt-pill-btn").forEach((b, i) => {
            b.classList.toggle("active", i === optIdx);
            b.removeAttribute("style");
        });
    }

    // Apply payloads to byte grids
    if (opt.from_payload !== undefined) setByteGridString(item, "can-do-trig-from", opt.from_payload);
    if (opt.to_payload !== undefined) setByteGridString(item, "can-do-trig-to", opt.to_payload);

    showNotification(`Selected ${preset.name}: ${opt.label}`, "blue", 2500);
    const card = item.closest(".can-do-rule-card");
    if (card) {
        updateCanDoRuleTriggerDropdowns(card);
        updateCanDoRuleSummaryPill(card);
    }
}

function togglePresetToolbarButtons(item) {
    if (!item) return;
    const picker = item.querySelector(".can-do-trig-preset-picker, .can-do-cond-preset-picker, .can-do-act-preset-picker");
    if (!picker) return;
    const val = picker.value || "";
    const selOpt = picker.selectedOptions[0];
    const isCustom = val.startsWith("c_") || (selOpt && selOpt.parentElement && selOpt.parentElement.label && selOpt.parentElement.label.includes("Custom"));
    const editBtn = item.querySelector(".can-do-edit-preset-btn");
    const delBtn = item.querySelector(".can-do-del-preset-btn");

    if (editBtn) {
        editBtn.style.display = "inline-flex";
        const isOpen = item.dataset.detailsOpen === "true";
        editBtn.innerHTML = isOpen ? "Hide Details" : "Edit Details";
    }
    if (delBtn) {
        delBtn.style.display = isCustom ? "inline-flex" : "none";
    }
}

function toggleCanDoItemDetails(btn) {
    const item = btn.closest(".can-do-action-item, .can-do-trigger-item, .can-do-condition-item");
    if (!item) return;

    const isAction = item.classList.contains("can-do-action-item");
    const isTrigger = item.classList.contains("can-do-trigger-item");
    const isCondition = item.classList.contains("can-do-condition-item");

    const isCurrentlyOpen = item.dataset.detailsOpen === "true";
    const newOpen = !isCurrentlyOpen;
    item.dataset.detailsOpen = newOpen ? "true" : "false";

    btn.innerHTML = newOpen ? "Hide Details" : "Edit Details";

    if (isAction) {
        const actType = item.querySelector(".can-do-act-type")?.value || "preset";
        if (actType === "preset") {
            const picker = item.querySelector(".can-do-act-preset-picker");
            const val = picker?.value || "";
            const parts = val.split(/[:_]/);
            const cats = getFilteredActionPresets();
            const preset = cats[parseInt(parts[0])]?.presets[parseInt(parts[1])];

            const showClimate = preset && (preset.type === "climate_target" || preset.target_temp_c !== undefined || preset.target_temp_f !== undefined);
            const showPrecon = newOpen && preset && (preset.type === "precondition" || preset.precon_mode !== undefined);
            const showCan = newOpen && preset && (preset.type === "can_tx" || preset.can_id !== undefined || preset.steps !== undefined || (preset.options && preset.options.some(o => o.payload)));
            const showPopup = newOpen && preset && (preset.type === "popup" || preset.popup_message !== undefined || (preset.options && preset.options.some(o => o.popup)));
            const showGeneral = newOpen && (!preset || (!showClimate && !showPrecon));

            item.querySelectorAll(".act-field-climate").forEach(el => el.classList.toggle("hidden", !showClimate));
            item.querySelectorAll(".act-field-precon").forEach(el => el.classList.toggle("hidden", !showPrecon));
            item.querySelectorAll(".act-field-can").forEach(el => el.classList.toggle("hidden", !(showCan || showGeneral)));
            item.querySelectorAll(".act-field-popup").forEach(el => el.classList.toggle("hidden", !(showPopup || showGeneral)));
        }
    } else if (isTrigger) {
        const trigSource = item.querySelector(".can-do-trig-source")?.value || "preset";
        if (trigSource === "preset") {
            // Only show/hide the "detail" rows (Bus, byte grids) — not the CAN ID row
            item.querySelectorAll(".trig-preset-detail").forEach(el => el.classList.toggle("hidden", !newOpen));
        }
    } else if (isCondition) {
        const condType = item.querySelector(".can-do-cond-type")?.value || "preset";
        if (condType === "preset") {
            const presetType = item.dataset.presetType || "param_range";
            item.querySelectorAll(".cond-field-expr").forEach(el => el.classList.toggle("hidden", !(newOpen && presetType === "param_range")));
            item.querySelectorAll(".cond-field-can").forEach(el => el.classList.toggle("hidden", !(newOpen && presetType === "can_state")));
            item.querySelectorAll(".cond-field-volt").forEach(el => el.classList.toggle("hidden", !(newOpen && presetType === "voltage")));
            item.querySelectorAll(".cond-field-days").forEach(el => el.classList.toggle("hidden", !(newOpen && presetType === "day_of_week")));
            item.querySelectorAll(".cond-field-time").forEach(el => el.classList.toggle("hidden", !(newOpen && presetType === "time_window")));
        }
    }
}

function updateCustomTrigPreset(btn) {
    const item = btn.closest(".can-do-trigger-item");
    if (!item) return;
    const picker = item.querySelector(".can-do-trig-preset-picker");
    const val = picker?.value || "";
    const customList = getCustomTrigPresets();

    let idx = -1;
    let defaultName = "Custom Trigger";
    if (val.startsWith("c_")) {
        idx = parseInt(val.replace("c_", ""));
        if (customList[idx]) defaultName = customList[idx].name;
    } else if (val.startsWith("b_")) {
        const { builtIn } = getFilteredTriggerPresets();
        const bIdx = parseInt(val.replace("b_", ""));
        if (builtIn[bIdx]) defaultName = builtIn[bIdx].name + " (Custom)";
    }

    const name = prompt("Enter name to save/update custom trigger preset:", defaultName);
    if (!name || !name.trim()) return;

    const canId = item.querySelector(".can-do-trig-can-id")?.value.trim() || "0x448";
    const bus = parseInt(item.querySelector(".can-do-trig-bus")?.value || "0");
    const toPayload = getByteGridString(item, "can-do-trig-to");
    const fromPayload = getByteGridString(item, "can-do-trig-from");

    const newPreset = {
        id: name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        name: name.trim(),
        can_id: canId,
        bus: bus,
        to_payload: toPayload,
        from_payload: fromPayload
    };

    if (idx >= 0 && idx < customList.length) {
        customList[idx] = newPreset;
    } else {
        customList.push(newPreset);
        idx = customList.length - 1;
    }

    localStorage.setItem("wican_custom_trig_presets", JSON.stringify(customList));
    refreshAllCanDoPresetDropdowns();
    picker.value = `c_${idx}`;
    togglePresetToolbarButtons(item);
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
    showNotification("✓ Saved custom trigger preset: " + name, "green", 3000);
}

function deleteCustomTrigPreset(btn) {
    const item = btn.closest(".can-do-trigger-item");
    if (!item) return;
    const picker = item.querySelector(".can-do-trig-preset-picker");
    const val = picker?.value || "";
    if (!val.startsWith("c_")) return;
    const idx = parseInt(val.replace("c_", ""));
    const customList = getCustomTrigPresets();
    const current = customList[idx];
    if (!current) return;

    if (!confirm(`Delete custom trigger preset "${current.name}"?`)) return;

    customList.splice(idx, 1);
    localStorage.setItem("wican_custom_trig_presets", JSON.stringify(customList));
    refreshAllCanDoPresetDropdowns();
    picker.value = "";
    togglePresetToolbarButtons(item);
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
    showNotification("Deleted custom trigger preset.", "blue", 3000);
}

function updateCustomCondPreset(btn) {
    const item = btn.closest(".can-do-condition-item");
    if (!item) return;
    const picker = item.querySelector(".can-do-cond-preset-picker");
    const val = picker?.value || "";
    const customList = getCustomCondPresets();

    let customIdx = -1;
    let defaultName = "Custom Condition";
    if (val) {
        const parts = val.split(/[:_]/);
        const catIdx = parseInt(parts[0]);
        const pIdx = parseInt(parts[1]);
        const cats = getFilteredConditionPresets();
        const cat = cats[catIdx];
        if (cat) {
            if (cat.category.includes("Custom") && customList[pIdx]) {
                customIdx = pIdx;
                defaultName = customList[pIdx].name;
            } else if (cat.presets[pIdx]) {
                defaultName = cat.presets[pIdx].name + " (Custom)";
            }
        }
    }

    const name = prompt("Enter name to save/update custom condition preset:", defaultName);
    if (!name || !name.trim()) return;

    const condType = item.querySelector(".can-do-cond-type")?.value || "param_range";
    const days = [];
    item.querySelectorAll(".can-do-cond-day:checked").forEach(cb => days.push(cb.value));

    const presetObj = {
        id: "custom_" + name.toLowerCase().replace(/[^a-z0-9_]/g, "_") + "_" + Date.now().toString().slice(-4),
        name: name.trim(),
        category: "My Saved Conditions",
        type: condType === "preset" ? (item.dataset.presetType || "param_range") : condType,
        invert: item.querySelector(".can-do-cond-invert")?.checked || false,
        expression: item.querySelector(".can-do-cond-expr")?.value || "",
        can_id: item.querySelector(".can-do-cond-can-id")?.value || "",
        match_payload: getByteGridString(item, "can-do-cond-can"),
        days: days,
        start_time: item.querySelector(".can-do-cond-start-time")?.value || "",
        end_time: item.querySelector(".can-do-cond-end-time")?.value || "",
        voltage_val: item.querySelector(".can-do-cond-voltage-val")?.value || "",
        voltage_dir: item.querySelector(".can-do-cond-voltage-dir")?.value || "above"
    };

    if (customIdx >= 0 && customIdx < customList.length) {
        customList[customIdx] = presetObj;
    } else {
        customList.push(presetObj);
        customIdx = customList.length - 1;
    }

    localStorage.setItem("wican_custom_cond_presets", JSON.stringify(customList));
    refreshAllCanDoPresetDropdowns();
    const newCats = getFilteredConditionPresets();
    const customCatIdx = newCats.findIndex(c => c.category.includes("Custom"));
    if (customCatIdx !== -1) {
        picker.value = `${customCatIdx}:${customIdx}`;
    }
    togglePresetToolbarButtons(item);
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
    showNotification("✓ Saved custom condition preset: " + name, "green", 3000);
}

function deleteCustomCondPreset(btn) {
    const item = btn.closest(".can-do-condition-item");
    if (!item) return;
    const picker = item.querySelector(".can-do-cond-preset-picker");
    const val = picker?.value || "";
    if (!val) return;
    const parts = val.split(/[:_]/);
    const catIdx = parseInt(parts[0]);
    const pIdx = parseInt(parts[1]);
    const cats = getFilteredConditionPresets();
    const cat = cats[catIdx];
    if (!cat || !cat.category.includes("Custom")) return;

    const customList = getCustomCondPresets();
    const current = customList[pIdx];
    if (!current) return;

    if (!confirm(`Delete custom condition preset "${current.name}"?`)) return;

    customList.splice(pIdx, 1);
    localStorage.setItem("wican_custom_cond_presets", JSON.stringify(customList));
    refreshAllCanDoPresetDropdowns();
    picker.value = "";
    togglePresetToolbarButtons(item);
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
    showNotification("Deleted custom condition preset.", "blue", 3000);
}

function updateCustomActPreset(btn) {
    const item = btn.closest(".can-do-action-item");
    if (!item) return;
    const picker = item.querySelector(".can-do-act-preset-picker");
    const val = picker?.value || "";
    const customList = getCustomActPresets();

    let customIdx = -1;
    let defaultName = "Custom Action";
    if (val) {
        const parts = val.split(/[:_]/);
        const catIdx = parseInt(parts[0]);
        const pIdx = parseInt(parts[1]);
        const cats = getFilteredActionPresets();
        const cat = cats[catIdx];
        if (cat) {
            if (cat.category.includes("Custom") && customList[pIdx]) {
                customIdx = pIdx;
                defaultName = customList[pIdx].name;
            } else if (cat.presets[pIdx]) {
                defaultName = cat.presets[pIdx].name + " (Custom)";
            }
        }
    }

    const name = prompt("Enter name to save/update custom action template:", defaultName);
    if (!name || !name.trim()) return;

    const actData = extractCanDoActionData(item);
    actData.name = name.trim();

    if (customIdx >= 0 && customIdx < customList.length) {
        customList[customIdx] = actData;
    } else {
        customList.push(actData);
        customIdx = customList.length - 1;
    }

    localStorage.setItem("wican_custom_act_presets", JSON.stringify(customList));
    refreshAllCanDoPresetDropdowns();
    const newCats = getFilteredActionPresets();
    const customCatIdx = newCats.findIndex(c => c.category.includes("Custom"));
    if (customCatIdx !== -1) {
        picker.value = `${customCatIdx}:${customIdx}`;
    }
    togglePresetToolbarButtons(item);
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
    showNotification("✓ Saved custom action template: " + name, "green", 3000);
}

function deleteCustomActPreset(btn) {
    const item = btn.closest(".can-do-action-item");
    if (!item) return;
    const picker = item.querySelector(".can-do-act-preset-picker");
    const val = picker?.value || "";
    if (!val) return;
    const parts = val.split(/[:_]/);
    const catIdx = parseInt(parts[0]);
    const pIdx = parseInt(parts[1]);
    const cats = getFilteredActionPresets();
    const cat = cats[catIdx];
    if (!cat || !cat.category.includes("Custom")) return;

    const customList = getCustomActPresets();
    const current = customList[pIdx];
    if (!current) return;

    if (!confirm(`Delete custom action template "${current.name}"?`)) return;

    customList.splice(pIdx, 1);
    localStorage.setItem("wican_custom_act_presets", JSON.stringify(customList));
    refreshAllCanDoPresetDropdowns();
    picker.value = "";
    togglePresetToolbarButtons(item);
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
    showNotification("Deleted custom action template.", "blue", 3000);
}

function testCanDoTriggerUI(btn) {
    const item = btn.closest(".can-do-trigger-item");
    if (!item) return;
    const source = item.querySelector(".can-do-trig-source")?.value || "can_msg";
    const canId = item.querySelector(".can-do-trig-can-id")?.value.trim() || "0x448";
    const bus = parseInt(item.querySelector(".can-do-trig-bus")?.value || "0");
    const toPayload = getByteGridString(item, "can-do-trig-to");
    const fromPayload = getByteGridString(item, "can-do-trig-from");
    const id = item.querySelector(".can-do-trig-id")?.value.trim() || "";

    const originalText = btn.textContent;
    btn.textContent = "Simulating...";
    btn.disabled = true;

    const trigData = {
        source: source,
        id: id,
        can_id: canId,
        bus: bus,
        to_payload: toPayload,
        from_payload: fromPayload
    };

    fetch("/simulate_can_do_trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trigData)
    }).then(res => {
        if (!res.ok) {
            return fetch("/test_can_do_action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "can_tx",
                    can_id: canId,
                    bus: bus,
                    payload: toPayload || "00 00 00 00 00 00 00 00",
                    steps: [{ payload: toPayload || "00 00 00 00 00 00 00 00", repeat: 3 }]
                })
            });
        }
        return res.text();
    }).then(res => {
        btn.textContent = "✓ Fired!";
        btn.classList.remove("btn-running");
        btn.classList.add("btn-success");
        showNotification(`Trigger simulated! (${canId} / ${toPayload || "event"})`, "green", 3500);
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("btn-success");
            btn.disabled = false;
        }, 2000);
    }).catch(err => {
        btn.textContent = "✕ Error";
        btn.classList.remove("btn-running");
        btn.classList.add("btn-error");
        showNotification("Failed to simulate trigger: " + err, "red", 4000);
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("btn-error");
            btn.disabled = false;
        }, 2000);
    });
}

function testCanDoConditionUI(btn) {
    const item = btn.closest(".can-do-condition-item");
    if (!item) return;
    const condData = extractCanDoConditionElement(item);
    const originalText = btn.textContent;
    btn.textContent = "Testing...";
    btn.classList.add("btn-running");
    btn.disabled = true;

    fetch("/test_can_do_condition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(condData)
    }).then(res => {
        if (res.ok) return res.json();
        throw new Error("HTTP " + res.status);
    }).then(data => {
        const isPass = data.result === true || data.pass === true || data.status === "pass";
        btn.textContent = isPass ? "✓ TRUE (PASS)" : "✕ FALSE (FAIL)";
        btn.classList.remove("btn-running");
        btn.classList.add(isPass ? "btn-success" : "btn-error");
        showNotification(
            (isPass ? "✓ Condition PASSED: " : "✕ Condition FAILED: ") + (data.message || (isPass ? "Condition satisfied" : "Condition not met")),
            isPass ? "green" : "orange",
            4000
        );
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("btn-success", "btn-error");
            btn.disabled = false;
        }, 3000);
    }).catch(err => {
        let localPass = true;
        let msg = "";
        const now = new Date();
        if (condData.type === "day_of_week") {
            const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
            const curDay = dayMap[now.getDay()];
            localPass = Array.isArray(condData.days) && condData.days.includes(curDay);
            msg = `Current day is ${curDay.toUpperCase()} (${localPass ? "matches" : "not in list"})`;
        } else if (condData.type === "time_window") {
            const curMin = now.getHours() * 60 + now.getMinutes();
            const [sh, sm] = (condData.start_time || "00:00").split(":").map(Number);
            const [eh, em] = (condData.end_time || "23:59").split(":").map(Number);
            const sMin = sh * 60 + (sm || 0);
            const eMin = eh * 60 + (em || 0);
            if (sMin <= eMin) localPass = (curMin >= sMin && curMin <= eMin);
            else localPass = (curMin >= sMin || curMin <= eMin);
            msg = `Current time is ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} (${localPass ? "within" : "outside"} window)`;
        } else if (condData.type === "speed_zero") {
            localPass = true;
            msg = "Speed == 0 (Vehicle Parked)";
        } else {
            msg = `Condition (${condData.type}) live telemetry check simulated`;
        }

        if (condData.invert) {
            localPass = !localPass;
            msg += " (Inverted NOT)";
        }

        btn.textContent = localPass ? "✓ TRUE (PASS)" : "✕ FALSE (FAIL)";
        btn.classList.remove("btn-running");
        btn.classList.add(localPass ? "btn-success" : "btn-error");
        showNotification((localPass ? "✓ " : "✕ ") + msg, localPass ? "green" : "orange", 3500);
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("btn-success", "btn-error");
            btn.disabled = false;
        }, 3000);
    });
}

function refreshAllCanDoPresetDropdowns() {
    document.querySelectorAll(".can-do-trig-preset-picker").forEach(picker => {
        const curVal = picker.value;
        picker.innerHTML = renderTrigPresetOptionsHTML(curVal);
    });
    document.querySelectorAll(".can-do-act-preset-picker").forEach(picker => {
        const curVal = picker.value || picker.getAttribute("data-selected-preset") || "";
        picker.innerHTML = renderActPresetOptionsHTML(curVal);
    });
    document.querySelectorAll(".can-do-cond-preset-picker").forEach(picker => {
        const curVal = picker.value || picker.getAttribute("data-selected-preset") || "";
        picker.innerHTML = renderCondPresetOptionsHTML(curVal);
    });
}

function saveCurrentTriggerAsPreset(btn) {
    const item = btn.closest(".can-do-trigger-item");
    if (!item) return;
    const canId = item.querySelector(".can-do-trig-can-id")?.value.trim() || "0x448";
    const bus = parseInt(item.querySelector(".can-do-trig-bus")?.value || "0");
    const toPayload = getByteGridString(item, "can-do-trig-to");
    const fromPayload = getByteGridString(item, "can-do-trig-from");

    const defaultName = item.querySelector(".can-do-trig-id")?.value.trim() || "Custom Button";
    const name = prompt("Enter a name for this custom trigger preset:", defaultName);
    if (!name || !name.trim()) return;

    saveCustomTrigPreset({
        id: name.toLowerCase().replace(/\s+/g, "_"),
        name: name.trim(),
        can_id: canId,
        bus: bus,
        to_payload: toPayload,
        from_payload: fromPayload
    });

    showNotification("Saved custom trigger preset: " + name, "green", 3500);
}

function saveCurrentActionAsPreset(btn) {
    const item = btn.closest(".can-do-action-item");
    if (!item) return;
    const actData = extractCanDoActionData(item);
    const name = prompt("Enter a name for this custom action template:", "My Action Template");
    if (!name || !name.trim()) return;

    actData.name = name.trim();
    saveCustomActPreset(actData);

    showNotification("Saved custom action template: " + name, "green", 3500);
}

function autoSaveCanDoRules(notifyText, color = "green") {
    let rules = [];
    const cards = document.querySelectorAll("#can_do_rules_container .can-do-rule-card");
    cards.forEach(card => {
        const ruleData = extractCanDoRuleData(card);
        if (ruleData) rules.push(ruleData);
    });
    if (rules.length === 0 && window._cachedCanDoRules && window._cachedCanDoRules.length > 0) {
        rules = window._cachedCanDoRules;
    }

    fetch("/store_can_do", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            settings: getCanDoDeviceSettings(),
            rules: rules
        })
    }).then(res => res.text()).then(msg => {
        if (notifyText) {
            showNotification(notifyText, color, 2500);
        }
    }).catch(err => {
        showNotification("Failed to save CAN Do: " + err, "red");
    });
}

function updateCanDoRuleStatusToggle(cb) {
    const card = cb.closest(".can-do-rule-card");
    const label = cb.closest(".can-do-toggle-switch");
    const isChecked = cb.checked;

    if (label) {
        const track = label.querySelector(".can-do-toggle-track");
        if (track) {
            track.classList.toggle("active", isChecked);
            track.classList.toggle("paused", !isChecked);
        }
        label.title = isChecked ? "Active (Click to pause)" : "Paused (Click to activate)";
    }

    if (card) {
        const badge = card.querySelector(".can-do-activity-badge");
        if (badge) {
            badge.className = "can-do-activity-badge " + (isChecked ? "idle" : "paused");
            badge.textContent = isChecked ? "Idle" : "Paused";
            badge.title = isChecked ? "Live trigger activity" : "Automation paused";
        }
        const nameVal = card.querySelector(".can-do-name")?.value || "CAN Do";
        autoSaveCanDoRules(`"${nameVal}" is now ${isChecked ? 'Active' : 'Paused'}`, isChecked ? "green" : "blue");
    }
}

function toggleCanDoSection(headerElem) {
    const sectionBox = headerElem.closest(".can-do-section-box, .ha-form-card");
    if (!sectionBox) return;

    // Target items container or settings table / form grid
    const itemsContainer = sectionBox.querySelector(".can-do-triggers-container, .can-do-conditions-container, .can-do-actions-container, .can-do-off-actions-container, .ha-form-grid, .compact-form-table");
    const bannerSlot = sectionBox.querySelector(".can-do-choose-banner-slot");
    const chevron = sectionBox.querySelector(".can-do-sec-chevron");
    if (!itemsContainer) return;

    const isHidden = itemsContainer.classList.contains("hidden") || itemsContainer.style.display === "none";
    if (isHidden) {
        itemsContainer.classList.remove("hidden");
        itemsContainer.style.display = "";
        if (bannerSlot) bannerSlot.style.display = "";
        if (chevron) chevron.textContent = "▼";
    } else {
        // Check if section is empty (0 items) - already minimal size
        const countBadge = sectionBox.querySelector(".can-do-trig-count-badge, .can-do-cond-count-badge, .can-do-act-count-badge");
        if (countBadge && parseInt(countBadge.textContent || "0") === 0 && !sectionBox.classList.contains("ha-form-card")) {
            return;
        }
        itemsContainer.classList.add("hidden");
        itemsContainer.style.display = "none";
        if (bannerSlot) bannerSlot.style.display = "none";
        if (chevron) chevron.textContent = "▶";
    }
}

function toggleCanDoExecModeUI(selectElem) {
    const card = selectElem.closest(".can-do-rule-card");
    if (!card) return;
    const mode = selectElem.value;
    const isToggle = (mode === "toggle");
    const isOneShot = (mode === "one_shot");
    const isPollVerify = (mode === "poll_verify");

    card.querySelectorAll(".can-do-latch-row").forEach(row => {
        const show = isOneShot || isPollVerify;
        row.classList.toggle("hidden", !show);
        row.style.display = show ? "" : "none";
    });
    card.querySelectorAll(".can-do-verify-row").forEach(row => {
        const show = isPollVerify;
        row.classList.toggle("hidden", !show);
        row.style.display = show ? "" : "none";
    });
    card.querySelectorAll(".can-do-toggle-revert-row").forEach(row => {
        const show = isToggle;
        row.classList.toggle("hidden", !show);
        row.style.display = show ? "" : "none";
    });
    card.querySelectorAll(".can-do-off-actions-section").forEach(sec => {
        sec.classList.toggle("hidden", !isToggle);
        sec.style.display = isToggle ? "" : "none";
    });

    const onHeaderTitle = card.querySelector(".can-do-on-actions-title");
    if (onHeaderTitle) {
        onHeaderTitle.textContent = isToggle ? "Actions (When Activated)" : "Actions";
    }
}

function toggleCanDoExecModeDetails(btn) {
    const card = btn.closest(".can-do-rule-card");
    if (!card) return;
    const detailsWrap = card.querySelector(".can-do-exec-mode-details-wrap");
    if (!detailsWrap) return;
    const isHidden = detailsWrap.classList.contains("hidden") || detailsWrap.style.display === "none";
    if (isHidden) {
        detailsWrap.classList.remove("hidden");
        detailsWrap.style.display = "flex";
        btn.innerHTML = "<span>Hide Settings</span>";
    } else {
        detailsWrap.classList.add("hidden");
        detailsWrap.style.display = "none";
        btn.innerHTML = "<span>Safeguard Settings</span>";
    }
}

function addCanDoRuleUI(ruleData = {}, isCollapsed = true, shouldScroll = false, isNew = false) {
    const container = document.getElementById("can_do_rules_container");
    if (!container) return;

    const ruleDiv = document.createElement("div");
    ruleDiv.className = "pid-entry can-do-rule-card";
    ruleDiv.style.borderRadius = "var(--m3-shape-lg)";
    ruleDiv.style.padding = "1.35rem";
    ruleDiv.style.marginBottom = "1.5rem";
    ruleDiv.style.boxShadow = "var(--shadow-sm)";

    ruleDiv.dataset.haExpose = (ruleData.ha_expose !== false) ? "true" : "false";
    ruleDiv.dataset.haIcon = ruleData.ha_icon || "mdi:car-defrost-rear";

    const isEnabled = ruleData.enabled !== false;

    // The template stamps out the frame with empty container slots:
    // .can-do-triggers-container, .can-do-conditions-container, .can-do-actions-container
    ruleDiv.innerHTML = `
                    <div class="pid-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; cursor: pointer;" onclick="handleCanDoHeaderClick(event, this)">
                        <div class="header-left" style="display: flex; flex-direction: column; gap: 0.3rem; flex-grow: 1; margin-right: 0.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="can-do-activity-badge ${isEnabled ? 'idle' : 'paused'}" style="padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; font-family: monospace; transition: all 0.3s; white-space: nowrap;">${isEnabled ? 'Idle' : 'Paused'}</span>
                                <div class="can-do-name-wrapper" style="position: relative; display: flex; align-items: center; flex-grow: 1; max-width: 440px;">
                                    <input type="text" class="can-do-name" value="${ruleData.name || "New CAN Do"}" placeholder="CAN Do Name" onclick="event.stopPropagation();">
                                </div>
                            </div>
                            <div class="can-do-summary-pill" style="margin-left: 2rem; font-size: 0.76rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;"></div>
                        </div>
                        <div class="header-right" style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0;">
                            <label class="can-do-toggle-switch" onclick="event.stopPropagation();">
                                <input type="checkbox" class="can-do-rule-enabled" ${isEnabled ? "checked" : ""} onchange="updateCanDoRuleStatusToggle(this)">
                                <span class="can-do-toggle-track ${isEnabled ? 'active' : 'paused'}">
                                    <span class="can-do-toggle-thumb"></span>
                                </span>
                            </label>
                            <button type="button" class="system-button can-do-btn-move" onclick="event.stopPropagation(); moveCanDoRule(this, -1);">▲</button>
                            <button type="button" class="system-button can-do-btn-move" onclick="event.stopPropagation(); moveCanDoRule(this, 1);">▼</button>
                            <button type="button" class="system-button can-do-btn-more" onclick="showCanDoRuleHeaderMenu(this, event);">⋮</button>
                        </div>
                    </div>

                    <div class="can-do-rule-body ${isCollapsed ? "hidden" : ""}" style="${isCollapsed ? "display: none;" : ""}">
                        <div class="ha-form-card">
                            <div class="ha-form-card-header" onclick="toggleCanDoSection(this)" style="cursor: pointer; user-select: none;">
                                <div class="ha-form-card-title">
                                    <span class="can-do-sec-chevron">▼</span>
                                    <span>Execution Mode &amp; Safeguards</span>
                                </div>
                            </div>
                            <div class="can-do-section-body">
                                <div class="ha-form-grid">
                                    <div class="ha-form-row">
                                        <div class="ha-form-label-col">
                                            <span class="ha-form-label">Execution Mode</span>
                                        </div>
                                        <div class="ha-form-control-col">
                                            <select class="ha-form-select can-do-exec-mode" onchange="toggleCanDoExecModeUI(this)">
                                                <option value="on_change" ${(!ruleData.exec_mode || ruleData.exec_mode === "on_change") ? "selected" : ""}>Edge-Triggered (On Change)</option>
                                                <option value="toggle" ${ruleData.exec_mode === "toggle" ? "selected" : ""}>Toggle</option>
                                                <option value="one_shot" ${ruleData.exec_mode === "one_shot" ? "selected" : ""}>One-Shot &amp; Latch</option>
                                                <option value="continuous" ${ruleData.exec_mode === "continuous" ? "selected" : ""}>Continuous</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Triggers Section -->
                        <div class="can-do-section-box trig-section">
                            <div class="can-do-section-title-wrap" onclick="toggleCanDoSection(this)">
                                <div class="can-do-section-title">
                                    <span class="can-do-sec-chevron">▼</span>
                                    <span class="can-do-ha-pill trig-pill">When</span>
                                    <span>Triggers</span>
                                    <span class="can-do-trig-count-badge">0</span>
                                </div>
                            </div>
                            <div class="can-do-section-body">
                                <div class="can-do-triggers-container can-do-tree-connect"></div>
                                <button type="button" class="ha-section-add-btn accent-trig" onclick="openAddAutomationElementDialog('trigger', this.closest('.can-do-section-box').querySelector('.can-do-triggers-container'), this.closest('.can-do-rule-card'))">
                                    <svg><use href="#icon-plus"/></svg>
                                    <span>Add Trigger</span>
                                </button>
                            </div>
                        </div>

                        <!-- Conditions Section -->
                        <div class="can-do-section-box cond-section">
                            <div class="can-do-section-title-wrap" onclick="toggleCanDoSection(this)">
                                <div class="can-do-section-title">
                                    <span class="can-do-sec-chevron">▼</span>
                                    <span class="can-do-ha-pill cond-pill">And if</span>
                                    <span>Conditions</span>
                                    <span class="can-do-cond-count-badge">0</span>
                                </div>
                            </div>
                            <div class="can-do-section-body">
                                <div class="can-do-conditions-container can-do-tree-connect"></div>
                                <button type="button" class="ha-section-add-btn accent-cond" onclick="openAddAutomationElementDialog('condition', this.closest('.can-do-section-box').querySelector('.can-do-conditions-container'), this.closest('.can-do-rule-card'))">
                                    <svg><use href="#icon-plus"/></svg>
                                    <span>Add Condition</span>
                                </button>
                            </div>
                        </div>

                        <!-- Actions Section -->
                        <div class="can-do-section-box act-section">
                            <div class="can-do-section-title-wrap" onclick="toggleCanDoSection(this)">
                                <div class="can-do-section-title">
                                    <span class="can-do-sec-chevron">▼</span>
                                    <span class="can-do-ha-pill act-pill">Then do</span>
                                    <span>Actions</span>
                                    <span class="can-do-act-count-badge">0</span>
                                </div>
                            </div>
                            <div class="can-do-section-body">
                                <div class="can-do-actions-container can-do-tree-connect"></div>
                                <button type="button" class="ha-section-add-btn accent-act" onclick="openAddAutomationElementDialog('action', this.closest('.can-do-section-box').querySelector('.can-do-actions-container'), this.closest('.can-do-rule-card'))">
                                    <svg><use href="#icon-plus"/></svg>
                                    <span>Add Action</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    `;

    container.appendChild(ruleDiv);

    if (isNew || shouldScroll) {
        ruleDiv.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Default to EMPTY arrays instead of [{ source: "preset" }]
    const trigContainer = ruleDiv.querySelector(".can-do-triggers-container");
    const triggers = ruleData.triggers || (ruleData.trigger ? [ruleData.trigger] : []);
    triggers.forEach(trig => renderCanDoTriggerItem(trigContainer, trig));

    const condContainer = ruleDiv.querySelector(".can-do-conditions-container");
    const conditions = ruleData.conditions || (ruleData.condition && ruleData.condition.type !== "none" ? [ruleData.condition] : []);
    conditions.forEach(cond => renderCanDoConditionItem(condContainer, cond));

    const actContainer = ruleDiv.querySelector(".can-do-actions-container");
    const actions = ruleData.actions || (ruleData.action ? [ruleData.action] : []);
    actions.forEach(act => renderCanDoActionItem(actContainer, act));

    updateCanDoRuleTriggerDropdowns(ruleDiv);
    updateCanDoSectionCountBadges(ruleDiv);
}

// --- BYTE GRID HELPER FUNCTIONS (D1 - D8) ---
function renderByteInputsHTML(prefixClass, payloadStr = "") {
    const rawBytes = (payloadStr || "").trim().split(/\s+/);
    let html = `<div class="${prefixClass}-grid" style="display: inline-flex; gap: 5px; align-items: flex-end; flex-wrap: wrap; margin-top: 4px;">`;
    for (let i = 0; i < 8; i++) {
        const rawVal = rawBytes[i] || "";
        let val = (rawVal === "**" || rawVal === "*") ? "" : rawVal;
        if (val === "SEQ3") val = "~3";
        if (val === "INC" || val === "ROLL") val = "++";
        html += `
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span class="byte-label" onclick="cycleByteCounter(this)" title="Click to cycle rolling counter (~3 -> ++ -> *R -> Clear)" style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); margin-bottom: 2px; cursor: pointer; user-select: none;">D${i + 1}</span>
                            <input type="text" class="${prefixClass}-byte byte-input" data-idx="${i}" maxlength="4" value="${val}" placeholder="*" 
                                    oninput="handleByteInput(this)" onkeydown="handleByteKeyDown(event, this)" onpaste="handleBytePaste(event, this)"
                                    title="Hex byte (e.g. 0F), wildcard (*), 3-step roll (~3/SEQ3), or increment (++)"
                                    style="width: 32px; height: 26px; text-align: center; font-family: monospace; font-size: 0.85rem; font-weight: bold; text-transform: uppercase; padding: 0;">
                        </div>
                    `;
    }
    html += `
                    <button type="button" class="system-button" onclick="setByteGridPreset(this, '${prefixClass}', '00')" title="Fill all bytes with 00" style="height: 26px; padding: 0 5px; font-size: 0.72rem; margin-left: 4px;">00</button>
                    <button type="button" class="system-button" onclick="setByteGridPreset(this, '${prefixClass}', 'FF')" title="Fill all bytes with FF" style="height: 26px; padding: 0 5px; font-size: 0.72rem; margin-left: 2px;">FF</button>
                    <button type="button" class="system-button" onclick="setByteGridPreset(this, '${prefixClass}', '')" title="Set all bytes to wildcard (*)" style="height: 26px; padding: 0 5px; font-size: 0.72rem; margin-left: 2px;">**</button>
                    <button type="button" class="system-button" onclick="clearByteInputs(this, '${prefixClass}')" title="Clear all bytes" style="height: 26px; padding: 0 6px; font-size: 0.72rem; margin-left: 2px;">Clear</button>
                </div>`;
    return html;
}

function setByteGridPreset(btn, prefixClass, fillVal) {
    const grid = btn.closest(`.${prefixClass}-grid`);
    if (grid) {
        grid.querySelectorAll(`.${prefixClass}-byte`).forEach(inp => inp.value = fillVal);
        const card = btn.closest(".can-do-rule-card");
        if (card) updateCanDoRuleSummaryPill(card);
    }
}

function handleByteInput(input) {
    let val = input.value.trim().toUpperCase();
    if (val === "SQ" || val === "~3") {
        input.value = "~3";
        input.title = "3-step rolling counter (~0, ~1, ~2)";
    } else if (val === "++" || val === "IN") {
        input.value = "++";
        input.title = "Increment counter (+1 on every step)";
    } else if (val.length > 2) {
        input.value = val.slice(0, 2);
    } else {
        input.value = val;
    }
    const grid = input.closest("[class$='-grid']");
    const idx = parseInt(input.getAttribute("data-idx"));
    if (input.value.length === 2 && idx < 7) {
        const nextInput = grid ? grid.querySelector(`[data-idx="${idx + 1}"]`) : null;
        if (nextInput && !nextInput.value) {
            nextInput.focus();
            nextInput.select();
        }
    }
}

function handleBytePaste(event, input) {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData('text');
    if (!text) return;
    const grid = input.closest("[class$='-grid']");
    if (!grid) return;
    const startIdx = parseInt(input.getAttribute("data-idx") || "0");
    let clean = text.trim();
    if (clean.startsWith("0x") || clean.startsWith("0X")) clean = clean.slice(2);
    clean = clean.replace(/[,;:]/g, " ");
    let bytes = clean.split(/\s+/).filter(b => b.length > 0);
    if (bytes.length === 1 && bytes[0].length > 2) {
        bytes = bytes[0].match(/.{1,2}/g) || [bytes[0]];
    }
    bytes.forEach((b, i) => {
        const targetIdx = startIdx + i;
        if (targetIdx < 8) {
            const target = grid.querySelector(`[data-idx="${targetIdx}"]`);
            if (target) {
                let bv = b.toUpperCase();
                if (bv === "SEQ3" || bv === "SQ") bv = "~3";
                if (bv === "INC" || bv === "ROLL") bv = "++";
                target.value = bv;
            }
        }
    });
    const lastIdx = Math.min(startIdx + bytes.length, 7);
    const nextInput = grid.querySelector(`[data-idx="${lastIdx}"]`);
    if (nextInput) {
        nextInput.focus();
        nextInput.select();
    }
}

function handleByteKeyDown(event, input) {
    const grid = input.closest("[class$='-grid']");
    const idx = parseInt(input.getAttribute("data-idx"));
    if (event.key === "Backspace" && input.value === "" && idx > 0) {
        const prevInput = grid ? grid.querySelector(`[data-idx="${idx - 1}"]`) : null;
        if (prevInput) {
            prevInput.focus();
            prevInput.select();
        }
    } else if (event.key === "ArrowRight" && idx < 7) {
        const nextInput = grid ? grid.querySelector(`[data-idx="${idx + 1}"]`) : null;
        if (nextInput) { nextInput.focus(); nextInput.select(); }
    } else if (event.key === "ArrowLeft" && idx > 0) {
        const prevInput = grid ? grid.querySelector(`[data-idx="${idx - 1}"]`) : null;
        if (prevInput) { prevInput.focus(); prevInput.select(); }
    } else if (event.key === " ") {
        event.preventDefault();
        const nextInput = grid ? grid.querySelector(`[data-idx="${idx + 1}"]`) : null;
        if (nextInput) { nextInput.focus(); nextInput.select(); }
    }
}

function clearByteInputs(btn, prefixClass) {
    const grid = btn.closest(`.${prefixClass}-grid`);
    if (grid) {
        grid.querySelectorAll(`.${prefixClass}-byte`).forEach(inp => inp.value = "");
    }
}

function cycleByteCounter(labelElem) {
    const input = labelElem.parentElement?.querySelector(".byte-input");
    if (!input) return;
    const current = input.value.trim().toUpperCase();
    if (current === "" || current === "*") {
        input.value = "~3";
        showNotification("Set 3-step rolling counter (~3: 0x0F -> 0x1F -> 0x2F)", "blue", 1800);
    } else if (current === "~3" || current === "SQ" || current === "SEQ3") {
        input.value = "++";
        showNotification("Set incrementing counter (++: 0x00 -> 0xFF)", "blue", 1800);
    } else if (current === "++" || current === "INC" || current === "ROLL") {
        input.value = "*R";
        showNotification("Set nibble counter (*R: 0x0 -> 0xF)", "blue", 1800);
    } else {
        input.value = "";
        showNotification("Cleared byte (wildcard)", "gray", 1200);
    }
    handleByteInput(input);
}


function getByteGridString(container, prefixClass) {
    const grid = container.querySelector(`.${prefixClass}-grid`);
    if (!grid) return "";
    const inputs = grid.querySelectorAll(`.${prefixClass}-byte`);
    const bytes = [];
    let hasAny = false;
    inputs.forEach(inp => {
        let v = inp.value.trim().toUpperCase();
        if (!v || v === "*") {
            bytes.push("**");
        } else if (v === "~3" || v === "SQ" || v === "SEQ3") {
            bytes.push("SEQ3");
            hasAny = true;
        } else if (v === "++" || v === "INC" || v === "ROLL") {
            bytes.push("INC");
            hasAny = true;
        } else if (v.length === 1) {
            bytes.push("*" + v);
            hasAny = true;
        } else {
            bytes.push(v);
            hasAny = true;
        }
    });
    if (!hasAny) return "";
    while (bytes.length > 0 && bytes[bytes.length - 1] === "**") {
        bytes.pop();
    }
    return bytes.join(" ");
}

function populateByteGrid(container, prefixClass, payloadStr) {
    const grid = container.querySelector(`.${prefixClass}-grid`);
    if (!grid) return;
    const bytes = (payloadStr || "").trim().split(/\s+/);
    const inputs = grid.querySelectorAll(`.${prefixClass}-byte`);
    inputs.forEach((inp, idx) => {
        let b = bytes[idx];
        if (b === "SEQ3") b = "~3";
        if (b === "INC" || b === "ROLL") b = "++";
        inp.value = (b && b !== "**" && b !== "*") ? b : "";
    });
}
const setByteGridString = populateByteGrid;

// --- TRIGGER SUB-ITEMS ---

/* --- HOME ASSISTANT "ADD ELEMENT" DIALOG MODAL CONTROLLER --- */
function openAddAutomationElementDialog(type, targetContainer, ruleCard, options = {}) {
    document.querySelectorAll(".ha-add-element-dialog-overlay").forEach(el => el.remove());

    if (!targetContainer && ruleCard) {
        if (type === "trigger") {
            targetContainer = ruleCard.querySelector(".can-do-triggers-container");
        } else if (type === "condition") {
            targetContainer = ruleCard.querySelector(".can-do-conditions-container");
        } else if (type === "action") {
            targetContainer = ruleCard.querySelector(".can-do-actions-container");
        }
    }

    if (!targetContainer) {
        console.error("Target container not found for " + type);
        return;
    }

    targetContainer.classList.remove("hidden");
    targetContainer.style.display = "";

    const typeConfig = {
        trigger: {
            title: "Add Trigger",
            pillClass: "trig-pill",
            pillText: "When",
            iconBoxClass: "trig-icon",
            defaultIcon: "play",
            searchPlaceholder: "Search triggers (e.g. wipers, steering button, speed, time, CAN)..."
        },
        condition: {
            title: "Add Condition",
            pillClass: "cond-pill",
            pillText: "And if",
            iconBoxClass: "cond-icon",
            defaultIcon: "settings",
            searchPlaceholder: "Search conditions (e.g. doors, battery SOC, speed, schedule, temperature)..."
        },
        action: {
            title: "Add Action",
            pillClass: "act-pill",
            pillText: "Then do",
            iconBoxClass: "act-icon",
            defaultIcon: "play",
            searchPlaceholder: "Search actions (e.g. climate target, seats, precon, delay, popup, CAN)..."
        }
    }[type] || {
        title: "Add Element",
        pillClass: "act-pill",
        pillText: "Add",
        iconBoxClass: "act-icon",
        defaultIcon: "play",
        searchPlaceholder: "Search..."
    };

    // Compile unified catalog items with Taxonomy classification
    const allItems = [];

    if (type === "trigger") {
        // Hardware & Standard Triggers
        allItems.push(
            { id: "custom_can", name: "Custom CAN Message", desc: "Trigger on raw CAN ID and byte payload patterns", domain: "system_automation", subdomain: "network_integrations", icon: "broadcast", onSelect: () => renderCanDoTriggerItem(targetContainer, { source: "can_msg" }) },
            { id: "ha_mqtt", name: "Home Assistant / MQTT Event", desc: "Trigger via MQTT discovery topic or HA action command", domain: "system_automation", subdomain: "network_integrations", icon: "home-assistant", onSelect: () => renderCanDoTriggerItem(targetContainer, { source: "ha_mqtt" }) },
            { id: "clock_schedule", name: "Time / Clock Schedule", desc: "Fire at specific daily clock time (HH:MM:SS)", domain: "system_automation", subdomain: "schedule_time", icon: "clock", onSelect: () => renderCanDoTriggerItem(targetContainer, { source: "clock" }) },
            { id: "interval_timer", name: "Repeating Interval Timer", desc: "Fire repeatedly every X seconds while active", domain: "system_automation", subdomain: "schedule_time", icon: "timer", onSelect: () => renderCanDoTriggerItem(targetContainer, { source: "interval" }) },
            { id: "voltage_level", name: "Battery Voltage Level", desc: "Trigger when 12V aux battery crosses voltage threshold", domain: "energy_powertrain", subdomain: "aux_12v", icon: "battery-12v", onSelect: () => renderCanDoTriggerItem(targetContainer, { source: "voltage" }) }
        );

        const { builtIn, custom } = getFilteredTriggerPresets();
        (custom || []).forEach((p, idx) => {
            const tax = getCommandTaxonomy(p);
            allItems.push({
                id: `custom_trig_${idx}`,
                name: p.name || `Custom Trigger #${idx + 1}`,
                desc: p.description || (p.can_id ? `CAN ID: ${p.can_id}` : "Saved Trigger Preset"),
                domain: tax.domain,
                subdomain: tax.subdomain,
                icon: "star",
                options: p.options,
                onSelect: (stateOpt) => {
                    renderCanDoTriggerItem(targetContainer, {
                        source: "preset",
                        id: p.id,
                        can_id: p.can_id,
                        bus: p.bus,
                        from_payload: stateOpt ? stateOpt.from_payload : p.from_payload,
                        to_payload: stateOpt ? stateOpt.to_payload : p.to_payload
                    });
                }
            });
        });

        (builtIn || []).forEach(p => {
            const tax = getCommandTaxonomy(p);
            allItems.push({
                id: p.id || p.name,
                name: p.name || "Trigger Preset",
                desc: p.description || (p.can_id ? `CAN ID: ${p.can_id}` : "Vehicle Trigger"),
                domain: tax.domain,
                subdomain: tax.subdomain,
                icon: "",
                options: p.options,
                onSelect: (stateOpt) => {
                    renderCanDoTriggerItem(targetContainer, {
                        source: "preset",
                        id: p.id,
                        can_id: p.can_id,
                        bus: p.bus,
                        from_payload: stateOpt ? stateOpt.from_payload : p.from_payload,
                        to_payload: stateOpt ? stateOpt.to_payload : p.to_payload
                    });
                }
            });
        });
    } else if (type === "condition") {
        // Logic & Comparison Blocks
        allItems.push(
            { id: "logic_and", name: "AND Logic Block", desc: "Test multiple conditions; all must pass", domain: "system_automation", subdomain: "logic_flow", icon: "code-braces", onSelect: () => renderCanDoConditionBlock(targetContainer, { group_type: "and" }) },
            { id: "logic_or", name: "OR Logic Block", desc: "Test multiple conditions; at least one must pass", domain: "system_automation", subdomain: "logic_flow", icon: "code-braces", onSelect: () => renderCanDoConditionBlock(targetContainer, { group_type: "or" }) },
            { id: "logic_not", name: "NOT Logic Block", desc: "Invert condition outcome; inner condition must fail", domain: "system_automation", subdomain: "logic_flow", icon: "code-braces", onSelect: () => renderCanDoConditionBlock(targetContainer, { group_type: "not" }) },
            { id: "param_compare", name: "Parameter / State Comparison", desc: "Compare vehicle speed, temperatures, battery SOC, or gears", domain: "energy_powertrain", subdomain: "drivetrain_dynamics", icon: "compare", onSelect: () => renderCanDoConditionItem(targetContainer, { type: "param_range" }) },
            { id: "can_state", name: "Exact CAN Payload Match", desc: "Verify live bus state payload against expected pattern", domain: "system_automation", subdomain: "network_integrations", icon: "broadcast", onSelect: () => renderCanDoConditionItem(targetContainer, { type: "can_state" }) },
            { id: "time_window", name: "Time Window / Schedule", desc: "Only allow execution during designated hours or weekdays", domain: "system_automation", subdomain: "schedule_time", icon: "calendar-clock", onSelect: () => renderCanDoConditionItem(targetContainer, { type: "time_window" }) },
            { id: "voltage_check", name: "12V Battery Voltage Check", desc: "Confirm vehicle 12V system is above or below threshold", domain: "energy_powertrain", subdomain: "aux_12v", icon: "battery-12v", onSelect: () => renderCanDoConditionItem(targetContainer, { type: "voltage" }) }
        );

        const condCats = getFilteredConditionPresets();
        condCats.forEach(cat => {
            (cat.presets || []).forEach(p => {
                const tax = getCommandTaxonomy(p);
                allItems.push({
                    id: p.id || p.name,
                    name: p.name || "Condition Preset",
                    desc: p.description || p.expression || (p.can_id ? `CAN ID: ${p.can_id}` : "Preset Condition"),
                    domain: tax.domain,
                    subdomain: tax.subdomain,
                    icon: "",
                    options: p.options,
                    onSelect: (stateOpt) => {
                        renderCanDoConditionItem(targetContainer, {
                            type: p.type || "preset",
                            expression: stateOpt ? (stateOpt.expression !== undefined ? stateOpt.expression : p.expression) : p.expression,
                            can_id: p.can_id,
                            match_payload: stateOpt ? stateOpt.match_payload : p.match_payload,
                            days: p.days,
                            start_time: p.start_time,
                            end_time: p.end_time,
                            voltage_val: p.voltage_val,
                            voltage_dir: p.voltage_dir
                        });
                    }
                });
            });
        });
    } else if (type === "action") {
        // Building Blocks & Flow Control
        allItems.push(
            { id: "flow_ifthen", name: "If - Then - Else", desc: "Perform actions based on nested condition evaluation", domain: "system_automation", subdomain: "logic_flow", icon: "help", onSelect: () => renderCanDoIfThenBlock(targetContainer, { type: "if_then" }) },
            { id: "flow_choose", name: "Choose (Branching)", desc: "Multi-branch sequence executing the first matching condition", domain: "system_automation", subdomain: "logic_flow", icon: "share", onSelect: () => addCanDoChooseBlockToContainer(targetContainer, ruleCard) },
            { id: "act_can_tx", name: "Transmit CAN Sequence", desc: "Send one or more raw CAN frames with interval delays", domain: "system_automation", subdomain: "network_integrations", icon: "broadcast", onSelect: () => renderCanDoActionItem(targetContainer, { type: "can_tx" }) },
            { id: "act_delay", name: "Delay / Wait", desc: "Pause automation execution for a specified duration", domain: "system_automation", subdomain: "schedule_time", icon: "hourglass", onSelect: () => renderCanDoActionItem(targetContainer, { type: "delay" }) },
            { id: "act_popup", name: "Dashboard Popup (OSD)", desc: "Show alert message on the WiCAN Web UI or display", domain: "cabin_media", subdomain: "displays_feedback", icon: "message-alert", onSelect: () => renderCanDoActionItem(targetContainer, { type: "popup" }) },
            { id: "act_mqtt", name: "Publish MQTT Message", desc: "Send state update or event payload to MQTT broker", domain: "system_automation", subdomain: "network_integrations", icon: "home-assistant", onSelect: () => renderCanDoActionItem(targetContainer, { type: "mqtt" }) },
            { id: "act_webhook", name: "Trigger Webhook POST", desc: "Fire HTTP POST request to external URL or Home Assistant", domain: "system_automation", subdomain: "network_integrations", icon: "webhook", onSelect: () => renderCanDoActionItem(targetContainer, { type: "webhook" }) }
        );

        const actCats = getFilteredActionPresets();
        actCats.forEach((cat, catIdx) => {
            (cat.presets || []).forEach((p, pIdx) => {
                const tax = getCommandTaxonomy(p);
                allItems.push({
                    id: p.id || p.name,
                    name: p.name || "Action Preset",
                    desc: p.description || (p.can_id ? `CAN ID: ${p.can_id}` : (p.popup_message || "Preset Template")),
                    domain: tax.domain,
                    subdomain: tax.subdomain,
                    icon: "",
                    options: p.options,
                    onSelect: (stateOpt) => {
                        renderCanDoActionItem(targetContainer, { type: "preset" });
                        const lastItem = targetContainer.lastElementChild;
                        if (lastItem) {
                            const picker = lastItem.querySelector(".can-do-act-preset-picker");
                            if (picker) {
                                picker.value = `${catIdx}:${pIdx}`;
                                picker.setAttribute("data-selected-preset", `${catIdx}:${pIdx}`);
                                applyCanDoActionPreset(picker);
                            }
                            if (stateOpt && stateOpt.payload) {
                                const stepsContainer = lastItem.querySelector(".can-do-payload-steps-container");
                                if (stepsContainer) {
                                    stepsContainer.innerHTML = "";
                                    renderCanDoPayloadStep(stepsContainer, { payload: stateOpt.payload, repeat: 3 });
                                    renderCanDoPayloadStep(stepsContainer, { payload: "00 00 00 00 00 00 00 00", repeat: 3 });
                                }
                            }
                            const titleSpan = lastItem.querySelector(".can-do-subitem-title-act");
                            if (titleSpan && p.name) {
                                titleSpan.textContent = p.name;
                            }
                        }
                    }
                });
            });
        });
    }

    // Create Overlay Element
    const overlay = document.createElement("div");
    overlay.className = "ha-add-element-dialog-overlay";

    overlay.innerHTML = `
                        <div class="ha-add-element-dialog" onclick="event.stopPropagation();">
                            <div class="ha-dialog-header">
                                <div class="ha-dialog-header-top">
                                    <div class="ha-dialog-title-wrap">
                                        <span class="can-do-ha-pill ${typeConfig.pillClass}">${typeConfig.pillText}</span>
                                        <h3 class="ha-dialog-title">${typeConfig.title}</h3>
                                    </div>
                                    <button type="button" class="ha-dialog-close-btn" onclick="this.closest('.ha-add-element-dialog-overlay').remove();" title="Close dialog">✕</button>
                                </div>
                                <div class="ha-dialog-search-wrap">
                                    <svg class="ha-dialog-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                    <input type="text" class="ha-dialog-search-input" placeholder="${typeConfig.searchPlaceholder}" autofocus>
                                </div>
                                <div class="ha-dialog-breadcrumbs" id="ha_dialog_breadcrumbs"></div>
                            </div>
                            <div class="ha-dialog-body" id="ha_dialog_body"></div>
                        </div>
                    `;

    document.body.appendChild(overlay);

    const searchInput = overlay.querySelector(".ha-dialog-search-input");
    const dialogBody = overlay.querySelector("#ha_dialog_body");
    const breadcrumbs = overlay.querySelector("#ha_dialog_breadcrumbs");

    // State navigation: Step 1 (selectedDomain = null), Step 2 (selectedDomain, selectedSubdomain = null), Step 3 (selectedDomain, selectedSubdomain)
    let currentDomain = null;
    let currentSubdomain = null;

    function getCanDoPresetIconName(item, defaultIcon) {
        if (item.icon && item.icon.trim()) {
            let ic = item.icon.trim();
            if (ic.startsWith('#icon-')) return ic.replace('#icon-', '');
            if (ic.startsWith('icon-')) return ic.replace('icon-', '');
            return ic;
        }
        const text = ((item.name || '') + ' ' + (item.desc || '') + ' ' + (item.subdomain || '') + ' ' + (item.domain || '')).toLowerCase();
        if (text.includes('home assistant') || text.includes('mqtt')) return 'home-assistant';
        if (text.includes('star') || text.includes('favorite') || text.includes('saved')) return 'star';
        if (text.includes('steering') || text.includes('seat') || text.includes('wheel') || text.includes('comfort')) return 'car-seat';
        if (text.includes('climate') || text.includes('hvac') || text.includes('defrost') || text.includes('precon') || text.includes('freeze') || text.includes('cold')) return 'snowflake';
        if (text.includes('temp') || text.includes('weather') || text.includes('outdoor')) return 'thermometer';
        if (text.includes('12v') || text.includes('aux battery') || text.includes('voltage')) return 'battery-12v';
        if (text.includes('battery') || text.includes('soc') || text.includes('traction') || text.includes('hv')) return 'battery-hv';
        if (text.includes('charg') || text.includes('plug')) return 'power-plug';
        if (text.includes('speed') || text.includes('gear') || text.includes('drive') || text.includes('park')) return 'speedometer';
        if (text.includes('light') || text.includes('ambient') || text.includes('glow')) return 'lightbulb';
        if (text.includes('time') || text.includes('schedule') || text.includes('clock') || text.includes('overnight') || text.includes('weekday') || text.includes('daytime')) return 'calendar-clock';
        if (text.includes('interval') || text.includes('delay') || text.includes('wait')) return 'hourglass';
        if (text.includes('popup') || text.includes('osd') || text.includes('cluster') || text.includes('message')) return 'message-alert';
        if (text.includes('webhook') || text.includes('http') || text.includes('cloud') || text.includes('network')) return 'webhook';
        if (text.includes('door') || text.includes('trunk') || text.includes('vehicle') || text.includes('actuator') || text.includes('car')) return 'car';
        if (text.includes('can') || text.includes('broadcast') || text.includes('frame') || text.includes('payload')) return 'broadcast';
        return defaultIcon;
    }

    function updateBreadcrumbs(query = "") {
        if (query) {
            breadcrumbs.innerHTML = `
                                <button type="button" class="ha-dialog-crumb-btn" onclick="clearSearchAndGoRoot()">
                                    <span>All Domains</span>
                                </button>
                                <span>›</span>
                                <span class="ha-dialog-crumb-current">Search Results ("${escapeHtml(query)}")</span>
                            `;
            return;
        }

        let crumbsHTML = `
                            <button type="button" class="ha-dialog-crumb-btn" onclick="navigateToStep(null, null)">
                                <span>All Domains</span>
                            </button>
                        `;

        if (currentDomain) {
            const dDef = CAN_DO_DOMAIN_TAXONOMY[currentDomain];
            crumbsHTML += `<span>›</span>`;
            if (currentSubdomain) {
                crumbsHTML += `
                                    <button type="button" class="ha-dialog-crumb-btn" onclick="navigateToStep('${currentDomain}', null)">
                                        <span>${dDef.name}</span>
                                    </button>
                                    <span>›</span>
                                    <span class="ha-dialog-crumb-current">${dDef.subdomains[currentSubdomain]?.name || currentSubdomain}</span>
                                `;
            } else {
                crumbsHTML += `<span class="ha-dialog-crumb-current">${dDef.name}</span>`;
            }
        }
        breadcrumbs.innerHTML = crumbsHTML;
    }

    window.navigateToStep = function (domainKey, subKey) {
        currentDomain = domainKey;
        currentSubdomain = subKey;
        searchInput.value = "";
        renderPicker();
    };

    window.clearSearchAndGoRoot = function () {
        searchInput.value = "";
        navigateToStep(null, null);
    };

    function renderPicker() {
        const query = searchInput.value.toLowerCase().trim();
        updateBreadcrumbs(query);
        dialogBody.innerHTML = "";

        // Global search mode
        if (query) {
            const matched = allItems.filter(it => {
                const dDef = CAN_DO_DOMAIN_TAXONOMY[it.domain];
                const subName = dDef?.subdomains[it.subdomain]?.name || "";
                return (it.name && it.name.toLowerCase().includes(query)) ||
                    (it.desc && it.desc.toLowerCase().includes(query)) ||
                    (dDef && dDef.name.toLowerCase().includes(query)) ||
                    subName.toLowerCase().includes(query);
            });

            if (matched.length === 0) {
                dialogBody.innerHTML = `<div class="ha-dialog-empty">No ${type}s found matching "${escapeHtml(query)}".</div>`;
                return;
            }

            renderItemList(matched, `Search Results (${matched.length})`);
            return;
        }

        // STEP 1: Top-Level Domains (6 Domains)
        if (!currentDomain) {
            const grid = document.createElement("div");
            grid.className = "ha-dialog-domain-grid";

            Object.keys(CAN_DO_DOMAIN_TAXONOMY).forEach(dKey => {
                const dDef = CAN_DO_DOMAIN_TAXONOMY[dKey];
                const count = allItems.filter(it => it.domain === dKey).length;
                const subCount = Object.keys(dDef.subdomains).length;

                const card = document.createElement("div");
                card.className = "ha-dialog-domain-card";
                card.innerHTML = `
                                    <div class="ha-dialog-domain-icon-box">
                                        <svg style="width: 22px; height: 22px; fill: currentColor;"><use href="#icon-${dDef.icon}"/></svg>
                                    </div>
                                    <div class="ha-dialog-domain-content">
                                        <div class="ha-dialog-domain-title">
                                            <span>${dDef.name}</span>
                                            <span class="ha-dialog-domain-count">${count} items</span>
                                        </div>
                                        <div class="ha-dialog-domain-desc">${dDef.desc}</div>
                                        <div style="margin-top: 6px; font-size: 0.72rem; color: var(--md-sys-color-primary); font-weight: 600;">
                                            ${subCount} Device Classes ›
                                        </div>
                                    </div>
                                `;
                card.onclick = () => {
                    currentDomain = dKey;
                    currentSubdomain = null;
                    renderPicker();
                };
                grid.appendChild(card);
            });

            dialogBody.appendChild(grid);
            return;
        }

        const domainDef = CAN_DO_DOMAIN_TAXONOMY[currentDomain];

        // STEP 2: Sub-Domains / Device Classes
        if (currentDomain && !currentSubdomain) {
            const grid = document.createElement("div");
            grid.className = "ha-dialog-domain-grid";

            Object.keys(domainDef.subdomains).forEach(sKey => {
                const sDef = domainDef.subdomains[sKey];
                const subItems = allItems.filter(it => it.domain === currentDomain && it.subdomain === sKey);

                const card = document.createElement("div");
                card.className = "ha-dialog-domain-card";
                card.innerHTML = `
                                    <div class="ha-dialog-domain-icon-box" style="background: rgba(16, 185, 129, 0.12); color: #10b981;">
                                        <svg style="width: 22px; height: 22px; fill: currentColor;"><use href="#icon-${domainDef.icon}"/></svg>
                                    </div>
                                    <div class="ha-dialog-domain-content">
                                        <div class="ha-dialog-domain-title">
                                            <span>${sDef.name}</span>
                                            <span class="ha-dialog-domain-count">${subItems.length}</span>
                                        </div>
                                        <div class="ha-dialog-domain-desc">${sDef.desc}</div>
                                    </div>
                                `;
                card.onclick = () => {
                    currentSubdomain = sKey;
                    renderPicker();
                };
                grid.appendChild(card);
            });

            dialogBody.appendChild(grid);
            return;
        }

        // STEP 3: Target & State Selectors
        if (currentDomain && currentSubdomain) {
            const targetItems = allItems.filter(it => it.domain === currentDomain && it.subdomain === currentSubdomain);
            const subDef = domainDef.subdomains[currentSubdomain];
            renderItemList(targetItems, `${domainDef.name} › ${subDef.name}`);
        }
    }

    function renderItemList(items, sectionTitle) {
        const sec = document.createElement("div");
        sec.className = "ha-dialog-category-section";
        sec.innerHTML = `<div class="ha-dialog-category-label">${sectionTitle}</div>`;

        const grid = document.createElement("div");
        grid.className = "ha-dialog-items-grid";

        items.forEach(item => {
            const card = document.createElement("div");
            card.className = "ha-dialog-item-card";
            card.style.flexDirection = "column";
            card.style.alignItems = "stretch";

            const iconName = getCanDoPresetIconName(item, typeConfig.defaultIcon);

            let stateChipsHTML = "";
            if (item.options && Array.isArray(item.options) && item.options.length > 0) {
                stateChipsHTML = `
                                    <div class="ha-target-state-chips" onclick="event.stopPropagation();">
                                        ${item.options.slice(0, 4).map(opt => `
                                            <span class="ha-target-state-chip" onclick="handleTargetSelection(window._targetItemSelectMap['${item.id}'], window._targetItemOptionMap['${item.id}_${opt.label.replace(/[^a-zA-Z0-9]/g, '')}'])">
                                                ${opt.label}
                                            </span>
                                        `).join("")}
                                    </div>
                                `;
            }

            card.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <div class="ha-dialog-item-icon-box ${typeConfig.iconBoxClass}">
                                        <svg style="width: 20px; height: 20px; fill: currentColor;"><use href="#icon-${iconName}"/></svg>
                                    </div>
                                    <div class="ha-dialog-item-content">
                                        <span class="ha-dialog-item-title">${item.name}</span>
                                        <span class="ha-dialog-item-desc">${item.desc}</span>
                                    </div>
                                </div>
                                ${stateChipsHTML}
                            `;

            window._targetItemSelectMap = window._targetItemSelectMap || {};
            window._targetItemOptionMap = window._targetItemOptionMap || {};
            window._targetItemSelectMap[item.id] = item;
            if (item.options) {
                item.options.forEach(opt => {
                    window._targetItemOptionMap[`${item.id}_${opt.label.replace(/[^a-zA-Z0-9]/g, '')}`] = opt;
                });
            }

            card.onclick = () => {
                handleTargetSelection(item, null);
            };

            grid.appendChild(card);
        });

        sec.appendChild(grid);
        dialogBody.appendChild(sec);
    }

    function handleTargetSelection(item, stateOpt) {
        overlay.remove();
        item.onSelect(stateOpt);
        const newElem = targetContainer ? targetContainer.lastElementChild : null;
        if (newElem) {
            scrollToNewBlockHelper(newElem, 80);
        }
        if (ruleCard) {
            updateCanDoRuleTriggerDropdowns(ruleCard);
            updateCanDoSectionCountBadges(ruleCard);
            updateCanDoItemConnectors(ruleCard);
            updateCanDoRuleSummaryPill(ruleCard);
        }
    }
    window.handleTargetSelection = handleTargetSelection;

    searchInput.oninput = () => renderPicker();

    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    const escHandler = (e) => {
        if (e.key === "Escape") {
            overlay.remove();
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);

    renderPicker();
    setTimeout(() => searchInput.focus(), 60);
}

function addCanDoTriggerItem(buttonElem) {
    const card = buttonElem.closest(".can-do-rule-card");
    const container = card.querySelector(".can-do-triggers-container");
    if (container) {
        container.classList.remove("hidden");
        container.style.display = "";
    }
    renderCanDoTriggerItem(container, { source: "preset" });
    const newElem = container ? container.lastElementChild : null;
    if (newElem) scrollToNewBlockHelper(newElem, 80);
    updateCanDoRuleTriggerDropdowns(card);
    updateCanDoSectionCountBadges(card);
}

function extractCanDoTriggerData(item) {
    const fromPayload = getByteGridString(item, "can-do-trig-from");
    const toPayload = getByteGridString(item, "can-do-trig-to");
    const forSec = parseFloat(item.querySelector(".can-do-trig-for-sec")?.value || "0");
    const picker = item.querySelector(".can-do-trig-preset-picker");
    const selectedPresetVal = picker ? picker.getAttribute("data-selected-preset") || picker.value : "";
    const currentId = item.querySelector(".can-do-trig-id")?.value.trim() || "";

    return {
        id: currentId,
        source: item.querySelector(".can-do-trig-source")?.value || "preset",
        preset_val: selectedPresetVal,
        click_count: parseInt(item.querySelector(".can-do-trig-click-count")?.value || "1"),
        for_sec: forSec,
        for_ms: Math.round(forSec * 1000),
        can_id: item.querySelector(".can-do-trig-can-id")?.value || "",
        from_payload: fromPayload,
        to_payload: toPayload,
        match_payload: toPayload,
        bus: parseInt(item.querySelector(".can-do-trig-bus")?.value || "0"),
        time: item.querySelector(".can-do-trig-time")?.value || "",
        interval_sec: parseInt(item.querySelector(".can-do-trig-interval-sec")?.value || "10"),
        voltage_val: item.querySelector(".can-do-trig-voltage-val")?.value || "",
        voltage_dir: item.querySelector(".can-do-trig-voltage-dir")?.value || "below",
        expression: item.querySelector(".can-do-trig-expr")?.value || "",
        mqtt_topic: item.querySelector(".can-do-trig-mqtt-topic")?.value || "",
        mqtt_payload: item.querySelector(".can-do-trig-mqtt-payload")?.value || ""
    };
}

function setCanDoTriggerMode(btn, mode) {
    const group = btn.closest(".can-do-trig-mode-group");
    if (!group) return;
    group.querySelectorAll(".can-do-trig-mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const hidden = group.querySelector(".can-do-trig-combine-mode");
    if (hidden) hidden.value = mode;
    const card = btn.closest(".can-do-rule-card");
    if (card) updateCanDoRuleSummaryPill(card);
}

function cloneCanDoTriggerItem(btn) {
    const trigItem = btn.classList?.contains("can-do-trigger-item") ? btn : btn.closest(".can-do-trigger-item");
    const container = trigItem.parentElement;
    const card = trigItem.closest(".can-do-rule-card");
    const trigData = extractCanDoTriggerData(trigItem);

    // Append copy suffix to trigger ID if present
    if (trigData.id) {
        trigData.id = `${trigData.id}_copy`;
    }

    renderCanDoTriggerItem(container, trigData);
    const newTrig = container.lastElementChild;
    trigItem.after(newTrig);
    triggerItemAnimation(newTrig, "ha-item-duplicate");
    scrollToNewBlockHelper(newTrig, 80);
    if (card) {
        updateCanDoRuleTriggerDropdowns(card);
        updateCanDoSectionCountBadges(card);
    }
    showNotification("Trigger duplicated!", "green", 1800);
}

function renderCanDoTriggerItem(container, data = {}) {
    const source = data.source || "preset";
    const itemDiv = document.createElement("div");
    itemDiv.className = "can-do-trigger-item";
    itemDiv.style.borderRadius = "var(--m3-shape-md)";
    itemDiv.style.padding = "0.9rem";
    itemDiv.style.boxShadow = "var(--shadow-sm)";
    itemDiv.addEventListener("click", () => {
        if (!itemDiv.classList.contains("can-do-subitem-collapsed")) {
            selectCanDoItem(itemDiv);
        }
    });

    // Match initial preset index if data.id matches a known preset
    const { builtIn, custom } = getFilteredTriggerPresets();
    let selectedPresetVal = "";
    let matchedPreset = null;
    if (data.id) {
        const cIdx = custom.findIndex(p => p.id === data.id);
        if (cIdx !== -1) {
            selectedPresetVal = `c_${cIdx}`;
            matchedPreset = custom[cIdx];
        } else {
            const bIdx = builtIn.findIndex(p => p.id === data.id);
            if (bIdx !== -1) {
                selectedPresetVal = `b_${bIdx}`;
                matchedPreset = builtIn[bIdx];
            }
        }
    }
    if (!selectedPresetVal && (source === "preset" || !data.source) && builtIn.length > 0) {
        selectedPresetVal = "b_0";
        matchedPreset = builtIn[0];
    }

    const canId = data.can_id || (matchedPreset ? matchedPreset.can_id : "0x448");
    const busVal = data.bus !== undefined ? data.bus : (matchedPreset && matchedPreset.bus !== undefined ? matchedPreset.bus : 0);
    const fromPayload = data.from_payload !== undefined ? data.from_payload : (matchedPreset ? (matchedPreset.from_payload || "") : "");
    const toPayload = data.to_payload !== undefined ? data.to_payload : (data.match_payload !== undefined ? data.match_payload : (matchedPreset ? (matchedPreset.to_payload || "") : ""));

    itemDiv.innerHTML = `
                    <div class="can-do-subitem-header trig-header" onclick="toggleCanDoItemBody(this, event)" style="cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="can-do-item-chevron" title="Click to collapse / expand">▼</span>
                            <span class="can-do-ha-pill trig-pill">
                                <svg style="width: 14px; height: 14px; fill: currentColor;"><use href="#icon-play"/></svg>
                                When
                            </span>
                            <span class="can-do-subitem-title-trig" style="font-weight: 600; font-size: 0.9rem; color: var(--text-heading); display: inline-flex; align-items: center; gap: 6px;">
                                ${matchedPreset ? (matchedPreset.name || "Preset Trigger") : "Trigger"}
                            </span>
                            <span class="can-do-subitem-summary" style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal; margin-left: 0.2rem;"></span>
                            <label class="can-do-trig-id-container" style="font-size: 0.8rem; color: var(--m3-tonal-when-color); font-weight: 600; display: none; align-items: center; gap: 0.3rem;" onclick="event.stopPropagation();">
                                ID:
                                <input type="text" class="can-do-trig-id" value="${data.id || (matchedPreset ? matchedPreset.id : "") || ""}" placeholder="e.g. star_press" oninput="updateCanDoRuleTriggerDropdowns(this.closest('.can-do-rule-card')); updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'));" style="width: 110px; height: 26px; padding: 0 6px; font-size: 0.8rem; border-radius: 4px; box-sizing: border-box;">
                            </label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.35rem;" onclick="event.stopPropagation();">
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-sim-trig" onclick="testCanDoTriggerUI(this)" title="Simulate this trigger event">Simulate</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, -1)" title="Move Trigger Up">▲</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, 1)" title="Move Trigger Down">▼</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-more" onclick="showCanDoSubitemMenu(this, event, 'trigger')" title="More options">⋮</button>
                        </div>
                    </div>
                    <div class="can-do-subitem-body">
                        <div class="ha-form-grid" style="margin-top: 0.4rem;">
                            <!-- Trigger Source -->
                            <div class="ha-form-row">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Trigger Type</span>
                                    <span class="ha-form-sublabel">Select how this trigger listens to vehicle CAN or timers.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <select class="ha-form-select can-do-trig-source" onchange="toggleCanDoTrigItemUI(this); updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'));">
                                        <option value="preset" ${source === "preset" || !data.source ? "selected" : ""}>CAN Do Catalog</option>
                                        <option value="can_msg" ${source === "can_msg" ? "selected" : ""}>Custom CAN Message</option>
                                        <option value="ha_mqtt" ${source === "ha_mqtt" || source === "mqtt_cmd" ? "selected" : ""}>Home Assistant / MQTT Command</option>
                                        <option value="clock" ${source === "clock" ? "selected" : ""}>Schedule / Clock Time</option>
                                        <option value="interval" ${source === "interval" ? "selected" : ""}>Repeating Interval Timer</option>
                                        <option value="voltage" ${source === "voltage" ? "selected" : ""}>Battery Voltage Threshold</option>
                                        <option value="state_change" ${source === "state_change" ? "selected" : ""}>Parameter / State Change</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Catalog Preset Selector -->
                            <div class="ha-form-row trig-field-preset ${source === "preset" || !data.source ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Catalog Preset</span>
                                    <span class="ha-form-sublabel">Preconfigured button presses and steering wheel triggers.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <div class="can-do-preset-toolbar-wrap" style="width: 100%;">
                                        <select class="ha-form-select can-do-trig-preset-picker" data-selected-preset="${selectedPresetVal}" onchange="this.setAttribute('data-selected-preset', this.value); applyCanDoTrigPreset(this);" style="font-weight: 600;">
                                            ${renderTrigPresetOptionsHTML(selectedPresetVal)}
                                        </select>
                                        <div class="can-do-preset-action-bar">
                                            <button type="button" class="system-button can-do-edit-preset-btn" onclick="toggleCanDoItemDetails(this)" title="Show or hide underlying CAN ID, bus, and payload details">Edit Details</button>
                                            <button type="button" class="system-button can-do-save-preset-btn" onclick="saveCurrentTriggerAsPreset(this)" title="Save current CAN ID and payload pattern as a custom reusable entry">Save to My Catalog</button>
                                            <button type="button" class="delete-btn can-do-del-preset-btn" onclick="deleteCustomTrigPreset(this)" style="display: none;" title="Delete this custom preset">Delete</button>
                                        </div>
                                    </div>
                                    <div class="can-do-trig-options-container" style="display: none; width: 100%;"></div>
                                </div>
                            </div>

                            <!-- MQTT Command Topic -->
                            <div class="ha-form-row trig-field-mqtt ${source === "ha_mqtt" || source === "mqtt_cmd" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">MQTT Command Topic</span>
                                    <span class="ha-form-sublabel">Topic Home Assistant publishes to trigger this rule.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-trig-mqtt-topic" value="${data.mqtt_topic || "wican/can_do/trigger"}" placeholder="wican/can_do/trigger" oninput="updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'))">
                                </div>
                            </div>

                            <!-- MQTT Expected Payload -->
                            <div class="ha-form-row trig-field-mqtt ${source === "ha_mqtt" || source === "mqtt_cmd" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Expected Payload / Event</span>
                                    <span class="ha-form-sublabel">Match text payload (leave blank to fire on any payload).</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-trig-mqtt-payload" value="${data.mqtt_payload || ""}" placeholder="e.g. start_precon" oninput="updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'))">
                                </div>
                            </div>

                            <!-- Trigger CAN ID -->
                            <div class="ha-form-row trig-field-can ${source === "can_msg" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Trigger CAN ID (Hex)</span>
                                    <span class="ha-form-sublabel">Arbitration ID to detect on the vehicle CAN network.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-trig-can-id" value="${canId}" placeholder="0x448" oninput="updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'))">
                                </div>
                            </div>

                            <!-- Bus Selector -->
                            <div class="ha-form-row trig-field-can trig-preset-detail ${source === "can_msg" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">CAN Bus Channel</span>
                                    <span class="ha-form-sublabel">Select physical transceiver bus.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <select class="ha-form-select can-do-trig-bus">
                                        <option value="0" ${busVal === 0 ? "selected" : ""}>CAN 0 (Primary)</option>
                                        <option value="1" ${busVal === 1 ? "selected" : ""}>CAN 1 (Secondary)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- From Payload Grid -->
                            <div class="ha-form-row trig-field-can trig-preset-detail ${source === "can_msg" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">From Payload (Optional)</span>
                                    <span class="ha-form-sublabel">Initial state bytes before transition (D1–D8).</span>
                                </div>
                                <div class="ha-form-control-col" style="align-items: flex-start;">
                                    ${renderByteInputsHTML("can-do-trig-from", fromPayload)}
                                </div>
                            </div>

                            <!-- To Payload Grid -->
                            <div class="ha-form-row trig-field-can trig-preset-detail ${source === "can_msg" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">To Payload (Optional)</span>
                                    <span class="ha-form-sublabel">Target state bytes after transition (D1–D8).</span>
                                </div>
                                <div class="ha-form-control-col" style="align-items: flex-start;">
                                    ${renderByteInputsHTML("can-do-trig-to", toPayload)}
                                </div>
                            </div>

                            <!-- Schedule / Clock Time -->
                            <div class="ha-form-row trig-field-clock ${source === "clock" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Trigger Time (HH:MM:SS)</span>
                                    <span class="ha-form-sublabel">Exact wall clock time to execute automation.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-trig-time" value="${data.time || "08:00:00"}" placeholder="08:00:00">
                                </div>
                            </div>

                            <!-- Interval Timer -->
                            <div class="ha-form-row trig-field-interval ${source === "interval" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Repeating Interval (Seconds)</span>
                                    <span class="ha-form-sublabel">Period in seconds between repeated executions.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="number" class="ha-form-input can-do-trig-interval-sec" value="${data.interval_sec || 10}" min="1" max="86400">
                                </div>
                            </div>

                            <!-- Voltage Threshold -->
                            <div class="ha-form-row trig-field-voltage ${source === "voltage" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Battery Voltage Threshold</span>
                                    <span class="ha-form-sublabel">Threshold in Volts (e.g. 12.2V low battery cut-off).</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-trig-voltage-val" value="${data.voltage_val || "12.2"}" placeholder="12.2">
                                </div>
                            </div>

                            <!-- Voltage Direction -->
                            <div class="ha-form-row trig-field-voltage ${source === "voltage" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Condition Direction</span>
                                    <span class="ha-form-sublabel">Triggers when 12V supply crosses threshold.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <select class="ha-form-select can-do-trig-voltage-dir">
                                        <option value="below" ${data.voltage_dir === "below" || !data.voltage_dir ? "selected" : ""}>Voltage Drops Below (&lt;)</option>
                                        <option value="above" ${data.voltage_dir === "above" ? "selected" : ""}>Voltage Rises Above (&gt;)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Expression / Parameter -->
                            <div class="ha-form-row trig-field-expr ${source === "state_change" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Parameter Expression</span>
                                    <span class="ha-form-sublabel">Live math expression or slice (e.g. [B0:B1]).</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-trig-expr" value="${data.expression || "[B0:B1]"}" placeholder="[B0:B1]">
                                </div>
                            </div>

                            <!-- Hold Duration (For) -->
                            <div class="ha-form-row trig-field-for ${source === "clock" || source === "interval" ? "hidden" : ""}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Hold Duration (For)</span>
                                    <span class="ha-form-sublabel">Must stay continuously active for this duration (0 = Instant).</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                                        <input type="number" class="ha-form-input can-do-trig-for-sec" value="${data.for_sec !== undefined ? data.for_sec : (data.for_ms ? (data.for_ms / 1000) : 0)}" min="0" max="86400" step="0.5" style="max-width: 100px;" placeholder="0" oninput="updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'))">
                                        <span style="font-weight: 600; color: var(--text-heading); font-size: 0.85rem;">seconds</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Press Pattern -->
                            <div class="ha-form-row trig-field-press-pattern ${source === "clock" || source === "interval" || source === "voltage" ? "hidden" : ""}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Press Pattern</span>
                                    <span class="ha-form-sublabel">Detect single, double, or triple clicks within 450ms.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <select class="ha-form-select can-do-trig-click-count" onchange="updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'))">
                                        <option value="1" ${(!data.click_count || data.click_count == 1) ? "selected" : ""}>Single Press (Default)</option>
                                        <option value="2" ${data.click_count == 2 ? "selected" : ""}>Double Press</option>
                                        <option value="3" ${data.click_count == 3 ? "selected" : ""}>Triple Press</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
    container.appendChild(itemDiv);
    itemDiv.dataset.detailsOpen = "false";
    if (source === "preset" || !data.source) {
        // Hide the detail rows (bus, byte grids) by default in preset mode
        itemDiv.querySelectorAll(".trig-preset-detail").forEach(el => el.classList.add("hidden"));
        const picker = itemDiv.querySelector(".can-do-trig-preset-picker");
        if (picker && picker.value) {
            applyCanDoTrigPreset(picker, false);
        }
    }
}

function toggleCanDoTrigItemUI(selectElem) {
    const item = selectElem.closest(".can-do-trigger-item");
    const val = selectElem.value;
    item.querySelectorAll(".trig-field-preset").forEach(el => el.classList.toggle("hidden", val !== "preset"));
    item.querySelectorAll(".trig-field-mqtt").forEach(el => el.classList.toggle("hidden", val !== "ha_mqtt" && val !== "mqtt_cmd"));
    item.querySelectorAll(".trig-field-can").forEach(el => el.classList.toggle("hidden", val !== "can_msg" && val !== "preset"));
    item.querySelectorAll(".trig-field-clock").forEach(el => el.classList.toggle("hidden", val !== "clock"));
    item.querySelectorAll(".trig-field-interval").forEach(el => el.classList.toggle("hidden", val !== "interval"));
    item.querySelectorAll(".trig-field-voltage").forEach(el => el.classList.toggle("hidden", val !== "voltage"));
    item.querySelectorAll(".trig-field-expr").forEach(el => el.classList.toggle("hidden", val !== "state_change"));
    item.querySelectorAll(".trig-field-for").forEach(el => el.classList.toggle("hidden", val === "clock" || val === "interval"));
    item.querySelectorAll(".trig-field-press-pattern").forEach(el => el.classList.toggle("hidden", val === "clock" || val === "interval" || val === "voltage"));
    if (val === "preset") {
        const picker = item.querySelector(".can-do-trig-preset-picker");
        if (picker && picker.value !== "") {
            applyCanDoTrigPreset(picker);
        }
    }
}

// --- CONDITION SUB-ITEMS ---
function addCanDoConditionItem(buttonElem) {
    const card = buttonElem.closest(".can-do-rule-card");
    const container = card.querySelector(".can-do-conditions-container");
    if (container) {
        container.classList.remove("hidden");
        container.style.display = "";
    }
    renderCanDoConditionItem(container, { type: "preset" });
    const newElem = container ? container.lastElementChild : null;
    if (newElem) scrollToNewBlockHelper(newElem, 80);
    updateCanDoSectionCountBadges(card);
}

function cloneCanDoConditionItem(btn) {
    const condItem = btn.classList?.contains("can-do-condition-item") ? btn : btn.closest(".can-do-condition-item");
    const container = condItem.parentElement;
    const card = condItem.closest(".can-do-rule-card");
    const condData = extractCanDoConditionElement(condItem);

    renderCanDoConditionItem(container, condData);
    const newCond = container.lastElementChild;
    condItem.after(newCond);
    triggerItemAnimation(newCond, "ha-item-duplicate");
    scrollToNewBlockHelper(newCond, 80);
    if (card) updateCanDoSectionCountBadges(card);
    showNotification("Condition duplicated!", "green", 1800);
}

function cloneCanDoConditionBlock(btn) {
    const blockItem = (btn.classList?.contains("can-do-condition-group") || btn.classList?.contains("can-do-condition-block")) ? btn : btn.closest(".can-do-condition-group, .can-do-condition-block");
    const container = blockItem.parentElement;
    const card = blockItem.closest(".can-do-rule-card");
    const blockData = extractCanDoConditionElement(blockItem);

    renderCanDoConditionBlock(container, blockData);
    const newBlock = container.lastElementChild;
    blockItem.after(newBlock);
    triggerItemAnimation(newBlock, "ha-item-duplicate");
    scrollToNewBlockHelper(newBlock, 80);
    if (card) updateCanDoSectionCountBadges(card);
    showNotification("Condition block duplicated!", "green", 1800);
}

function renderCanDoConditionItem(container, data = {}) {
    const type = data.type || "preset";
    const isInverted = data.invert === true || data.invert === "true";
    const days = data.days || ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const itemDiv = document.createElement("div");
    itemDiv.className = "can-do-condition-item";
    itemDiv.style.borderRadius = "var(--m3-shape-md)";
    itemDiv.style.padding = "0.9rem";
    itemDiv.style.boxShadow = "var(--shadow-sm)";
    itemDiv.addEventListener("click", () => {
        if (!itemDiv.classList.contains("can-do-subitem-collapsed")) {
            selectCanDoItem(itemDiv);
        }
    });

    // Match initial preset value if data matches a known preset
    const cats = getFilteredConditionPresets();
    let selectedPresetVal = "";
    let matchedPreset = null;

    if (data.expression) {
        cats.forEach((cat, catIdx) => {
            cat.presets.forEach((p, pIdx) => {
                if (p.expression && p.expression === data.expression) {
                    selectedPresetVal = `${catIdx}:${pIdx}`;
                    matchedPreset = p;
                }
            });
        });
    } else if (data.match_payload) {
        cats.forEach((cat, catIdx) => {
            cat.presets.forEach((p, pIdx) => {
                if (p.can_id && p.can_id === data.can_id && p.match_payload === data.match_payload) {
                    selectedPresetVal = `${catIdx}:${pIdx}`;
                    matchedPreset = p;
                }
            });
        });
    }
    if (!selectedPresetVal && (type === "preset" || !data.type) && cats.length > 0 && cats[0].presets.length > 0) {
        selectedPresetVal = "0:0";
        matchedPreset = cats[0].presets[0];
    }

    const canId = data.can_id || (matchedPreset ? matchedPreset.can_id : "0x448");
    const matchPayload = data.match_payload || (matchedPreset ? (matchedPreset.match_payload || "") : "");

    itemDiv.innerHTML = `
                    <div class="can-do-subitem-header cond-header" onclick="toggleCanDoItemBody(this, event)" style="cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="can-do-item-chevron" title="Click to collapse / expand">▼</span>
                            <span class="can-do-ha-pill cond-pill">
                                <svg style="width: 14px; height: 14px; fill: currentColor;"><use href="#icon-settings"/></svg>
                                And if
                            </span>
                            <span class="can-do-subitem-title-cond" style="font-weight: 600; font-size: 0.9rem; color: var(--text-heading); display: inline-flex; align-items: center; gap: 6px;">
                                ${matchedPreset ? (matchedPreset.name || "Preset Condition") : "Condition"}
                            </span>
                            <label style="font-size: 0.8rem; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; gap: 0.3rem; margin-left: 0.4rem;" onclick="event.stopPropagation();">
                                <input type="checkbox" class="can-do-cond-invert" ${isInverted ? "checked" : ""} onchange="updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'))">
                                <span style="font-weight: 600;">Invert (NOT)</span>
                            </label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.35rem;" onclick="event.stopPropagation();">
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-test-cond" onclick="testCanDoConditionUI(this)" title="Test this condition live">Test</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, -1)" title="Move Condition Up">▲</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, 1)" title="Move Condition Down">▼</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-more" onclick="showCanDoSubitemMenu(this, event, 'condition')" title="More options">⋮</button>
                        </div>
                    </div>
                    <div class="can-do-subitem-body">
                        <div class="ha-form-grid" style="margin-top: 0.4rem;">
                            <!-- Condition Type -->
                            <div class="ha-form-row">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Condition Type</span>
                                    <span class="ha-form-sublabel">Criteria that must be met before actions run.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <select class="ha-form-select can-do-cond-type" onchange="toggleCanDoCondItemUI(this); updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'));">
                                        <option value="preset" ${type === "preset" || !data.type ? "selected" : ""}>CAN Do Catalog</option>
                                        <option value="param_range" ${type === "param_range" ? "selected" : ""}>Parameter / State Comparison</option>
                                        <option value="can_state" ${type === "can_state" ? "selected" : ""}>Exact CAN Payload Match</option>
                                        <option value="day_of_week" ${type === "day_of_week" ? "selected" : ""}>Day of the Week</option>
                                        <option value="time_window" ${type === "time_window" ? "selected" : ""}>Time Window (Between Hours)</option>
                                        <option value="voltage" ${type === "voltage" ? "selected" : ""}>12V Battery Voltage Check</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Catalog Preset Selector -->
                            <div class="ha-form-row cond-field-preset ${type === "preset" || !data.type ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Catalog Preset</span>
                                    <span class="ha-form-sublabel">Preconfigured vehicle state conditions (e.g. Park, Doors, Speed).</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <div class="can-do-preset-toolbar-wrap" style="width: 100%;">
                                        <select class="ha-form-select can-do-cond-preset-picker" data-selected-preset="${selectedPresetVal}" onchange="this.setAttribute('data-selected-preset', this.value); applyCanDoCondPreset(this);" style="font-weight: 600;">
                                            ${renderCondPresetOptionsHTML(selectedPresetVal)}
                                        </select>
                                        <div class="can-do-preset-action-bar">
                                            <button type="button" class="system-button can-do-edit-preset-btn" onclick="toggleCanDoItemDetails(this)" title="Show or hide underlying CAN ID, expression, or payload details">Edit Details</button>
                                            <button type="button" class="system-button can-do-save-preset-btn" onclick="saveCurrentConditionAsPreset(this)" title="Save current condition settings as a custom reusable entry">Save to My Catalog</button>
                                            <button type="button" class="delete-btn can-do-del-preset-btn" onclick="deleteCustomCondPreset(this)" style="display: none;" title="Delete this custom preset">Delete</button>
                                        </div>
                                    </div>
                                    <div class="can-do-cond-options-container" style="display: none; width: 100%; margin-top: 6px; padding: 6px 10px; background: var(--m3-tonal-cond-bg); border: 1px solid var(--m3-tonal-cond-border); border-radius: 6px;"></div>
                                </div>
                            </div>

                            <!-- Expression / Comparison -->
                            <div class="ha-form-row cond-field-expr ${type === "param_range" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Expression / State Comparison</span>
                                    <span class="ha-form-sublabel">e.g. [B0] == 0x01 or [B0:B1] &gt; 50</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-cond-expr" value="${data.expression || "[B0] == 0x01"}" placeholder="[B0] == 0x01 or [B0:B1] &gt; 50" oninput="updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'))">
                                </div>
                            </div>

                            <!-- CAN ID -->
                            <div class="ha-form-row cond-field-can ${type === "can_state" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">CAN ID (Hex)</span>
                                    <span class="ha-form-sublabel">Arbitration ID to match against vehicle network.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-cond-can-id" value="${canId}" placeholder="0x448">
                                </div>
                            </div>

                            <!-- Match Payload Grid -->
                            <div class="ha-form-row cond-field-can ${type === "can_state" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Match Payload (D1–D8)</span>
                                    <span class="ha-form-sublabel">Enter exact hex or wildcard * for any nibble/byte.</span>
                                </div>
                                <div class="ha-form-control-col" style="align-items: flex-start;">
                                    ${renderByteInputsHTML("can-do-cond-can", matchPayload)}
                                </div>
                            </div>

                            <!-- Day of the Week -->
                            <div class="ha-form-row cond-field-days ${type === "day_of_week" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Allowed Days of Week</span>
                                    <span class="ha-form-sublabel">Allow rule execution only on selected days.</span>
                                </div>
                                <div class="ha-form-control-col" style="align-items: flex-start;">
                                    <div class="ha-days-picker">
                                        ${["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(d => `
                                            <label class="ha-day-checkbox ${days.includes(d) ? 'active' : ''}">
                                                <input type="checkbox" class="can-do-cond-day" value="${d}" ${days.includes(d) ? "checked" : ""} onchange="this.parentElement.classList.toggle('active', this.checked);">
                                                ${d}
                                            </label>
                                        `).join("")}
                                    </div>
                                </div>
                            </div>

                            <!-- Time Window Start -->
                            <div class="ha-form-row cond-field-time ${type === "time_window" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Start Time (HH:MM)</span>
                                    <span class="ha-form-sublabel">Beginning of allowed execution window.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-cond-start-time" value="${data.start_time || "07:00"}" placeholder="07:00">
                                </div>
                            </div>

                            <!-- Time Window End -->
                            <div class="ha-form-row cond-field-time ${type === "time_window" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">End Time (HH:MM)</span>
                                    <span class="ha-form-sublabel">End of allowed execution window.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-cond-end-time" value="${data.end_time || "18:00"}" placeholder="18:00">
                                </div>
                            </div>

                            <!-- Voltage Threshold -->
                            <div class="ha-form-row cond-field-volt ${type === "voltage" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Voltage Threshold (V)</span>
                                    <span class="ha-form-sublabel">Battery voltage check in Volts (e.g. 12.0V).</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-cond-voltage-val" value="${data.voltage_val || "12.0"}" placeholder="12.0">
                                </div>
                            </div>

                            <!-- Voltage Direction -->
                            <div class="ha-form-row cond-field-volt ${type === "voltage" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Voltage Comparison</span>
                                    <span class="ha-form-sublabel">Check if vehicle battery is above or below threshold.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <select class="ha-form-select can-do-cond-voltage-dir">
                                        <option value="above" ${data.voltage_dir === "above" || !data.voltage_dir ? "selected" : ""}>Voltage &gt; Threshold (Sufficient Battery)</option>
                                        <option value="below" ${data.voltage_dir === "below" ? "selected" : ""}>Voltage &lt; Threshold (Low Battery)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
    container.appendChild(itemDiv);
    if (type === "preset" || !data.type) {
        const picker = itemDiv.querySelector(".can-do-cond-preset-picker");
        if (picker && picker.value) {
            applyCanDoCondPreset(picker, false);
        }
    }
}

function toggleCanDoCondItemUI(selectElem) {
    const item = selectElem.closest(".can-do-condition-item");
    const val = selectElem.value;
    item.querySelectorAll(".cond-field-preset").forEach(el => el.classList.toggle("hidden", val !== "preset"));
    item.querySelectorAll(".cond-field-expr").forEach(el => el.classList.toggle("hidden", val !== "param_range"));
    item.querySelectorAll(".cond-field-can").forEach(el => el.classList.toggle("hidden", val !== "can_state"));
    item.querySelectorAll(".cond-field-days").forEach(el => el.classList.toggle("hidden", val !== "day_of_week"));
    item.querySelectorAll(".cond-field-time").forEach(el => el.classList.toggle("hidden", val !== "time_window"));
    item.querySelectorAll(".cond-field-volt").forEach(el => el.classList.toggle("hidden", val !== "voltage"));
    if (val === "preset") {
        const picker = item.querySelector(".can-do-cond-preset-picker");
        if (picker && picker.value !== "") {
            applyCanDoCondPreset(picker);
        }
    }
}

function renderCanDoConditionBlock(container, data = {}) {
    const groupType = (data.group_type || (data.type ? data.type.replace("_group", "") : "or")).toLowerCase();
    const isInverted = (data.invert === true || data.invert === "true");

    const groupDiv = document.createElement("div");
    groupDiv.className = "can-do-condition-group can-do-condition-block";
    groupDiv.dataset.groupType = groupType;
    groupDiv.style.borderRadius = "var(--m3-shape-md)";
    groupDiv.style.padding = "0.9rem";
    groupDiv.style.boxShadow = "var(--shadow-sm)";
    groupDiv.addEventListener("click", () => {
        selectCanDoItem(groupDiv);
    });

    groupDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; min-height: 28px; margin-bottom: 0.6rem; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.4rem;">
                        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                            <select class="can-do-group-type" onchange="changeCanDoConditionBlockType(this)" style="height: 26px; font-weight: 700; font-size: 0.82rem; padding: 0 6px; border-radius: 4px; box-sizing: border-box; display: inline-flex; align-items: center;">
                                <option value="and" ${groupType === "and" ? "selected" : ""}>AND Block</option>
                                <option value="or" ${groupType === "or" ? "selected" : ""}>OR Block</option>
                                <option value="not" ${groupType === "not" ? "selected" : ""}>NOT Block</option>
                            </select>
                            <label style="font-size: 0.82rem; color: var(--text-heading); cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; margin-left: 0.2rem;">
                                <input type="checkbox" class="can-do-group-invert" ${isInverted ? "checked" : ""} style="width: auto; height: auto; margin: 0;">
                                <b>NOT</b> Invert
                            </label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, -1)" title="Move Block Up">▲</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, 1)" title="Move Block Down">▼</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-more" onclick="showCanDoSubitemMenu(this, event, 'condition_group')" title="More options">⋮</button>
                        </div>
                    </div>
                    <div class="can-do-group-conditions-box" style="margin-top: 0.3rem;">
                        <div class="can-do-group-conditions-container" style="display: flex; flex-direction: column; gap: 0.6rem; padding: 0.6rem;"></div>
                        <button type="button" class="ha-add-element-btn cond subitem can-do-group-add-btn" onclick="openAddAutomationElementDialog('condition', this.closest('.can-do-section-box').querySelector('.can-do-conditions-container'), this.closest('.can-do-rule-card'))">
                            <svg><use href="#icon-plus"/></svg>
                            <span>Add Condition to Block</span>
                        </button>
                    </div>
                `;
    container.appendChild(groupDiv);

    const innerContainer = groupDiv.querySelector(".can-do-group-conditions-container");
    if (data.conditions && Array.isArray(data.conditions) && data.conditions.length > 0) {
        data.conditions.forEach(c => {
            if (c.type === "or_group" || c.type === "and_group" || c.type === "not_group" || c.group_type) {
                renderCanDoConditionBlock(innerContainer, c);
            } else {
                renderCanDoConditionItem(innerContainer, c);
            }
        });
    } else {
        renderCanDoConditionItem(innerContainer, { type: "preset" });
    }
}
const renderCanDoConditionGroup = renderCanDoConditionBlock;

function changeCanDoConditionBlockType(selectElem) {
    const groupDiv = selectElem.closest(".can-do-condition-group");
    if (!groupDiv) return;
    const groupType = selectElem.value;
    groupDiv.dataset.groupType = groupType;
    const card = groupDiv.closest(".can-do-rule-card");
    if (card) updateCanDoItemConnectors(card);
}
const changeCanDoConditionGroupType = changeCanDoConditionBlockType;

function positionFloatingMenu(menu, targetBtn) {
    document.body.appendChild(menu);
    menu.style.position = "absolute";
    menu.style.zIndex = "999999";

    const rect = targetBtn.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Center horizontally on button, clamped to viewport edges
    let leftViewport = rect.left + (rect.width / 2) - (menuRect.width / 2);
    if (leftViewport < 12) leftViewport = 12;
    if (leftViewport + menuRect.width > viewportWidth - 12) {
        leftViewport = viewportWidth - menuRect.width - 12;
    }

    // Always appear below button press by default; flip above only if overflowing viewport bottom
    let topViewport = rect.bottom + 6;
    if (topViewport + menuRect.height > viewportHeight - 12) {
        // If not enough room below, place above button
        const topAbove = rect.top - menuRect.height - 6;
        if (topAbove >= 12) {
            topViewport = topAbove;
        } else {
            topViewport = Math.max(12, viewportHeight - menuRect.height - 12);
        }
    }

    // Anchor to document coordinates so scrolling moves the menu with the button
    menu.style.left = `${Math.round(leftViewport + scrollX)}px`;
    menu.style.top = `${Math.round(topViewport + scrollY)}px`;
}

function showAddConditionMenu(btn, event) {
    if (event) event.stopPropagation();
    document.querySelectorAll(".can-do-floating-menu").forEach(m => m.remove());

    const menu = document.createElement("div");
    menu.className = "can-do-floating-menu";
    menu.style.borderRadius = "8px";
    menu.style.boxShadow = "0 10px 25px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.1)";
    menu.style.padding = "6px 0";
    menu.style.minWidth = "260px";
    menu.style.fontSize = "0.84rem";

    const targetContainer = btn.closest(".can-do-group-conditions-box")
        ? btn.closest(".can-do-group-conditions-box").querySelector(".can-do-group-conditions-container")
        : (btn.closest(".can-do-condition-group")
            ? btn.closest(".can-do-condition-group").querySelector(".can-do-group-conditions-container")
            : (btn.closest(".can-do-ifthen-block")
                ? btn.closest(".can-do-ifthen-block").querySelector(".can-do-ifthen-conditions-container")
                : btn.closest(".can-do-section-box").querySelector(".can-do-conditions-container")));

    if (targetContainer) {
        targetContainer.classList.remove("hidden");
        targetContainer.style.display = "";
    }

    const card = btn.closest(".can-do-rule-card");
    window._activeCondTargetContainer = targetContainer;
    window._activeCondCard = card;

    menu.innerHTML = `
                    <div class="can-do-menu-item" style="padding: 7px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 600;" onclick="renderCanDoConditionItem(window._activeCondTargetContainer, { type: 'preset' }); updateCanDoSectionCountBadges(window._activeCondCard); document.querySelectorAll('.can-do-floating-menu').forEach(m => m.remove());">
                        <span>Single Condition</span>
                    </div>
                    <div class="can-do-ha-menu-divider"></div>
                    <div class="can-do-menu-item" style="padding: 7px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--m3-tonal-cond-color);" onclick="renderCanDoConditionBlock(window._activeCondTargetContainer, { group_type: 'and' }); updateCanDoSectionCountBadges(window._activeCondCard); document.querySelectorAll('.can-do-floating-menu').forEach(m => m.remove());">
                        <span>AND Block</span>
                    </div>
                    <div class="can-do-menu-item" style="padding: 7px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--md-sys-color-tertiary);" onclick="renderCanDoConditionBlock(window._activeCondTargetContainer, { group_type: 'or' }); updateCanDoSectionCountBadges(window._activeCondCard); document.querySelectorAll('.can-do-floating-menu').forEach(m => m.remove());">
                        <span>OR Block</span>
                    </div>
                    <div class="can-do-menu-item" style="padding: 7px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--md-sys-color-error);" onclick="renderCanDoConditionBlock(window._activeCondTargetContainer, { group_type: 'not' }); updateCanDoSectionCountBadges(window._activeCondCard); document.querySelectorAll('.can-do-floating-menu').forEach(m => m.remove());">
                        <span>NOT Block</span>
                    </div>
                `;

    positionFloatingMenu(menu, btn);

    const closeHandler = (e) => {
        if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            menu.remove();
            document.removeEventListener("click", closeHandler);
        }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
}

function showCreateConditionBlockMenu(btn, event) {
    if (event) event.stopPropagation();
    document.querySelectorAll(".can-do-floating-menu").forEach(m => m.remove());

    const item = btn.closest(".can-do-condition-item, .can-do-condition-group, .can-do-condition-block");
    if (!item) return;

    const menu = document.createElement("div");
    menu.className = "can-do-floating-menu";
    menu.style.borderRadius = "8px";
    menu.style.boxShadow = "var(--shadow-lg)";
    menu.style.padding = "6px 0";
    menu.style.minWidth = "260px";
    menu.style.fontSize = "0.84rem";

    menu.innerHTML = `
                    <div class="can-do-menu-item" style="padding: 7px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--m3-tonal-cond-color);" onclick="wrapConditionInBlock(window._activeWrapItem, 'and'); document.querySelectorAll('.can-do-floating-menu').forEach(m => m.remove());">
                        <span>Create AND Block</span>
                    </div>
                    <div class="can-do-ha-menu-divider"></div>
                    <div class="can-do-menu-item" style="padding: 7px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--md-sys-color-tertiary);" onclick="wrapConditionInBlock(window._activeWrapItem, 'or'); document.querySelectorAll('.can-do-floating-menu').forEach(m => m.remove());">
                        <span>Create OR Block</span>
                    </div>
                    <div class="can-do-ha-menu-divider"></div>
                    <div class="can-do-menu-item" style="padding: 7px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--md-sys-color-error);" onclick="wrapConditionInBlock(window._activeWrapItem, 'not'); document.querySelectorAll('.can-do-floating-menu').forEach(m => m.remove());">
                        <span>Create NOT Block</span>
                    </div>
                `;

    window._activeWrapItem = item;
    positionFloatingMenu(menu, btn);

    const closeHandler = (e) => {
        if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            menu.remove();
            document.removeEventListener("click", closeHandler);
        }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
}
const showWrapConditionMenu = showCreateConditionBlockMenu;

function showAddActionMenu(btn, event) {
    if (event) event.stopPropagation();
    document.querySelectorAll(".can-do-floating-menu").forEach(m => m.remove());

    const menu = document.createElement("div");
    menu.className = "can-do-floating-menu";
    menu.style.borderRadius = "8px";
    menu.style.boxShadow = "0 10px 25px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.1)";
    menu.style.padding = "6px 0";
    menu.style.minWidth = "260px";
    menu.style.fontSize = "0.84rem";

    const targetContainer = btn.closest(".can-do-opt-actions-box")
        ? btn.closest(".can-do-opt-actions-box").querySelector(".can-do-opt-actions-container")
        : (btn.closest(".can-do-choose-option-item")
            ? btn.closest(".can-do-choose-option-item").querySelector(".can-do-opt-actions-container")
            : (btn.closest(".can-do-ifthen-block")
                ? (btn.dataset.branch === "else"
                    ? btn.closest(".can-do-ifthen-block").querySelector(".can-do-ifthen-else-container")
                    : btn.closest(".can-do-ifthen-block").querySelector(".can-do-ifthen-then-container"))
                : (btn.closest(".can-do-off-actions-section")
                    ? btn.closest(".can-do-off-actions-section").querySelector(".can-do-off-actions-container")
                    : btn.closest(".can-do-section-box").querySelector(".can-do-actions-container"))));

    if (targetContainer) {
        targetContainer.classList.remove("hidden");
        targetContainer.style.display = "";
    }

    const card = btn.closest(".can-do-rule-card");
    window._activeActTargetContainer = targetContainer;
    window._activeActCard = card;

    menu.innerHTML = `
                    <div class="can-do-menu-item" style="padding: 7px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--m3-tonal-act-color);" onclick="renderCanDoActionItem(window._activeActTargetContainer, { type: 'preset' }); updateCanDoSectionCountBadges(window._activeActCard); document.querySelectorAll('.can-do-floating-menu').forEach(m => m.remove());">
                        <span>Standard Action Step</span>
                    </div>
                    <div class="can-do-ha-menu-divider"></div>
                    <div class="can-do-menu-item" style="padding: 7px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--m3-tonal-ifthen-color);" onclick="renderCanDoIfThenBlock(window._activeActTargetContainer, { type: 'if_then' }); updateCanDoSectionCountBadges(window._activeActCard); document.querySelectorAll('.can-do-floating-menu').forEach(m => m.remove());">
                        <span>If - Then - Else Block</span>
                    </div>
                    <div class="can-do-menu-item" style="padding: 7px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--m3-tonal-choose-color);" onclick="addCanDoChooseBlockToContainer(window._activeActTargetContainer, window._activeActCard); document.querySelectorAll('.can-do-floating-menu').forEach(m => m.remove());">
                        <span>Choose Block</span>
                    </div>
                `;

    positionFloatingMenu(menu, btn);

    const closeHandler = (e) => {
        if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            menu.remove();
            document.removeEventListener("click", closeHandler);
        }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
}

function showCanDoSubitemMenu(btn, event, type) {
    if (event) event.stopPropagation();
    document.querySelectorAll(".can-do-ha-menu, .can-do-floating-menu").forEach(m => m.remove());

    const item = btn.closest(".can-do-trigger-item, .can-do-condition-item, .can-do-condition-group, .can-do-condition-block, .can-do-action-item, .can-do-choose-block, .can-do-choose-option-item, .can-do-ifthen-block, .can-do-payload-step-item");
    if (!item) return;

    const menu = document.createElement("div");
    menu.className = "can-do-ha-menu";

    let menuHTML = "";
    if (type === "trigger") {
        menuHTML += `
                            <div class="can-do-ha-menu-item" onclick="cloneCanDoTriggerItem(window._activeMenuItem || window._activeMenuBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Duplicate</span>
                            </div>
                            <div class="can-do-ha-menu-divider"></div>
                            <div class="can-do-ha-menu-item danger" onclick="const card = this.closest('.can-do-rule-card') || window._activeMenuCard; window._activeMenuItem.remove(); if (card) { updateCanDoRuleTriggerDropdowns(card); updateCanDoSectionCountBadges(card); } document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Delete</span>
                            </div>
                        `;
    } else if (type === "condition") {
        menuHTML += `
                            <div class="can-do-ha-menu-item" onclick="cloneCanDoConditionItem(window._activeMenuItem || window._activeMenuBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Duplicate</span>
                            </div>
                            <div class="can-do-ha-menu-divider"></div>
                            <div class="can-do-ha-menu-item" onclick="wrapConditionInBlock(window._activeMenuItem, 'and'); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Convert to AND Block</span>
                            </div>
                            <div class="can-do-ha-menu-item" onclick="wrapConditionInBlock(window._activeMenuItem, 'or'); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Convert to OR Block</span>
                            </div>
                            <div class="can-do-ha-menu-item" onclick="wrapConditionInBlock(window._activeMenuItem, 'not'); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Convert to NOT Block</span>
                            </div>
                            <div class="can-do-ha-menu-divider"></div>
                            <div class="can-do-ha-menu-item danger" onclick="const card = this.closest('.can-do-rule-card') || window._activeMenuCard; window._activeMenuItem.remove(); if (card) updateCanDoSectionCountBadges(card); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Delete</span>
                            </div>
                        `;
    } else if (type === "condition_group") {
        menuHTML += `
                            <div class="can-do-ha-menu-item" onclick="cloneCanDoConditionBlock(window._activeMenuItem || window._activeMenuBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Duplicate Block</span>
                            </div>
                            <div class="can-do-ha-menu-divider"></div>
                            <div class="can-do-ha-menu-item danger" onclick="const card = this.closest('.can-do-rule-card') || window._activeMenuCard; window._activeMenuItem.remove(); if (card) updateCanDoSectionCountBadges(card); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Delete Block</span>
                            </div>
                        `;
    } else if (type === "action") {
        menuHTML += `
                            <div class="can-do-ha-menu-item" onclick="cloneCanDoActionItem(window._activeMenuItem || window._activeMenuBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Duplicate</span>
                            </div>
                            <div class="can-do-ha-menu-divider"></div>
                            <div class="can-do-ha-menu-item danger" onclick="const card = this.closest('.can-do-rule-card') || window._activeMenuCard; window._activeMenuItem.remove(); if (card) updateCanDoSectionCountBadges(card); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Delete</span>
                            </div>
                        `;
    } else if (type === "choose_block") {
        menuHTML += `
                            <div class="can-do-ha-menu-item" onclick="cloneCanDoChooseBlock(window._activeMenuItem || window._activeMenuBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Duplicate Choose Block</span>
                            </div>
                            <div class="can-do-ha-menu-divider"></div>
                            <div class="can-do-ha-menu-item danger" onclick="const card = this.closest('.can-do-rule-card') || window._activeMenuCard; window._activeMenuItem.remove(); if (card) updateCanDoSectionCountBadges(card); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Delete Choose Block</span>
                            </div>
                        `;
    } else if (type === "choose_option") {
        menuHTML += `
                            <div class="can-do-ha-menu-item" onclick="cloneCanDoChooseOption(window._activeMenuItem || window._activeMenuBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Duplicate Option Branch</span>
                            </div>
                            <div class="can-do-ha-menu-divider"></div>
                            <div class="can-do-ha-menu-item danger" onclick="removeCanDoChooseOption(window._activeMenuBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Delete Option Branch</span>
                            </div>
                        `;
    } else if (type === "ifthen_block") {
        menuHTML += `
                            <div class="can-do-ha-menu-item" onclick="cloneCanDoIfThenBlock(window._activeMenuItem || window._activeMenuBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Duplicate If-Then Block</span>
                            </div>
                            <div class="can-do-ha-menu-divider"></div>
                            <div class="can-do-ha-menu-item danger" onclick="const card = this.closest('.can-do-rule-card') || window._activeMenuCard; window._activeMenuItem.remove(); if (card) updateCanDoSectionCountBadges(card); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Delete If-Then Block</span>
                            </div>
                        `;
    } else if (type === "payload_step") {
        menuHTML += `
                            <div class="can-do-ha-menu-item" onclick="cloneCanDoPayloadStep(window._activeMenuItem || window._activeMenuBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Duplicate Step</span>
                            </div>
                            <div class="can-do-ha-menu-divider"></div>
                            <div class="can-do-ha-menu-item danger" onclick="removeCanDoPayloadStep(window._activeMenuBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                                <span>Delete Step</span>
                            </div>
                        `;
    }

    menu.innerHTML = menuHTML;
    window._activeMenuItem = item;
    window._activeMenuBtn = btn;
    window._activeMenuCard = item.closest(".can-do-rule-card");

    positionFloatingMenu(menu, btn);

    const closeHandler = (e) => {
        if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            menu.remove();
            document.removeEventListener("click", closeHandler);
        }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
}


function toggleCanDoRuleSections(btn, forceState) {
    const card = btn.closest('.can-do-rule-card');
    if (!card) return;
    const sections = card.querySelectorAll('.can-do-section-box');
    // Check if any section is currently expanded
    let anyExpanded = false;
    sections.forEach(sec => {
        const container = sec.querySelector('.can-do-triggers-container, .can-do-conditions-container, .can-do-actions-container, .can-do-off-actions-container');
        if (container && !container.classList.contains('hidden') && container.style.display !== 'none') {
            anyExpanded = true;
        }
    });

    const targetExpand = (forceState !== undefined) ? forceState : !anyExpanded;
    sections.forEach(sec => {
        const container = sec.querySelector('.can-do-triggers-container, .can-do-conditions-container, .can-do-actions-container, .can-do-off-actions-container');
        const bannerSlot = sec.querySelector('.can-do-choose-banner-slot');
        const chevron = sec.querySelector('.can-do-sec-chevron');
        if (container) {
            if (targetExpand) {
                container.classList.remove('hidden');
                container.style.display = '';
                if (bannerSlot) bannerSlot.style.display = '';
                if (chevron) chevron.textContent = '▼';
            } else {
                container.classList.add('hidden');
                container.style.display = 'none';
                if (bannerSlot) bannerSlot.style.display = 'none';
                if (chevron) chevron.textContent = '▶';
            }
        }
    });
    // Also update chevron indicator on safeguard section
    const safeCard = card.querySelector('.ha-form-card');
    if (safeCard) {
        const safeGrid = safeCard.querySelector('.ha-form-grid');
        const safeChevron = safeCard.querySelector('.can-do-sec-chevron');
        if (safeGrid) {
            if (targetExpand) {
                safeGrid.classList.remove('hidden');
                safeGrid.style.display = '';
                if (safeChevron) safeChevron.textContent = '▼';
            } else {
                safeGrid.classList.add('hidden');
                safeGrid.style.display = 'none';
                if (safeChevron) safeChevron.textContent = '▶';
            }
        }
    }

    if (typeof showNotification === 'function') {
        showNotification(targetExpand ? 'Sections expanded' : 'Sections collapsed', 'blue', 1500);
    }
}

function runCanDoRuleImmediate(cardOrBtn) {
    const card = cardOrBtn.classList?.contains('can-do-rule-card') ? cardOrBtn : cardOrBtn.closest('.can-do-rule-card');
    if (!card) return;
    const ruleName = card.querySelector('.can-do-name')?.value.trim() || 'Automation Rule';

    // Gather all action items in this rule
    const actItems = card.querySelectorAll('.can-do-actions-container > .can-do-action-item');
    if (!actItems || actItems.length === 0) {
        showNotification(`"${ruleName}" has no action steps to run.`, "orange", 3000);
        return;
    }

    showNotification(`Executing "${ruleName}" (${actItems.length} action steps)...`, "blue", 2500);

    // Execute each action step sequentially or test via backend
    let executed = 0;
    actItems.forEach((item, idx) => {
        const actData = extractCanDoActionData(item);
        setTimeout(() => {
            fetch("/test_can_do_action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(actData)
            }).catch(err => console.warn("Action execution warning:", err));
            executed++;
            if (executed === actItems.length) {
                showNotification(`✓ Successfully triggered all actions for "${ruleName}"!`, "green", 3500);
            }
        }, idx * 150);
    });
}

function showCanDoRuleHeaderMenu(btn, event) {
    if (event) event.stopPropagation();
    document.querySelectorAll(".can-do-ha-menu, .can-do-floating-menu").forEach(m => m.remove());

    const card = btn.closest(".can-do-rule-card");
    if (!card) return;

    const menu = document.createElement("div");
    menu.className = "can-do-ha-menu";
    menu.innerHTML = `
                        <div class="can-do-ha-menu-item" onclick="runCanDoRuleImmediate(window._activeRuleCard); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                            <span>Run Automation Actions</span>
                        </div>
                        <div class="can-do-ha-menu-item" onclick="toggleCanDoRuleSections(window._activeRuleCardBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                            <span>Toggle Expand / Collapse Sections</span>
                        </div>
                        <div class="can-do-ha-menu-divider"></div>
                        <div class="can-do-ha-menu-item" onclick="showCanDoHaSettingsModal(window._activeRuleCardBtn); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                            <span>Home Assistant Entity...</span>
                        </div>
                        <div class="can-do-ha-menu-divider"></div>
                        <div class="can-do-ha-menu-item" onclick="duplicateCanDoRuleUI(window._activeRuleCardBtn || window._activeRuleCard); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                            <span>Duplicate Rule</span>
                        </div>
                        <div class="can-do-ha-menu-item" onclick="exportSingleCanDoRuleUI(window._activeRuleCardBtn || window._activeRuleCard); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                            <span>Export JSON</span>
                        </div>
                        <div class="can-do-ha-menu-item" onclick="copySingleCanDoRuleUI(window._activeRuleCardBtn || window._activeRuleCard); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                            <span>Copy JSON</span>
                        </div>
                        <div class="can-do-ha-menu-divider"></div>
                        <div class="can-do-ha-menu-item danger" onclick="deleteCanDoRuleUI(window._activeRuleCardBtn || window._activeRuleCard); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                            <span>Delete Rule</span>
                        </div>
                    `;

    window._activeRuleCardBtn = btn;
    window._activeRuleCard = card;
    positionFloatingMenu(menu, btn);

    const closeHandler = (e) => {
        if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            menu.remove();
            document.removeEventListener("click", closeHandler);
        }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
}

function showCanDoHaSettingsModal(btn) {
    const card = btn ? btn.closest(".can-do-rule-card") : null;
    if (!card) return;

    document.querySelectorAll(".can-do-ha-settings-modal-overlay").forEach(el => el.remove());

    const ruleName = card.querySelector(".can-do-name")?.value || "CAN Do Automation";
    const currentExpose = card.dataset.haExpose !== undefined ? (card.dataset.haExpose === "true") : true;
    const currentIcon = card.dataset.haIcon || "mdi:car-defrost-rear";

    const overlay = document.createElement("div");
    overlay.className = "can-do-ha-settings-modal-overlay";
    overlay.style.cssText = "position: fixed; inset: 0; z-index: 1000000; background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 1rem;";

    overlay.innerHTML = `
                        <div class="can-do-ha-settings-modal" style="width: 100%; max-width: 460px; box-shadow: 0 20px 45px rgba(0,0,0,0.4); border-radius: var(--m3-shape-lg, 16px); padding: 1.5rem; margin: 0; position: relative;" onclick="event.stopPropagation();">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
                                <div>
                                    <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-heading); display: flex; align-items: center; gap: 0.5rem;">
                                        <span>Home Assistant Integration</span>
                                    </h3>
                                    <span style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-top: 3px; max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        "${ruleName}"
                                    </span>
                                </div>
                                <button type="button" class="system-button" style="width: 28px; height: 28px; min-width: 28px; padding: 0; font-size: 0.9rem; border-radius: 50%;" onclick="this.closest('.can-do-ha-settings-modal-overlay').remove();">✕</button>
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 1.1rem;">
                                <label style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; user-select: none;">
                                    <input type="checkbox" id="can_do_modal_ha_expose" ${currentExpose ? "checked" : ""} style="width: 18px; height: 18px; margin-top: 2px; accent-color: var(--md-sys-color-primary); cursor: pointer;">
                                    <div>
                                        <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-heading); display: block;">Expose to Home Assistant</span>
                                        <span style="font-size: 0.75rem; color: var(--text-muted);">Creates an interactive button or switch entity via MQTT discovery for this automation rule.</span>
                                    </div>
                                </label>

                                <div>
                                    <label style="display: block; font-weight: 600; font-size: 0.85rem; color: var(--text-heading); margin-bottom: 0.35rem;">
                                        Material Design Icon (MDI):
                                    </label>
                                    <input type="text" id="can_do_modal_ha_icon" value="${currentIcon}" placeholder="mdi:car-defrost-rear" style="width: 100%; box-sizing: border-box; font-family: monospace; font-size: 0.88rem; padding: 0.45rem 0.6rem; border: 1px solid var(--border-color); border-radius: 6px;">
                                    <span style="font-size: 0.73rem; color: var(--text-muted); margin-top: 3px; display: block;">Specify any standard icon from <a href="https://pictogrammers.com/library/mdi/" target="_blank" rel="noopener" style="color: var(--md-sys-color-primary); text-decoration: underline;">pictogrammers.com/mdi</a></span>

                                    <div style="margin-top: 0.6rem; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center;">
                                        <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted); margin-right: 2px;">Quick Pick:</span>
                                        <button type="button" class="system-button" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:car-defrost-rear'">Defrost</button>
                                        <button type="button" class="system-button" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:car-electric'">EV Battery</button>
                                        <button type="button" class="system-button" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:air-conditioner'">Climate</button>
                                        <button type="button" class="system-button" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:car-door-lock'">Locks</button>
                                        <button type="button" class="system-button" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:car-back'">Trunk</button>
                                        <button type="button" class="system-button" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:car-light-high'">Lights</button>
                                        <button type="button" class="system-button" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:flash'">Generic</button>
                                    </div>
                                </div>

                                <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.8rem; border-top: 1px solid var(--border-color); padding-top: 0.9rem;">
                                    <button type="button" class="system-button" onclick="this.closest('.can-do-ha-settings-modal-overlay').remove();">Cancel</button>
                                    <button type="button" class="primary-button" style="font-weight: 600; margin: 0;" onclick="saveCanDoHaSettingsModal(this, window._activeHaTargetCard);">Save HA Settings</button>
                                </div>
                            </div>
                        </div>
                    `;

    window._activeHaTargetCard = card;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

function saveCanDoHaSettingsModal(btn, card) {
    if (!card) {
        card = window._activeHaTargetCard;
    }
    const modal = btn ? btn.closest(".can-do-ha-settings-modal-overlay") : document.querySelector(".can-do-ha-settings-modal-overlay");
    if (!card || !modal) return;

    const exposeCb = modal.querySelector("#can_do_modal_ha_expose");
    const iconInput = modal.querySelector("#can_do_modal_ha_icon");

    card.dataset.haExpose = (exposeCb && exposeCb.checked) ? "true" : "false";
    card.dataset.haIcon = (iconInput && iconInput.value.trim()) ? iconInput.value.trim() : "mdi:car-defrost-rear";

    modal.remove();
    autoSaveCanDoRules("Updated Home Assistant settings for " + (card.querySelector(".can-do-name")?.value || "rule"), "blue");
}

function addCanDoChooseBlockToContainer(container, card) {
    const triggers = card ? getCanDoRuleTriggersInfo(card) : [];
    let options = [];
    if (triggers.length >= 2) {
        options = triggers.map(t => ({ trigger_id: t.id, actions: [{ type: "preset" }] }));
    } else {
        options = [
            { trigger_id: "", actions: [{ type: "preset" }] },
            { trigger_id: "", actions: [{ type: "preset" }] }
        ];
    }
    renderCanDoChooseBlock(container, { type: "choose", options: options });
    const newElem = container ? container.lastElementChild : null;
    if (newElem) scrollToNewBlockHelper(newElem, 80);
    if (card) {
        updateCanDoRuleTriggerDropdowns(card);
        updateCanDoSectionCountBadges(card);
    }
}

function wrapConditionInBlock(item, groupType) {
    if (!item) return;
    const card = item.closest(".can-do-rule-card");
    const currentData = extractCanDoConditionElement(item);

    // Replace item with wrapped block
    const tempDiv = document.createElement("div");
    item.replaceWith(tempDiv);

    const groupHolder = document.createElement("div");
    renderCanDoConditionBlock(groupHolder, {
        group_type: groupType,
        conditions: [currentData]
    });

    const newGroup = groupHolder.firstElementChild;
    tempDiv.replaceWith(newGroup);

    updateCanDoSectionCountBadges(card);
    showNotification(`Converted condition into ${groupType.toUpperCase()} block!`, "green", 2500);
}
const wrapConditionInGroup = wrapConditionInBlock;

// --- PAYLOAD STEP SUB-ITEMS (D1 - D8) ---
function renderCanDoPayloadStep(container, stepData = {}) {
    const stepDiv = document.createElement("div");
    stepDiv.className = "can-do-payload-step-item";
    stepDiv.style.borderRadius = "var(--m3-shape-sm)";
    stepDiv.style.padding = "0.55rem 0.8rem";
    stepDiv.style.marginBottom = "0.5rem";

    const repeatVal = stepData.repeat !== undefined ? stepData.repeat : 1;
    const delayVal = (stepData.delay_ms !== undefined && stepData.delay_ms !== null) ? stepData.delay_ms : "";
    const stepIdx = container.querySelectorAll(".can-do-payload-step-item").length + 1;

    stepDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
                        <span class="can-do-step-label" style="font-weight: 700; font-size: 0.8rem; color: var(--m3-tonal-act-color);">Step <span class="step-num">${stepIdx}</span>:</span>
                        <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                            <button type="button" class="system-button can-do-subitem-btn can-do-step-btn-move" onclick="moveCanDoItem(this, -1)" title="Move Step Up">▲</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-step-btn-move" onclick="moveCanDoItem(this, 1)" title="Move Step Down">▼</button>
                            <label style="font-size: 0.8rem; color: var(--m3-tonal-act-color); font-weight: 600; display: flex; align-items: center; gap: 0.3rem; margin-left: 0.2rem;">
                                Repeat:
                                <input type="number" class="can-do-step-repeat" value="${repeatVal}" min="1" max="1000">
                                <span style="font-size: 0.75rem;">x</span>
                            </label>
                            <label style="font-size: 0.8rem; color: var(--m3-tonal-act-color); font-weight: 600; display: flex; align-items: center; gap: 0.3rem; margin-left: 0.2rem;" title="Optional per-step override delay before next frame (ms). Leave blank to use action default.">
                                Delay:
                                <input type="number" class="can-do-step-delay-ms" value="${delayVal}" placeholder="def" min="0" max="60000" style="width: 52px; height: 24px; text-align: center; padding: 2px 4px; font-size: 0.8rem;">
                                <span style="font-size: 0.75rem;">ms</span>
                            </label>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-more" onclick="showCanDoSubitemMenu(this, event, 'payload_step')" title="More options">⋮</button>
                        </div>
                    </div>
                    ${renderByteInputsHTML("can-do-step-byte", stepData.payload || "")}
                `;
    container.appendChild(stepDiv);
}

function cloneCanDoPayloadStep(btn) {
    const stepItem = btn.classList?.contains("can-do-payload-step-item") ? btn : btn.closest(".can-do-payload-step-item");
    const container = stepItem.closest(".can-do-payload-steps-container");
    const payloadStr = getByteGridString(stepItem, "can-do-step-byte");
    const repeatVal = parseInt(stepItem.querySelector(".can-do-step-repeat")?.value || "1");
    const delayInp = stepItem.querySelector(".can-do-step-delay-ms")?.value.trim();
    const delayVal = delayInp !== "" && !isNaN(parseInt(delayInp)) ? parseInt(delayInp) : undefined;

    renderCanDoPayloadStep(container, { payload: payloadStr, repeat: repeatVal, delay_ms: delayVal });
    // Move the newly added clone to right below the original item
    const newStep = container.lastElementChild;
    stepItem.after(newStep);
    renumberCanDoPayloadSteps(container);
    triggerItemAnimation(newStep, "ha-item-duplicate");
    scrollToNewBlockHelper(newStep, 80);
    showNotification("Payload step duplicated!", "green", 1800);
}

function addCanDoPayloadStep(buttonElem) {
    const card = buttonElem.closest(".can-do-action-item");
    const container = card.querySelector(".can-do-payload-steps-container");
    renderCanDoPayloadStep(container, { payload: "", repeat: 3 });
    renumberCanDoPayloadSteps(container);
}

function removeCanDoPayloadStep(btn) {
    const container = btn.closest(".can-do-payload-steps-container");
    btn.closest(".can-do-payload-step-item").remove();
    if (container) renumberCanDoPayloadSteps(container);
}

function renumberCanDoPayloadSteps(container) {
    if (!container) return;
    const steps = container.querySelectorAll(".can-do-payload-step-item");
    steps.forEach((step, idx) => {
        const numSpan = step.querySelector(".step-num");
        if (numSpan) numSpan.textContent = idx + 1;
    });
    const box = container.closest(".can-do-payload-steps-box");
    if (box) {
        const summarySpan = box.querySelector(".can-do-steps-summary-text");
        if (summarySpan) {
            summarySpan.textContent = `${steps.length} Sequence Step${steps.length === 1 ? '' : 's'}`;
        }
    }
    const card = container.closest(".can-do-rule-card");
    if (card) updateCanDoItemConnectors(card);
}

function toggleCanDoStepsCollapse(btn) {
    const box = btn.closest(".can-do-payload-steps-box");
    if (!box) return;
    const container = box.querySelector(".can-do-payload-steps-container");
    const addBtn = box.querySelector(".can-do-attached-add-btn");
    if (!container) return;

    const isCollapsed = (container.style.display === "none");
    if (isCollapsed) {
        container.style.display = "flex";
        if (addBtn) addBtn.style.display = "";
        btn.textContent = "↕ Collapse";
    } else {
        container.style.display = "none";
        if (addBtn) addBtn.style.display = "none";
        btn.textContent = "↕ Expand";
    }
}

// --- ACTION SUB-ITEMS ---
function addCanDoActionItem(buttonElem) {
    const card = buttonElem.closest(".can-do-rule-card");
    const container = card.querySelector(".can-do-actions-container");
    if (container) {
        container.classList.remove("hidden");
        container.style.display = "";
    }
    renderCanDoActionItem(container, { type: "preset" });
    const newElem = container ? container.lastElementChild : null;
    if (newElem) scrollToNewBlockHelper(newElem, 80);
    updateCanDoRuleTriggerDropdowns(card);
    updateCanDoSectionCountBadges(card);
}

function cloneCanDoActionItem(btn) {
    const actItem = btn.classList?.contains("can-do-action-item") ? btn : btn.closest(".can-do-action-item");
    const container = actItem.parentElement;
    const card = actItem.closest(".can-do-rule-card");
    const actData = extractCanDoActionData(actItem);

    renderCanDoActionItem(container, actData);
    const newAct = container.lastElementChild;
    actItem.after(newAct);
    triggerItemAnimation(newAct, "ha-item-duplicate");
    scrollToNewBlockHelper(newAct, 80);
    if (card) {
        updateCanDoRuleTriggerDropdowns(card);
        updateCanDoSectionCountBadges(card);
    }
    showNotification("Action step duplicated!", "green", 1800);
}


function formatDurationDisplay(ms) {
    const val = parseInt(ms) || 0;
    if (val < 1000) {
        return `${val} ms`;
    }
    const totalSec = Math.floor(val / 1000);
    const remMs = val % 1000;
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n) => n.toString().padStart(2, '0');
    let timeStr = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    if (remMs > 0) {
        timeStr += `.${Math.floor(remMs / 100)}`;
    }
    if (totalSec < 60 && remMs === 0) {
        return `${totalSec}s (${timeStr})`;
    }
    return timeStr;
}

function onCanDoDelayUnitChange(elem) {
    const item = elem.closest('.can-do-action-item');
    if (!item) return;
    const unit = elem.value;
    const input = item.querySelector('.can-do-act-wait-ms');
    const helperInput = item.querySelector('.can-do-act-wait-helper');
    if (!input || !helperInput) return;

    let currentMs = parseInt(input.value) || 0;
    if (unit === 'sec') {
        helperInput.step = '0.1';
        helperInput.min = '0.1';
        helperInput.value = (currentMs / 1000).toFixed(currentMs % 1000 === 0 ? 0 : 2);
    } else {
        helperInput.step = '50';
        helperInput.min = '10';
        helperInput.value = currentMs;
    }
    updateCanDoDelayPill(item);
}

function onCanDoDelayHelperInput(elem) {
    const item = elem.closest('.can-do-action-item');
    if (!item) return;
    const unitSelect = item.querySelector('.can-do-act-wait-unit');
    const hiddenMsInput = item.querySelector('.can-do-act-wait-ms');
    if (!unitSelect || !hiddenMsInput) return;

    const unit = unitSelect.value;
    let val = parseFloat(elem.value) || 0;
    let totalMs = Math.round(unit === 'sec' ? val * 1000 : val);
    if (totalMs < 0) totalMs = 0;
    hiddenMsInput.value = totalMs;

    updateCanDoDelayPill(item);
    updateCanDoRuleSummaryPill(item.closest('.can-do-rule-card'));
}

function setCanDoDelayPreset(btn, ms) {
    const item = btn.closest('.can-do-action-item');
    if (!item) return;
    const hiddenMsInput = item.querySelector('.can-do-act-wait-ms');
    const helperInput = item.querySelector('.can-do-act-wait-helper');
    const unitSelect = item.querySelector('.can-do-act-wait-unit');
    if (!hiddenMsInput || !helperInput || !unitSelect) return;

    hiddenMsInput.value = ms;
    if (ms >= 1000 && ms % 500 === 0 && unitSelect.value === 'sec') {
        helperInput.value = (ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1);
    } else if (unitSelect.value === 'sec') {
        helperInput.value = (ms / 1000).toFixed(2);
    } else {
        helperInput.value = ms;
    }

    // Update chip active states
    item.querySelectorAll('.ha-duration-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');

    updateCanDoDelayPill(item);
    updateCanDoRuleSummaryPill(item.closest('.can-do-rule-card'));
}

function updateCanDoDelayPill(item) {
    if (!item) return;
    const hiddenMsInput = item.querySelector('.can-do-act-wait-ms');
    const badge = item.querySelector('.can-do-delay-badge');
    const titleSpan = item.querySelector('.can-do-subitem-title-act');
    const actType = item.querySelector('.can-do-act-type')?.value;
    const ms = parseInt(hiddenMsInput?.value) || 500;
    const formatted = formatDurationDisplay(ms);

    if (badge) {
        badge.textContent = `${formatted}`;
    }
    if (actType === 'delay' && titleSpan) {
        titleSpan.textContent = `Wait for ${formatted}`;
    }

    // Update chip active states if matching
    item.querySelectorAll('.ha-duration-chip').forEach(c => {
        const chipMs = parseInt(c.dataset.ms);
        c.classList.toggle('active', chipMs === ms);
    });
}

function renderCanDoActionItem(container, data = {}) {
    let type = data.type || "preset";
    if (type === "climate_target" || type === "precondition") {
        // Keep action type as preset if it was a high-level template
        type = "preset";
    }

    const selectedPresetVal = findMatchingActionPresetVal(data);

    let hasClimateData = (type === "climate_target");
    let hasPreconData = (type === "precondition");
    if (type === "preset" && selectedPresetVal) {
        const parts = selectedPresetVal.split(/[:_]/);
        const cats = getFilteredActionPresets();
        const presetObj = cats[parseInt(parts[0])]?.presets[parseInt(parts[1])];
        if (presetObj) {
            if (presetObj.type === "climate_target" || presetObj.target_temp_c !== undefined || presetObj.target_temp_f !== undefined) hasClimateData = true;
            if (presetObj.type === "precondition" || presetObj.precon_mode !== undefined) hasPreconData = true;
        }
    }
    const hasCanData = (type === "can_tx" || (data.steps && data.steps.length > 0) || data.can_id);
    const hasPopupData = (type === "can_tx" || type === "popup" || data.popup_message);

    const isImperial = (getUnitSystem() === "imperial");
    let initialTemp = isImperial ? 72 : 21.0;
    if (data.target_temp_f !== undefined) {
        initialTemp = isImperial ? data.target_temp_f : Math.round(((data.target_temp_f - 32) * 5 / 9) * 2) / 2;
    } else if (data.target_temp_c !== undefined) {
        initialTemp = isImperial ? Math.round(data.target_temp_c * 9 / 5 + 32) : data.target_temp_c;
    }
    if (isImperial) {
        initialTemp = Math.min(82, Math.max(62, initialTemp));
    } else {
        initialTemp = Math.min(28.0, Math.max(17.0, initialTemp));
    }

    let initialPassTemp = initialTemp;
    if (data.pass_temp_f !== undefined) {
        initialPassTemp = isImperial ? data.pass_temp_f : Math.round(((data.pass_temp_f - 32) * 5 / 9) * 2) / 2;
    } else if (data.pass_temp_c !== undefined) {
        initialPassTemp = isImperial ? Math.round(data.pass_temp_c * 9 / 5 + 32) : data.pass_temp_c;
    }
    if (isImperial) {
        initialPassTemp = Math.min(82, Math.max(62, initialPassTemp));
    } else {
        initialPassTemp = Math.min(28.0, Math.max(17.0, initialPassTemp));
    }

    const isSyncOn = (data.climate_sync_on !== false);
    const isDrvOnly = (data.climate_driver_only === true);

    let matchedPreset = null;
    if (type === "preset" && selectedPresetVal) {
        const parts = selectedPresetVal.split(/[:_]/);
        const cats = getFilteredActionPresets();
        matchedPreset = cats[parseInt(parts[0])]?.presets[parseInt(parts[1])] || null;
    }

    let initialActTitle = "Action Step";
    if (matchedPreset) {
        initialActTitle = matchedPreset.name || "Action Step";
    } else if (type === "delay") {
        initialActTitle = `Wait for ${formatDurationDisplay(data.wait_ms || 500)}`;
    } else if (type === "can_tx") {
        initialActTitle = "Transmit CAN Sequence";
    } else if (type === "popup") {
        initialActTitle = "Dashboard Popup";
    } else if (type === "mqtt") {
        initialActTitle = "Publish MQTT Message";
    } else if (type === "webhook") {
        initialActTitle = "Trigger Webhook POST";
    }

    const itemDiv = document.createElement("div");
    itemDiv.className = "can-do-action-item";
    itemDiv.style.borderRadius = "var(--m3-shape-md)";
    itemDiv.style.padding = "0.9rem";
    itemDiv.style.boxShadow = "var(--shadow-sm)";
    itemDiv.addEventListener("click", () => {
        if (!itemDiv.classList.contains("can-do-subitem-collapsed")) {
            selectCanDoItem(itemDiv);
        }
    });

    itemDiv.innerHTML = `
                    <div class="can-do-subitem-header act-header" onclick="toggleCanDoItemBody(this, event)" style="cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="can-do-item-chevron" title="Click to collapse / expand">▼</span>
                            <span class="can-do-ha-pill act-pill">
                                <svg style="width: 14px; height: 14px; fill: currentColor;"><use href="#icon-radiator"/></svg>
                                Then do
                            </span>
                            <span class="can-do-subitem-title-act" style="font-weight: 600; font-size: 0.9rem; color: var(--text-heading); display: inline-flex; align-items: center; gap: 6px;">
                                ${initialActTitle}
                            </span>
                            <span class="can-do-subitem-summary" style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal; margin-left: 0.2rem;"></span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.35rem;" onclick="event.stopPropagation();">
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-test-act" onclick="testCanDoActionUI(this)" title="Execute this action immediately">Test Step</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, -1)" title="Move Action Step Up">▲</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, 1)" title="Move Action Step Down">▼</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-more" onclick="showCanDoSubitemMenu(this, event, 'action')" title="More options">⋮</button>
                        </div>
                    </div>
                    <div class="can-do-subitem-body">
                        <div class="ha-form-grid" style="margin-top: 0.4rem;">
                            <!-- Action Type -->
                            <div class="ha-form-row">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Action Type</span>
                                    <span class="ha-form-sublabel">Select what command or event to fire.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <select class="ha-form-select can-do-act-type" onchange="toggleCanDoActItemUI(this); updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'));">
                                        <option value="preset" ${type === "preset" ? "selected" : ""}>CAN Do Catalog</option>
                                        <option value="can_tx" ${type === "can_tx" ? "selected" : ""}>Transmit CAN Sequence</option>
                                        <option value="popup" ${type === "popup" ? "selected" : ""}>Dashboard Popup Only (OSD)</option>
                                        <option value="delay" ${type === "delay" ? "selected" : ""}>Delay / Wait</option>
                                        <option value="mqtt" ${type === "mqtt" ? "selected" : ""}>Publish MQTT Alert</option>
                                        <option value="webhook" ${type === "webhook" ? "selected" : ""}>Trigger Webhook POST</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Catalog Preset Selector -->
                            <div class="ha-form-row act-field-preset ${type === "preset" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Catalog Preset</span>
                                    <span class="ha-form-sublabel">Preconfigured vehicle commands (climate, locks, lighting, etc).</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <div class="can-do-preset-toolbar-wrap" style="width: 100%;">
                                        <select class="ha-form-select can-do-act-preset-picker" data-selected-preset="${selectedPresetVal}" onchange="this.setAttribute('data-selected-preset', this.value); applyCanDoActionPreset(this);" style="font-weight: 600;">
                                            ${renderActPresetOptionsHTML(selectedPresetVal)}
                                        </select>
                                        <div class="can-do-preset-action-bar">
                                            <button type="button" class="system-button can-do-edit-preset-btn" onclick="toggleCanDoItemDetails(this)" title="Show or hide underlying CAN ID, bus, delay, payload, and popup text to edit them">Edit Details</button>
                                            <button type="button" class="system-button can-do-save-preset-btn" onclick="saveCurrentActionAsPreset(this)" title="Save current action configuration as a custom reusable entry">Save to My Catalog</button>
                                            <button type="button" class="delete-btn can-do-del-preset-btn" onclick="deleteCustomActPreset(this)" style="display: none;" title="Delete this custom template">Delete</button>
                                        </div>
                                        <div class="can-do-act-options-container" style="display: none; margin-top: 4px; padding: 6px 10px; border: 1px dashed var(--border-color); border-radius: 6px; width: 100%; box-sizing: border-box;"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Climate Controls Checkboxes -->
                            <div class="ha-form-row act-field-climate ${(type === "climate_target" || hasClimateData) ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Climate Settings</span>
                                    <span class="ha-form-sublabel">Dual-zone synchronization and driver-only preferences.</span>
                                </div>
                                <div class="ha-form-control-col" style="align-items: flex-start;">
                                    <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap; width: 100%;">
                                        <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.84rem; cursor: pointer; user-select: none;">
                                            <input type="checkbox" class="can-do-act-climate-sync" ${isSyncOn ? "checked" : ""} ${isDrvOnly ? "disabled" : ""} onchange="updateCanDoClimateUI(this)">
                                            <span><b>Enable HVAC Sync (Dual Zone)</b></span>
                                        </label>
                                        <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.84rem; cursor: pointer; user-select: none;">
                                            <input type="checkbox" class="can-do-act-climate-drv-only" ${isDrvOnly ? "checked" : ""} onchange="updateCanDoClimateUI(this)">
                                            <span><b>Driver Only Mode</b></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- Driver / Synced Target Temp -->
                            <div class="ha-form-row act-field-climate ${hasClimateData ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label can-do-climate-drv-label">${(isSyncOn && !isDrvOnly) ? "Synced Cabin Temp:" : "Driver Target Temp:"}</span>
                                    <span class="ha-form-sublabel">Set desired cabin temperature.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                                        <input type="number" class="ha-form-input can-do-act-target-temp" value="${initialTemp}" step="${isImperial ? '1' : '0.5'}" min="${isImperial ? '62' : '17.0'}" max="${isImperial ? '82' : '28.0'}" style="max-width: 100px;" oninput="onCanDoClimateTempChange(this)">
                                        <span class="can-do-target-temp-unit" style="font-weight: 700; color: var(--m3-tonal-act-color); font-size: 0.9rem;">${isImperial ? "°F" : "°C"}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Passenger Target Temp -->
                            <div class="ha-form-row act-field-climate can-do-climate-pass-row ${hasClimateData && (!isSyncOn && !isDrvOnly) ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Passenger Target Temp:</span>
                                    <span class="ha-form-sublabel">Separate temperature when sync is disabled.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                                        <input type="number" class="ha-form-input can-do-act-pass-temp" value="${initialPassTemp}" step="${isImperial ? '1' : '0.5'}" min="${isImperial ? '62' : '17.0'}" max="${isImperial ? '82' : '28.0'}" style="max-width: 100px;" oninput="onCanDoClimateTempChange(this)">
                                        <span class="can-do-target-temp-unit" style="font-weight: 700; color: var(--m3-tonal-act-color); font-size: 0.9rem;">${isImperial ? "°F" : "°C"}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Preconditioning Mode -->
                            <div class="ha-form-row act-field-precon ${type === "precondition" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Preconditioning Mode</span>
                                    <span class="ha-form-sublabel">How vehicle temperature is maintained.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <select class="ha-form-select can-do-act-precon-mode">
                                        <option value="persistent" ${(!data.precon_mode || data.precon_mode === "persistent") ? "selected" : ""}>Persistent (Maintain temp &amp; restart on car READY)</option>
                                        <option value="continuous" ${data.precon_mode === "continuous" ? "selected" : ""}>Continuous (Maintain temp while car is ON)</option>
                                        <option value="once" ${data.precon_mode === "once" ? "selected" : ""}>Once (Single preconditioning cycle)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Preconditioning Press Type -->
                            <div class="ha-form-row act-field-precon ${type === "precondition" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Press Type</span>
                                    <span class="ha-form-sublabel">Simulation duration for HVAC power sequence.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <select class="ha-form-select can-do-act-precon-press">
                                        <option value="short" ${(!data.precon_press || data.precon_press === "short") ? "selected" : ""}>Short Press</option>
                                        <option value="long" ${data.precon_press === "long" ? "selected" : ""}>Long Press (hold 1s)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Dashboard Popup OSD -->
                            <div class="ha-form-row act-field-popup ${type === "popup" || type === "can_tx" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Dashboard Popup Text (OSD)</span>
                                    <span class="ha-form-sublabel">Heads-up display alert shown on WiCAN Web UI or vehicle screen.</span>
                                </div>
                                <div class="ha-form-control-col" style="align-items: flex-start;">
                                    <input type="text" class="ha-form-input can-do-act-popup-msg" value="${data.popup_message || data.track_popup || ""}" placeholder="e.g. Batt: {battery_temp}C ({voltage}V)" oninput="updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'))">
                                    <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; user-select: none; margin-top: 4px;">
                                        <span style="font-size: 0.74rem; font-weight: 600; color: var(--text-muted);">Insert Variable:</span>
                                        <code class="can-do-livevar-chip" title="Battery temp" onclick="insertCanDoPopupTokenUnit(this, 'battery_temp')">Temp</code>
                                        <code class="can-do-livevar-chip" title="12V battery voltage" onclick="insertCanDoPopupToken(this, '{voltage}')">Voltage</code>
                                        <code class="can-do-livevar-chip" title="High-voltage battery SOC%" onclick="insertCanDoPopupToken(this, '{soc}')">SOC%</code>
                                        <code class="can-do-livevar-chip" title="Vehicle speed" onclick="insertCanDoPopupTokenUnit(this, 'speed')">Speed</code>
                                        <code class="can-do-livevar-chip" title="Precondition status" onclick="insertCanDoPopupToken(this, '{precon_status}')">Precon</code>
                                        <code class="can-do-livevar-chip" title="Status" onclick="insertCanDoPopupToken(this, '{status}')">Status</code>
                                        <code class="can-do-livevar-chip" title="Time HH:MM" onclick="insertCanDoPopupToken(this, '{time}')">Time</code>
                                        <code class="can-do-livevar-chip" title="Date" onclick="insertCanDoPopupToken(this, '{date}')">Date</code>
                                    </div>
                                </div>
                            </div>

                            <!-- CAN ID -->
                            <div class="ha-form-row act-field-can ${type === "can_tx" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Response CAN ID (Hex)</span>
                                    <span class="ha-form-sublabel">Arbitration ID to transmit on vehicle CAN network.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-act-can-id" value="${data.can_id || "0x652"}" placeholder="0x652" oninput="updateCanDoRuleSummaryPill(this.closest('.can-do-rule-card'))">
                                </div>
                            </div>

                            <!-- Target Bus -->
                            <div class="ha-form-row act-field-can ${type === "can_tx" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Target CAN Bus</span>
                                    <span class="ha-form-sublabel">Select transceiver to broadcast transmission.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <select class="ha-form-select can-do-act-bus">
                                        <option value="0" ${data.bus === 0 || !data.bus ? "selected" : ""}>CAN 0 (Primary)</option>
                                        <option value="1" ${data.bus === 1 ? "selected" : ""}>CAN 1 (Secondary)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Inter-frame Delay -->
                            <div class="ha-form-row act-field-can ${type === "can_tx" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Inter-frame Delay (ms)</span>
                                    <span class="ha-form-sublabel">Pause between sequential frame bursts.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="number" class="ha-form-input can-do-act-delay-ms" value="${data.delay_ms || 10}">
                                </div>
                            </div>

                            <!-- CAN Payload Sequence Box -->
                            <div class="ha-form-row act-field-can ${type === "can_tx" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">CAN Sequence Steps</span>
                                    <span class="ha-form-sublabel">Multi-step frame bursts sent sequentially on execution.</span>
                                </div>
                                <div class="ha-form-control-col" style="align-items: stretch;">
                                    <div class="can-do-payload-steps-box" style="width: 100%;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--m3-tonal-act-bg); border-bottom: 1px dashed var(--m3-tonal-act-border); border-radius: 6px 6px 0 0; font-size: 0.78rem;">
                                            <span class="can-do-steps-summary-text" style="color: var(--m3-tonal-act-color); font-weight: 700;">Sequence Steps</span>
                                            <button type="button" class="system-button can-do-toggle-steps-btn" style="padding: 2px 8px; font-size: 0.7rem; height: 22px;" onclick="toggleCanDoStepsCollapse(this)" title="Collapse or expand payload steps preview">↕ Collapse</button>
                                        </div>
                                        <div class="can-do-payload-steps-container" style="display: flex; flex-direction: column; gap: 0.5rem; padding: 0.6rem 0.5rem 0.3rem 0.5rem;"></div>
                                        <button type="button" class="ha-add-element-btn act subitem" onclick="addCanDoPayloadStep(this)" style="margin: 0; border-radius: 0 0 6px 6px; border-top: none;">
                                            <svg><use href="#icon-plus"/></svg>
                                            <span>Add Frame Step</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Wait / Delay -->
                            <div class="ha-form-row act-field-delay ${type === "delay" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label" style="display: inline-flex; align-items: center; gap: 6px;">
                                        Wait Duration
                                        <span class="ha-duration-badge can-do-delay-badge">${formatDurationDisplay(data.wait_ms || 500)}</span>
                                    </span>
                                    <span class="ha-form-sublabel">Pause execution before continuing to the next action step.</span>
                                </div>
                                <div class="ha-form-control-col" style="align-items: stretch;">
                                    <input type="hidden" class="can-do-act-wait-ms" value="${data.wait_ms || 500}">
                                    <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                                        <input type="number" class="ha-form-input can-do-act-wait-helper" 
                                            style="flex: 1; min-width: 90px;" 
                                            value="${(data.wait_ms && data.wait_ms >= 1000 && data.wait_ms % 1000 === 0) ? (data.wait_ms / 1000) : (data.wait_ms || 500)}" 
                                            min="1" 
                                            step="${(data.wait_ms && data.wait_ms >= 1000 && data.wait_ms % 1000 === 0) ? '0.5' : '50'}"
                                            oninput="onCanDoDelayHelperInput(this)" 
                                            placeholder="500">
                                        <select class="ha-form-select can-do-act-wait-unit" style="width: 130px;" onchange="onCanDoDelayUnitChange(this)">
                                            <option value="ms" ${(data.wait_ms && data.wait_ms >= 1000 && data.wait_ms % 1000 === 0) ? "" : "selected"}>Milliseconds (ms)</option>
                                            <option value="sec" ${(data.wait_ms && data.wait_ms >= 1000 && data.wait_ms % 1000 === 0) ? "selected" : ""}>Seconds (s)</option>
                                        </select>
                                    </div>
                                    <div class="ha-duration-chips">
                                        <span class="ha-duration-chip ${(data.wait_ms === 100) ? 'active' : ''}" data-ms="100" onclick="setCanDoDelayPreset(this, 100)">100ms</span>
                                        <span class="ha-duration-chip ${(data.wait_ms === 250) ? 'active' : ''}" data-ms="250" onclick="setCanDoDelayPreset(this, 250)">250ms</span>
                                        <span class="ha-duration-chip ${(data.wait_ms === 500 || !data.wait_ms) ? 'active' : ''}" data-ms="500" onclick="setCanDoDelayPreset(this, 500)">500ms</span>
                                        <span class="ha-duration-chip ${(data.wait_ms === 1000) ? 'active' : ''}" data-ms="1000" onclick="setCanDoDelayPreset(this, 1000)">1s</span>
                                        <span class="ha-duration-chip ${(data.wait_ms === 2000) ? 'active' : ''}" data-ms="2000" onclick="setCanDoDelayPreset(this, 2000)">2s</span>
                                        <span class="ha-duration-chip ${(data.wait_ms === 5000) ? 'active' : ''}" data-ms="5000" onclick="setCanDoDelayPreset(this, 5000)">5s</span>
                                        <span class="ha-duration-chip ${(data.wait_ms === 10000) ? 'active' : ''}" data-ms="10000" onclick="setCanDoDelayPreset(this, 10000)">10s</span>
                                    </div>
                                </div>
                            </div>

                            <!-- MQTT Topic -->
                            <div class="ha-form-row act-field-mqtt ${type === "mqtt" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">MQTT Publish Topic</span>
                                    <span class="ha-form-sublabel">Broker topic to publish event alert.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-act-mqtt-topic" value="${data.mqtt_topic || "homeassistant/sensor/wican/event"}" placeholder="homeassistant/sensor/wican/event">
                                </div>
                            </div>

                            <!-- MQTT Payload -->
                            <div class="ha-form-row act-field-mqtt ${type === "mqtt" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">MQTT Publish Payload</span>
                                    <span class="ha-form-sublabel">JSON or string message published.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-act-mqtt-payload" value="${data.mqtt_payload || '{\"event\":\"triggered\"}'}" placeholder='{"event":"triggered"}'>
                                </div>
                            </div>

                            <!-- Webhook URL -->
                            <div class="ha-form-row act-field-webhook ${type === "webhook" ? "" : "hidden"}">
                                <div class="ha-form-label-col">
                                    <span class="ha-form-label">Webhook URL</span>
                                    <span class="ha-form-sublabel">Endpoint URL receiving HTTP POST on execution.</span>
                                </div>
                                <div class="ha-form-control-col">
                                    <input type="text" class="ha-form-input can-do-act-webhook-url" value="${data.webhook_url || ''}" placeholder="http://192.168.1.100:8123/api/webhook/my_event">
                                </div>
                            </div>
                        </div>
                    </div>`;
    container.appendChild(itemDiv);

    // Populate payload steps
    const stepsContainer = itemDiv.querySelector(".can-do-payload-steps-container");
    if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        data.steps.forEach(st => renderCanDoPayloadStep(stepsContainer, st));
    } else if (data.payload) {
        const rawLines = data.payload.split("\n");
        rawLines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            let p = trimmed;
            let rep = 1;
            let delayVal = undefined;

            const delayMatch = p.match(/\[(\d+)ms\]/i);
            if (delayMatch) {
                delayVal = parseInt(delayMatch[1]);
                p = p.replace(delayMatch[0], "").trim();
            }
            const repMatch = p.match(/\[x(\d+)\]/i);
            if (repMatch) {
                rep = parseInt(repMatch[1]);
                p = p.replace(repMatch[0], "").trim();
            }
            renderCanDoPayloadStep(stepsContainer, { payload: p, repeat: rep, delay_ms: delayVal });
        });
    } else {
        renderCanDoPayloadStep(stepsContainer, { payload: "", repeat: 3 });
    }
    renumberCanDoPayloadSteps(stepsContainer);
}

function toggleCanDoActItemUI(selectElem) {
    const item = selectElem.closest(".can-do-action-item");
    const val = selectElem.value;
    const titleSpan = item.querySelector(".can-do-subitem-title-act");
    if (val === "delay") {
        updateCanDoDelayPill(item);
    } else if (val === "can_tx" && titleSpan) {
        titleSpan.textContent = "Transmit CAN Sequence";
    } else if (val === "popup" && titleSpan) {
        titleSpan.textContent = "Dashboard Popup";
    } else if (val === "mqtt" && titleSpan) {
        titleSpan.textContent = "Publish MQTT Alert";
    } else if (val === "webhook" && titleSpan) {
        titleSpan.textContent = "Trigger Webhook POST";
    }
    item.querySelectorAll(".act-field-preset").forEach(el => el.classList.toggle("hidden", val !== "preset"));
    item.querySelectorAll(".act-field-delay").forEach(el => el.classList.toggle("hidden", val !== "delay"));
    item.querySelectorAll(".act-field-mqtt").forEach(el => el.classList.toggle("hidden", val !== "mqtt"));
    item.querySelectorAll(".act-field-webhook").forEach(el => el.classList.toggle("hidden", val !== "webhook"));

    if (val === "preset") {
        const picker = item.querySelector(".can-do-act-preset-picker");
        if (picker && picker.value !== "") {
            applyCanDoActionPreset(picker);
        } else {
            item.querySelectorAll(".act-field-climate").forEach(el => el.classList.add("hidden"));
            item.querySelectorAll(".act-field-precon").forEach(el => el.classList.add("hidden"));
            item.querySelectorAll(".act-field-can").forEach(el => el.classList.add("hidden"));
            item.querySelectorAll(".act-field-popup").forEach(el => el.classList.add("hidden"));
            const optionsBox = item.querySelector(".can-do-act-options-container");
            if (optionsBox) optionsBox.style.display = "none";
        }
    } else if (val === "can_tx") {
        item.querySelectorAll(".act-field-can").forEach(el => el.classList.remove("hidden"));
        item.querySelectorAll(".act-field-popup").forEach(el => el.classList.remove("hidden"));
        item.querySelectorAll(".act-field-climate").forEach(el => el.classList.add("hidden"));
        item.querySelectorAll(".act-field-precon").forEach(el => el.classList.add("hidden"));
        const optionsBox = item.querySelector(".can-do-act-options-container");
        if (optionsBox) optionsBox.style.display = "none";
    } else if (val === "popup") {
        item.querySelectorAll(".act-field-can").forEach(el => el.classList.add("hidden"));
        item.querySelectorAll(".act-field-popup").forEach(el => el.classList.remove("hidden"));
        item.querySelectorAll(".act-field-climate").forEach(el => el.classList.add("hidden"));
        item.querySelectorAll(".act-field-precon").forEach(el => el.classList.add("hidden"));
        const optionsBox = item.querySelector(".can-do-act-options-container");
        if (optionsBox) optionsBox.style.display = "none";
    } else {
        item.querySelectorAll(".act-field-can").forEach(el => el.classList.add("hidden"));
        item.querySelectorAll(".act-field-popup").forEach(el => el.classList.add("hidden"));
        item.querySelectorAll(".act-field-climate").forEach(el => el.classList.add("hidden"));
        item.querySelectorAll(".act-field-precon").forEach(el => el.classList.add("hidden"));
        const optionsBox = item.querySelector(".can-do-act-options-container");
        if (optionsBox) optionsBox.style.display = "none";
    }
}

function updateCanDoClimateUI(elem) {
    const item = elem.closest(".can-do-action-item");
    if (!item) return;
    const isSync = item.querySelector(".can-do-act-climate-sync")?.checked || false;
    const isDrvOnly = item.querySelector(".can-do-act-climate-drv-only")?.checked || false;

    const driverLabel = item.querySelector(".can-do-climate-drv-label");
    const passRow = item.querySelector(".can-do-climate-pass-row");
    const syncCheckbox = item.querySelector(".can-do-act-climate-sync");

    if (isDrvOnly) {
        if (passRow) passRow.classList.add("hidden");
        if (driverLabel) driverLabel.textContent = "Driver Target Temp:";
        if (syncCheckbox) syncCheckbox.disabled = true;
    } else {
        if (syncCheckbox) syncCheckbox.disabled = false;
        if (isSync) {
            if (passRow) passRow.classList.add("hidden");
            if (driverLabel) driverLabel.textContent = "Synced Cabin Temp:";
        } else {
            if (passRow) passRow.classList.remove("hidden");
            if (driverLabel) driverLabel.textContent = "Driver Target Temp:";
        }
    }
    onCanDoClimateTempChange(elem);
}

function onCanDoClimateTempChange(elem) {
    const item = elem.closest(".can-do-action-item");
    if (!item) return;
    const card = elem.closest(".can-do-rule-card");
    const isImp = (getUnitSystem() === "imperial");
    const u = isImp ? "°F" : "°C";

    const drvInput = item.querySelector(".can-do-act-target-temp");
    const passInput = item.querySelector(".can-do-act-pass-temp");
    const isSync = item.querySelector(".can-do-act-climate-sync")?.checked || false;
    const isDrvOnly = item.querySelector(".can-do-act-climate-drv-only")?.checked || false;

    const drvVal = drvInput ? drvInput.value : (isImp ? "72" : "21.0");
    const passVal = passInput ? passInput.value : drvVal;

    let osdText = `Climate: ${drvVal}${u}`;
    if (!isDrvOnly && !isSync && passVal && passVal !== drvVal) {
        osdText = `Climate: Drv ${drvVal}${u} / Pass ${passVal}${u}`;
    }

    const popupInput = item.querySelector(".can-do-act-popup-msg");
    if (popupInput) {
        popupInput.value = osdText;
    }

    if (card) updateCanDoRuleSummaryPill(card);
}

function getCanDoRuleTriggersInfo(card) {
    if (!card) return [];
    const trigItems = card.querySelectorAll(".can-do-trigger-item");
    const list = [];
    trigItems.forEach((t, idx) => {
        const rawId = t.querySelector(".can-do-trig-id")?.value.trim() || "";
        const id = rawId || `trig_${idx + 1}`;
        const src = t.querySelector(".can-do-trig-source")?.value || "preset";
        let label = `Trigger ${idx + 1}`;
        if (src === "preset") {
            const picker = t.querySelector(".can-do-trig-preset-picker");
            const selText = (picker && picker.selectedIndex >= 0) ? picker.options[picker.selectedIndex].text : "";
            if (selText && !selText.startsWith("--")) label = `Trigger ${idx + 1}: ${selText}`;
        } else if (src === "can_msg") {
            const cid = t.querySelector(".can-do-trig-can-id")?.value.trim() || "";
            label = cid ? `Trigger ${idx + 1}: CAN ${cid}` : `Trigger ${idx + 1}: Raw CAN`;
        } else if (src === "clock") {
            const tm = t.querySelector(".can-do-trig-time")?.value.trim() || "";
            label = tm ? `Trigger ${idx + 1}: Clock (${tm})` : `Trigger ${idx + 1}: Clock`;
        } else if (src === "voltage") {
            const v = t.querySelector(".can-do-trig-voltage-val")?.value.trim() || "";
            label = v ? `Trigger ${idx + 1}: Voltage (${v}V)` : `Trigger ${idx + 1}: Voltage`;
        } else if (src === "interval") {
            const sec = t.querySelector(".can-do-trig-interval-sec")?.value.trim() || "";
            label = sec ? `Trigger ${idx + 1}: Every ${sec}s` : `Trigger ${idx + 1}: Interval`;
        } else if (src === "ha_mqtt" || src === "mqtt_cmd") {
            const payload = t.querySelector(".can-do-trig-mqtt-payload")?.value.trim() || "";
            const topic = t.querySelector(".can-do-trig-mqtt-topic")?.value.trim() || "wican/can_do/trigger";
            label = payload ? `Trigger ${idx + 1}: HA (${payload})` : `Trigger ${idx + 1}: HA (${topic})`;
        }
        if (rawId) {
            label += ` [${rawId}]`;
        }
        list.push({ id: id, label: label, rawId: rawId });
    });
    return list;
}

function getCanDoRuleTriggerIds(card) {
    return getCanDoRuleTriggersInfo(card).map(t => t.id);
}

function updateCanDoRuleTriggerDropdowns(card) {
    if (!card) return;
    const trigCount = card.querySelectorAll(".can-do-trigger-item").length;
    // Show Trigger ID inputs only if >1 trigger exists on the card
    card.querySelectorAll(".can-do-trig-id-container").forEach(el => {
        el.style.display = (trigCount > 1) ? "flex" : "none";
    });

    const triggers = getCanDoRuleTriggersInfo(card);
    card.querySelectorAll(".can-do-opt-trig-id, .can-do-action-item .can-do-act-trig-id").forEach(select => {
        const currentVal = select.value;
        select.innerHTML = `<option value="">Any Trigger (Default)</option>` +
            triggers.map(t => `<option value="${t.id}" ${currentVal === t.id ? "selected" : ""}>${t.label}</option>`).join("") +
            ((currentVal && !triggers.some(t => t.id === currentVal)) ? `<option value="${currentVal}" selected>Trigger: ${currentVal}</option>` : "");
    });
}

// --- CHOOSE BLOCK (BRANCHING) ---
function addCanDoChooseBlock(buttonElem) {
    const card = buttonElem.closest(".can-do-rule-card");
    const container = card.querySelector(".can-do-actions-container");
    const triggers = getCanDoRuleTriggersInfo(card);
    let options = [];
    if (triggers.length >= 2) {
        options = triggers.map(t => ({ trigger_id: t.id, actions: [{ type: "preset" }] }));
    } else {
        options = [
            { trigger_id: "", actions: [{ type: "preset" }] },
            { trigger_id: "", actions: [{ type: "preset" }] }
        ];
    }
    renderCanDoChooseBlock(container, { type: "choose", options: options });
    updateCanDoRuleTriggerDropdowns(card);
    updateCanDoSectionCountBadges(card);
}

function convertActionsToChooseBlock(buttonElem) {
    const card = buttonElem.closest(".can-do-rule-card");
    if (!card) return;
    const container = card.querySelector(".can-do-actions-container");
    if (!container) return;

    // Collect existing action data before clearing
    const existingActions = [];
    container.querySelectorAll(":scope > .can-do-action-item").forEach(item => {
        existingActions.push(extractCanDoActionData(item));
    });

    const triggers = getCanDoRuleTriggersInfo(card);
    const options = [];
    if (triggers.length >= 2) {
        triggers.forEach((t, idx) => {
            if (idx === 0) {
                options.push({
                    trigger_id: t.id,
                    actions: existingActions.length > 0 ? existingActions : [{ type: "preset" }]
                });
            } else {
                options.push({
                    trigger_id: t.id,
                    actions: [{ type: "preset" }]
                });
            }
        });
    } else {
        options.push({ trigger_id: "", actions: existingActions.length > 0 ? existingActions : [{ type: "preset" }] });
        options.push({ trigger_id: "", actions: [{ type: "preset" }] });
    }

    container.innerHTML = "";
    renderCanDoChooseBlock(container, { type: "choose", options: options });
    updateCanDoRuleTriggerDropdowns(card);
    updateCanDoSectionCountBadges(card);
    showNotification("Actions converted to branching Choose block!", "green", 3500);
}

function renderCanDoChooseBlock(container, data = {}) {
    const groupDiv = document.createElement("div");
    groupDiv.className = "can-do-choose-block";
    groupDiv.style.borderRadius = "var(--m3-shape-md)";
    groupDiv.style.padding = "0";
    groupDiv.style.boxShadow = "var(--shadow-sm)";
    groupDiv.addEventListener("click", () => {
        if (!groupDiv.classList.contains("can-do-subitem-collapsed")) {
            selectCanDoItem(groupDiv);
        }
    });

    groupDiv.innerHTML = `
                    <div class="can-do-subitem-header choose-header" onclick="toggleCanDoItemBody(this, event)" style="cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="can-do-item-chevron" title="Click to collapse / expand">▼</span>
                            <span class="can-do-ha-pill choose-pill">
                                <svg style="width: 14px; height: 14px; fill: currentColor;"><use href="#icon-share"/></svg>
                                Choose
                            </span>
                            <span class="can-do-subitem-title-choose" style="font-weight: 600; font-size: 0.9rem; color: var(--text-heading);">
                                Multi-Branch Condition
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.35rem;" onclick="event.stopPropagation();">
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, -1)" title="Move Choose Block Up">▲</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, 1)" title="Move Choose Block Down">▼</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-more" onclick="showCanDoSubitemMenu(this, event, 'choose_block')" title="More options">⋮</button>
                        </div>
                    </div>
                    <div class="can-do-subitem-body" style="padding: 0.85rem 1rem;">
                        <div class="can-do-choose-options-container" style="display: flex; flex-direction: column; gap: 0.8rem;"></div>
                        <button type="button" class="ha-add-element-btn opt" onclick="addCanDoOptionToChooseBlock(this)">
                            <svg><use href="#icon-plus"/></svg>
                            <span>Add Option Branch</span>
                        </button>
                    </div>
                `;
    container.appendChild(groupDiv);

    const optionsContainer = groupDiv.querySelector(".can-do-choose-options-container");
    const options = (data.options && Array.isArray(data.options) && data.options.length > 0)
        ? data.options
        : [{ trigger_id: "", actions: [{ type: "preset" }] }];
    options.forEach(opt => renderCanDoChooseOption(optionsContainer, opt));
    renumberCanDoChooseOptions(optionsContainer);
}

function cloneCanDoChooseBlock(btn) {
    const blockItem = btn.classList?.contains("can-do-choose-block") ? btn : btn.closest(".can-do-choose-block");
    const container = blockItem.parentElement;
    const card = blockItem.closest(".can-do-rule-card");
    const blockData = extractCanDoActionElement(blockItem);

    renderCanDoChooseBlock(container, blockData);
    const newBlock = container.lastElementChild;
    blockItem.after(newBlock);
    triggerItemAnimation(newBlock, "ha-item-duplicate");
    scrollToNewBlockHelper(newBlock, 80);
    if (card) {
        updateCanDoRuleTriggerDropdowns(card);
        updateCanDoSectionCountBadges(card);
    }
    showNotification("Choose block duplicated!", "green", 1800);
}

function renderCanDoChooseOption(container, optData = {}) {
    const optDiv = document.createElement("div");
    optDiv.className = "can-do-choose-option-item ha-flow-branch-card";

    const ruleCard = container ? container.closest(".can-do-rule-card") : null;
    const triggers = getCanDoRuleTriggersInfo(ruleCard);
    const selVal = optData.trigger_id || "";
    const optIdx = container.querySelectorAll(".can-do-choose-option-item").length + 1;

    optDiv.innerHTML = `
                    <div class="can-do-opt-header">
                        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                            <span class="ha-branch-badge opt" style="margin-left: 2px;">Option <span class="opt-num">${optIdx}</span></span>
                            <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem;">
                                Trigger:
                                <select class="ha-form-select can-do-opt-trig-id" style="height: 28px; min-width: 150px; padding: 2px 8px; font-size: 0.8rem; border-radius: 6px;">
                                    <option value="">Any Trigger (Default)</option>
                                    ${triggers.map(t => `<option value="${t.id}" ${selVal === t.id ? "selected" : ""}>${t.label}</option>`).join("")}
                                    ${(selVal && !triggers.some(t => t.id === selVal)) ? `<option value="${selVal}" selected>Trigger: ${selVal}</option>` : ""}
                                </select>
                            </label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, -1)" title="Move Option Up">▲</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, 1)" title="Move Option Down">▼</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-more" onclick="showCanDoSubitemMenu(this, event, 'choose_option')" title="More options">⋮</button>
                        </div>
                    </div>
                    <div class="can-do-opt-body">
                        <div class="can-do-opt-actions-box" style="margin-top: 0.4rem;">
                            <div class="can-do-opt-actions-container" style="display: flex; flex-direction: column; gap: 0.6rem;"></div>
                            <button type="button" class="ha-add-element-btn act subitem" onclick="openAddAutomationElementDialog('action', this.closest('.can-do-opt-actions-box')?.querySelector('.can-do-opt-actions-container') || this.closest('.can-do-section-box')?.querySelector('.can-do-actions-container'), this.closest('.can-do-rule-card'))">
                                <svg><use href="#icon-plus"/></svg>
                                <span>Add Action Step to Option</span>
                            </button>
                        </div>
                    </div>
                `;
    container.appendChild(optDiv);

    const optActionsContainer = optDiv.querySelector(".can-do-opt-actions-container");
    if (optData.actions && Array.isArray(optData.actions) && optData.actions.length > 0) {
        optData.actions.forEach(a => {
            if (a.type === "if_then") {
                renderCanDoIfThenBlock(optActionsContainer, a);
            } else {
                renderCanDoActionItem(optActionsContainer, a);
            }
        });
    } else {
        renderCanDoActionItem(optActionsContainer, { type: "preset" });
    }
}

function cloneCanDoChooseOption(btn) {
    const optItem = btn.classList?.contains("can-do-choose-option-item") ? btn : btn.closest(".can-do-choose-option-item");
    const container = optItem.parentElement;
    const card = optItem.closest(".can-do-rule-card");

    // Extract actions from this option
    const optActions = [];
    optItem.querySelectorAll(".can-do-opt-actions-container > .can-do-action-item, .can-do-opt-actions-container > .can-do-choose-block, .can-do-opt-actions-container > .can-do-ifthen-block").forEach(actItem => {
        optActions.push(extractCanDoActionElement(actItem));
    });

    const optData = {
        trigger_id: optItem.querySelector(".can-do-opt-trig-id")?.value.trim() || "",
        actions: optActions
    };

    renderCanDoChooseOption(container, optData);
    const newOpt = container.lastElementChild;
    optItem.after(newOpt);
    renumberCanDoChooseOptions(container);
    triggerItemAnimation(newOpt, "ha-item-duplicate");
    scrollToNewBlockHelper(newOpt, 80);
    if (card) updateCanDoSectionCountBadges(card);
    showNotification("Option branch duplicated!", "green", 1800);
}

function addCanDoOptionToChooseBlock(btn) {
    const groupDiv = btn.closest(".can-do-choose-block");
    const container = groupDiv.querySelector(".can-do-choose-options-container");
    renderCanDoChooseOption(container, { trigger_id: "", actions: [{ type: "preset" }] });
    renumberCanDoChooseOptions(container);
    const newElem = container ? container.lastElementChild : null;
    if (newElem) scrollToNewBlockHelper(newElem, 80);
}

function addCanDoActionToOption(buttonElem) {
    const optDiv = buttonElem.closest(".can-do-choose-option-item");
    const container = optDiv.querySelector(".can-do-opt-actions-container");
    renderCanDoActionItem(container, { type: "preset" });
    const newElem = container ? container.lastElementChild : null;
    if (newElem) scrollToNewBlockHelper(newElem, 80);
    const card = buttonElem.closest(".can-do-rule-card");
    updateCanDoSectionCountBadges(card);
}

function removeCanDoChooseOption(btn) {
    const item = btn.closest(".can-do-choose-option-item");
    const container = item.parentElement;
    item.remove();
    renumberCanDoChooseOptions(container);
}

function renumberCanDoChooseOptions(container) {
    if (!container) return;
    const options = container.querySelectorAll(".can-do-choose-option-item");
    options.forEach((opt, idx) => {
        const numSpan = opt.querySelector(".opt-num");
        if (numSpan) numSpan.textContent = idx + 1;
    });
    const card = container.closest(".can-do-rule-card");
    if (card) {
        updateCanDoItemConnectors(card);
        updateCanDoSectionCountBadges(card);
    }
}

// --- IF - THEN - ELSE BLOCK (CONDITIONAL ACTIONS) ---
function addCanDoIfThenBlock(buttonElem) {
    const card = buttonElem.closest(".can-do-rule-card");
    const container = card.querySelector(".can-do-actions-container");
    renderCanDoIfThenBlock(container, { type: "if_then" });
    updateCanDoSectionCountBadges(card);
}

function cloneCanDoIfThenBlock(btn) {
    const blockItem = btn.classList?.contains("can-do-ifthen-block") ? btn : btn.closest(".can-do-ifthen-block");
    const container = blockItem.parentElement;
    const card = blockItem.closest(".can-do-rule-card");
    const blockData = extractCanDoActionElement(blockItem);

    renderCanDoIfThenBlock(container, blockData);
    const newBlock = container.lastElementChild;
    blockItem.after(newBlock);
    triggerItemAnimation(newBlock, "ha-item-duplicate");
    scrollToNewBlockHelper(newBlock, 80);
    if (card) {
        updateCanDoRuleTriggerDropdowns(card);
        updateCanDoSectionCountBadges(card);
    }
    showNotification("If-Then-Else block duplicated!", "green", 1800);
}

function renderCanDoIfThenBlock(container, data = {}) {
    const groupDiv = document.createElement("div");
    groupDiv.className = "can-do-ifthen-block";
    groupDiv.style.borderRadius = "var(--m3-shape-md)";
    groupDiv.style.padding = "0";
    groupDiv.style.boxShadow = "var(--shadow-sm)";
    groupDiv.addEventListener("click", () => {
        if (!groupDiv.classList.contains("can-do-subitem-collapsed")) {
            selectCanDoItem(groupDiv);
        }
    });

    groupDiv.innerHTML = `
                    <div class="can-do-subitem-header ifthen-header" onclick="toggleCanDoItemBody(this, event)" style="cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="can-do-item-chevron" title="Click to collapse / expand">▼</span>
                            <span class="can-do-ha-pill ifthen-pill">
                                <svg style="width: 14px; height: 14px; fill: currentColor;"><use href="#icon-help"/></svg>
                                If - Then
                            </span>
                            <span class="can-do-subitem-title-ifthen" style="font-weight: 600; font-size: 0.9rem; color: var(--text-heading);">
                                Conditional Evaluation
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.35rem;" onclick="event.stopPropagation();">
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, -1)" title="Move If-Then Block Up">▲</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-move" onclick="moveCanDoItem(this, 1)" title="Move If-Then Block Down">▼</button>
                            <button type="button" class="system-button can-do-subitem-btn can-do-btn-more" onclick="showCanDoSubitemMenu(this, event, 'ifthen_block')" title="More options">⋮</button>
                        </div>
                    </div>
                    
                    <div class="can-do-subitem-body" style="padding: 0.85rem 1rem;">
                        <!-- IF: Conditions Branch Card -->
                        <div class="ha-flow-branch-card">
                            <div class="can-do-branch-header if">
                                <div style="display: flex; align-items: center; gap: 0.55rem;">
                                    <span class="ha-branch-badge if" style="margin-left: 2px;">IF</span>
                                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Conditions evaluated before executing actions</span>
                                </div>
                            </div>
                            <div class="can-do-branch-body">
                                <div class="can-do-ifthen-conditions-box">
                                    <div class="can-do-ifthen-conditions-container" style="display: flex; flex-direction: column; gap: 0.55rem;"></div>
                                    <button type="button" class="ha-add-element-btn cond subitem" onclick="openAddAutomationElementDialog('condition', this.closest('.can-do-ifthen-conditions-box')?.querySelector('.can-do-ifthen-conditions-container') || this.closest('.can-do-section-box')?.querySelector('.can-do-conditions-container'), this.closest('.can-do-rule-card'))">
                                        <svg><use href="#icon-plus"/></svg>
                                        <span>Add Condition to IF</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- THEN: Actions Branch Card -->
                        <div class="ha-flow-branch-card">
                            <div class="can-do-branch-header then">
                                <div style="display: flex; align-items: center; gap: 0.55rem;">
                                    <span class="ha-branch-badge then" style="margin-left: 2px;">THEN</span>
                                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Actions executed if all conditions above pass</span>
                                </div>
                            </div>
                            <div class="can-do-branch-body">
                                <div class="can-do-ifthen-then-box">
                                    <div class="can-do-ifthen-then-container" style="display: flex; flex-direction: column; gap: 0.55rem;"></div>
                                    <button type="button" class="ha-add-element-btn act subitem" data-branch="then" onclick="openAddAutomationElementDialog('action', this.closest('.can-do-ifthen-then-box')?.querySelector('.can-do-ifthen-then-container') || this.closest('.can-do-section-box')?.querySelector('.can-do-actions-container'), this.closest('.can-do-rule-card'))">
                                        <svg><use href="#icon-plus"/></svg>
                                        <span>Add Action Step to THEN</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- ELSE: Actions Branch Card -->
                        <div class="ha-flow-branch-card" style="margin-bottom: 0 !important;">
                            <div class="can-do-branch-header else">
                                <div style="display: flex; align-items: center; gap: 0.55rem;">
                                    <span class="ha-branch-badge else" style="margin-left: 2px;">ELSE (Optional)</span>
                                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Actions executed if conditions fail</span>
                                </div>
                            </div>
                            <div class="can-do-branch-body">
                                <div class="can-do-ifthen-else-box">
                                    <div class="can-do-ifthen-else-container" style="display: flex; flex-direction: column; gap: 0.55rem;"></div>
                                    <button type="button" class="ha-add-element-btn act subitem" data-branch="else" onclick="openAddAutomationElementDialog('action', this.closest('.can-do-ifthen-else-box')?.querySelector('.can-do-ifthen-else-container') || this.closest('.can-do-section-box')?.querySelector('.can-do-actions-container'), this.closest('.can-do-rule-card'))">
                                        <svg><use href="#icon-plus"/></svg>
                                        <span>Add Action Step to ELSE</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

    container.appendChild(groupDiv);

    const condContainer = groupDiv.querySelector(".can-do-ifthen-conditions-container");
    if (data.conditions && Array.isArray(data.conditions) && data.conditions.length > 0) {
        data.conditions.forEach(c => {
            if (c.type === "or_group" || c.type === "and_group" || c.type === "not_group" || c.group_type) {
                renderCanDoConditionBlock(condContainer, c);
            } else {
                renderCanDoConditionItem(condContainer, c);
            }
        });
    } else {
        renderCanDoConditionItem(condContainer, { type: "speed_zero" });
    }

    const thenContainer = groupDiv.querySelector(".can-do-ifthen-then-container");
    if (data.then_actions && Array.isArray(data.then_actions) && data.then_actions.length > 0) {
        data.then_actions.forEach(a => renderCanDoActionItem(thenContainer, a));
    } else {
        renderCanDoActionItem(thenContainer, { type: "preset" });
    }

    const elseContainer = groupDiv.querySelector(".can-do-ifthen-else-container");
    if (data.else_actions && Array.isArray(data.else_actions) && data.else_actions.length > 0) {
        data.else_actions.forEach(a => renderCanDoActionItem(elseContainer, a));
    }
}

function addCanDoActionToIfThen(btn, branch) {
    const block = btn.closest(".can-do-ifthen-block");
    const container = branch === "then"
        ? block.querySelector(".can-do-ifthen-then-container")
        : block.querySelector(".can-do-ifthen-else-container");
    renderCanDoActionItem(container, { type: "preset" });
    const newElem = container ? container.lastElementChild : null;
    if (newElem) scrollToNewBlockHelper(newElem, 80);
    const card = btn.closest(".can-do-rule-card");
    updateCanDoSectionCountBadges(card);
}

function applyCanDoActionPreset(selectElem) {
    const val = selectElem.value;
    const item = selectElem.closest(".can-do-action-item");
    if (!item) return;
    if (!val) {
        item.querySelectorAll(".act-field-climate").forEach(el => el.classList.add("hidden"));
        item.querySelectorAll(".act-field-precon").forEach(el => el.classList.add("hidden"));
        item.querySelectorAll(".act-field-can").forEach(el => el.classList.add("hidden"));
        item.querySelectorAll(".act-field-popup").forEach(el => el.classList.add("hidden"));
        const optionsBox = item.querySelector(".can-do-act-options-container");
        if (optionsBox) optionsBox.style.display = "none";
        return;
    }

    const parts = val.split(/[:_]/);
    const catIdx = parseInt(parts[0]);
    const pIdx = parseInt(parts[1]);

    const cats = getFilteredActionPresets();
    const cat = cats[catIdx];
    const preset = cat?.presets[pIdx];
    if (!preset) return;

    const isImperial = (getUnitSystem() === "imperial");

    // Determine which parameter sections to display
    const showClimate = (preset.type === "climate_target" || preset.target_temp_c !== undefined || preset.target_temp_f !== undefined);
    const showPrecon = (preset.type === "precondition" || preset.precon_mode !== undefined);
    const showCan = (preset.type === "can_tx" || preset.can_id !== undefined || preset.steps !== undefined || (preset.options && preset.options.some(o => o.payload)));
    const showPopup = (preset.type === "popup" || preset.popup_message !== undefined || (preset.options && preset.options.some(o => o.popup)));

    const isDetailsOpen = item.dataset.detailsOpen === "true";
    item.querySelectorAll(".act-field-climate").forEach(el => el.classList.toggle("hidden", !showClimate));
    item.querySelectorAll(".act-field-precon").forEach(el => el.classList.toggle("hidden", !(isDetailsOpen && showPrecon)));
    item.querySelectorAll(".act-field-can").forEach(el => el.classList.toggle("hidden", !(isDetailsOpen && (showCan || (!showClimate && !showPrecon)))));
    item.querySelectorAll(".act-field-popup").forEach(el => el.classList.toggle("hidden", !(isDetailsOpen && (showPopup || (!showClimate && !showPrecon)))));

    const optionsBox = item.querySelector(".can-do-act-options-container");

    // Climate Target
    if (showClimate) {
        const tt = item.querySelector(".can-do-act-target-temp");
        if (tt) {
            if (isImperial) {
                const f = preset.target_temp_f !== undefined ? preset.target_temp_f : (preset.target_temp_c !== undefined ? Math.round(preset.target_temp_c * 9 / 5 + 32) : 72);
                tt.value = Math.min(82, Math.max(62, f));
            } else {
                const c = preset.target_temp_c !== undefined ? preset.target_temp_c : (preset.target_temp_f !== undefined ? Math.round(((preset.target_temp_f - 32) * 5 / 9) * 2) / 2 : 21.0);
                tt.value = Math.min(28.0, Math.max(17.0, c));
            }
        }
        const pt = item.querySelector(".can-do-act-pass-temp");
        if (pt) {
            if (isImperial) {
                const f = preset.pass_temp_f !== undefined ? preset.pass_temp_f : (preset.target_temp_f !== undefined ? preset.target_temp_f : (preset.target_temp_c !== undefined ? Math.round(preset.target_temp_c * 9 / 5 + 32) : 72));
                pt.value = Math.min(82, Math.max(62, f));
            } else {
                const c = preset.pass_temp_c !== undefined ? preset.pass_temp_c : (preset.target_temp_c !== undefined ? preset.target_temp_c : (preset.target_temp_f !== undefined ? Math.round(((preset.target_temp_f - 32) * 5 / 9) * 2) / 2 : 21.0));
                pt.value = Math.min(28.0, Math.max(17.0, c));
            }
        }
        if (preset.climate_zone) {
            const cz = item.querySelector(".can-do-act-climate-zone");
            if (cz) cz.value = preset.climate_zone;
        }
        const cs = item.querySelector(".can-do-act-climate-sync");
        if (cs) cs.checked = (preset.climate_sync_on !== false);
        const cdo = item.querySelector(".can-do-act-climate-drv-only");
        if (cdo) cdo.checked = (preset.climate_driver_only === true);
        updateCanDoClimateUI(item.querySelector(".can-do-act-climate-sync") || selectElem);
    }

    // Preconditioning
    if (preset.precon_mode) {
        const pm = item.querySelector(".can-do-act-precon-mode");
        if (pm) pm.value = preset.precon_mode;
    }
    if (preset.precon_press) {
        const pp = item.querySelector(".can-do-act-precon-press");
        if (pp) pp.value = preset.precon_press;
    }

    // Popup message
    if (preset.popup_message !== undefined) {
        const pop = item.querySelector(".can-do-act-popup-msg");
        if (pop) {
            pop.value = (isImperial && preset.popup_message_imperial) ? preset.popup_message_imperial : preset.popup_message;
        }
    }

    // CAN ID, bus, delay
    if (preset.can_id) {
        const cid = item.querySelector(".can-do-act-can-id");
        if (cid) cid.value = preset.can_id;
    }
    if (preset.bus !== undefined) {
        const b = item.querySelector(".can-do-act-bus");
        if (b) b.value = preset.bus.toString();
    }
    if (preset.delay_ms !== undefined) {
        const d = item.querySelector(".can-do-act-delay-ms");
        if (d) d.value = preset.delay_ms;
    }
    if (preset.wait_ms !== undefined) {
        const w = item.querySelector(".can-do-act-wait-ms");
        if (w) w.value = preset.wait_ms;
        updateCanDoDelayPill(item);
    }
    if (preset.mqtt_topic) {
        const mt = item.querySelector(".can-do-act-mqtt-topic");
        if (mt) mt.value = preset.mqtt_topic;
    }
    if (preset.mqtt_payload) {
        const mp = item.querySelector(".can-do-act-mqtt-payload");
        if (mp) mp.value = preset.mqtt_payload;
    }
    if (preset.webhook_url) {
        const wu = item.querySelector(".can-do-act-webhook-url");
        if (wu) wu.value = preset.webhook_url;
    }

    // Check if preset has options
    if (preset.options && Array.isArray(preset.options) && preset.options.length > 0) {
        const defaultOptIdx = Math.max(0, preset.options.findIndex(o => o.default === true));
        if (optionsBox) {
            optionsBox.style.display = "block";
            const gridClass = preset.options.length > 4 ? "grid-many" : "grid-few";
            optionsBox.innerHTML = `
                            <div style="width: 100%;">
                                <div class="can-do-options-label">
                                    <span>Target Value:</span>
                                </div>
                                <div class="can-do-options-grid ${gridClass}">
                                    ${preset.options.map((opt, i) => {
                const label = (isImperial && opt.label_imperial) ? opt.label_imperial : opt.label;
                const isCur = (i === defaultOptIdx);
                return `
                                        <button type="button" class="can-do-state-tile-btn can-do-opt-pill-btn ${isCur ? 'active' : ''}" 
                                            onclick="applyCanDoOptionPill(this, ${catIdx}, ${pIdx}, ${i})">
                                            ${label}
                                        </button>
                                        `;
            }).join("")}
                                </div>
                            </div>`;
        }
        const activeOpt = preset.options[defaultOptIdx] || preset.options[0];
        if (activeOpt && activeOpt.payload) {
            const stepsContainer = item.querySelector(".can-do-payload-steps-container");
            if (stepsContainer) {
                stepsContainer.innerHTML = "";
                renderCanDoPayloadStep(stepsContainer, { payload: activeOpt.payload, repeat: 3 });
                renderCanDoPayloadStep(stepsContainer, { payload: "00 00 00 00 00 00 00 00", repeat: 3 });
            }
        }
        if (activeOpt && (activeOpt.target_temp_c !== undefined || activeOpt.target_temp_f !== undefined)) {
            const tt = item.querySelector(".can-do-act-target-temp");
            if (tt) {
                if (isImperial) {
                    const f = activeOpt.target_temp_f !== undefined ? activeOpt.target_temp_f : Math.round(activeOpt.target_temp_c * 9 / 5 + 32);
                    tt.value = Math.min(82, Math.max(62, f));
                } else {
                    const c = activeOpt.target_temp_c !== undefined ? activeOpt.target_temp_c : Math.round(((activeOpt.target_temp_f - 32) * 5 / 9) * 2) / 2;
                    tt.value = Math.min(28.0, Math.max(17.0, c));
                }
            }
        }
        if (activeOpt) {
            const pop = item.querySelector(".can-do-act-popup-msg");
            if (pop) {
                if (isImperial && activeOpt.popup_imperial) pop.value = activeOpt.popup_imperial;
                else if (activeOpt.popup) pop.value = activeOpt.popup;
            }
        }
    } else {
        if (optionsBox) {
            optionsBox.innerHTML = "";
            optionsBox.style.display = "none";
        }
        if (preset.steps && Array.isArray(preset.steps)) {
            const stepsContainer = item.querySelector(".can-do-payload-steps-container");
            if (stepsContainer) {
                stepsContainer.innerHTML = "";
                preset.steps.forEach(s => renderCanDoPayloadStep(stepsContainer, s));
            }
        }
    }

    const pName = (isImperial && preset.name_imperial) ? preset.name_imperial : preset.name;
    showNotification("Applied action template: " + pName, "green", 3500);
    togglePresetToolbarButtons(item);
}

function applyCanDoOptionPill(btn, catIdx, pIdx, optIdx) {
    const item = btn.closest(".can-do-action-item");
    if (!item) return;
    const cats = getFilteredActionPresets();
    const preset = cats[catIdx]?.presets[pIdx];
    const opt = preset?.options ? preset.options[optIdx] : null;
    if (!opt) return;
    const isImperial = (getUnitSystem() === "imperial");

    // Update active tile styling
    const box = item.querySelector(".can-do-act-options-container");
    if (box) {
        box.querySelectorAll(".can-do-opt-pill-btn").forEach((b, i) => {
            b.classList.toggle("active", i === optIdx);
            b.removeAttribute("style");
        });
    }

    // Apply payload to byte steps (3x burst + idle release)
    if (opt.payload) {
        const stepsContainer = item.querySelector(".can-do-payload-steps-container");
        if (stepsContainer) {
            stepsContainer.innerHTML = "";
            renderCanDoPayloadStep(stepsContainer, { payload: opt.payload, repeat: 3 });
            renderCanDoPayloadStep(stepsContainer, { payload: "00 00 00 00 00 00 00 00", repeat: 3 });
        }
    }

    // Apply target temp
    if (opt.target_temp_c !== undefined || opt.target_temp_f !== undefined) {
        const tt = item.querySelector(".can-do-act-target-temp");
        if (tt) {
            if (isImperial) {
                const f = opt.target_temp_f !== undefined ? opt.target_temp_f : Math.round(opt.target_temp_c * 9 / 5 + 32);
                tt.value = Math.min(82, Math.max(62, f));
            } else {
                const c = opt.target_temp_c !== undefined ? opt.target_temp_c : Math.round(((opt.target_temp_f - 32) * 5 / 9) * 2) / 2;
                tt.value = Math.min(28.0, Math.max(17.0, c));
            }
        }
    }

    // Apply popup
    if (isImperial && opt.popup_imperial) {
        const pop = item.querySelector(".can-do-act-popup-msg");
        if (pop) pop.value = opt.popup_imperial;
    } else if (opt.popup) {
        const pop = item.querySelector(".can-do-act-popup-msg");
        if (pop) pop.value = opt.popup;
    }

    const label = (isImperial && opt.label_imperial) ? opt.label_imperial : opt.label;
    const pName = (isImperial && preset.name_imperial) ? preset.name_imperial : preset.name;
    showNotification(`Selected ${pName}: ${label}`, "green", 2500);
}

function insertCanDoPopupToken(elem, token) {
    const row = elem.closest("tr");
    if (!row) return;
    const input = row.querySelector(".can-do-act-popup-msg");
    if (!input) return;
    input.value = (input.value ? input.value + " " : "") + token;
    input.focus();
}

// Unit-aware token inserter: resolves to the right token based on user's unit preference
function insertCanDoPopupTokenUnit(elem, tokenBase) {
    const isImperial = (getUnitSystem() === "imperial");
    let token;
    if (tokenBase === "battery_temp") {
        token = isImperial ? "{battery_temp_f}" : "{battery_temp}";
    } else if (tokenBase === "speed") {
        token = isImperial ? "{speed_mph}" : "{speed_kmh}";
    } else {
        token = "{" + tokenBase + "}";
    }
    insertCanDoPopupToken(elem, token);
}
// Card toggle collapse helpers
function toggleCanDoRuleCard(elem) {
    const card = elem.closest(".can-do-rule-card");
    if (!card) return;
    const body = card.querySelector(".can-do-rule-body");
    const nameInput = card.querySelector(".can-do-name");
    if (!body) return;

    const isHidden = body.classList.contains("hidden") || body.style.display === "none";
    if (isHidden) {
        body.classList.remove("hidden");
        body.style.display = "block";
        if (nameInput) {
            nameInput.style.borderColor = "var(--border-color)";
            nameInput.style.backgroundColor = "var(--input-bg)";
            nameInput.style.boxShadow = "var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.05))";
        }
    } else {
        body.classList.add("hidden");
        body.style.display = "none";
        if (nameInput) {
            nameInput.style.borderColor = "var(--border-color)";
            nameInput.style.backgroundColor = "transparent";
            nameInput.style.boxShadow = "none";
        }
    }
}

function handleCanDoEditSave(btn) {
    const card = btn.closest(".can-do-rule-card");
    if (!card) return;
    const body = card.querySelector(".can-do-rule-body");
    const isHidden = body ? (body.classList.contains("hidden") || body.style.display === "none") : false;

    if (isHidden) {
        toggleCanDoRuleCard(btn);
    } else {
        saveCanDoRulesUI(btn);
    }
}

function handleCanDoHeaderClick(event, headerElem) {
    if (event.target.closest("button") || event.target.closest("input") || event.target.closest("select") || event.target.closest("textarea")) {
        return;
    }
    toggleCanDoRuleCard(headerElem);
}


/* --- AUTOMATIONS TOP TOOLBAR HELPERS (MATCHING HOME ASSISTANT) --- */
function collapseAllCanDoRules() {
    const cards = document.querySelectorAll("#can_do_rules_container .can-do-rule-card");
    cards.forEach(card => {
        const body = card.querySelector(".can-do-rule-body");
        const editBtn = card.querySelector(".can-do-edit-btn");
        if (body) {
            body.classList.add("hidden");
            body.style.display = "none";
        }
        if (editBtn) {
            editBtn.textContent = "Edit";
            editBtn.classList.remove("btn-save");
            editBtn.classList.add("btn-edit");
            editBtn.style.background = "";
        }
        // Also collapse inner subitems
        card.querySelectorAll(".can-do-subitem-body").forEach(b => {
            b.style.display = "none";
        });
    });
    if (typeof showNotification === "function") {
        showNotification("All automations collapsed", "blue", 1800);
    }
}

function expandAllCanDoRules() {
    const cards = document.querySelectorAll("#can_do_rules_container .can-do-rule-card");
    cards.forEach(card => {
        const body = card.querySelector(".can-do-rule-body");
        const editBtn = card.querySelector(".can-do-edit-btn");
        if (body) {
            body.classList.remove("hidden");
            body.style.display = "block";
        }
        if (editBtn) {
            editBtn.textContent = "Save";
            editBtn.classList.remove("btn-edit");
            editBtn.classList.add("btn-save");
        }
        // Also expand inner subitems
        card.querySelectorAll(".can-do-subitem-body").forEach(b => {
            b.style.display = "";
        });
    });
    if (typeof showNotification === "function") {
        showNotification("All automations expanded", "blue", 1800);
    }
}

function showAutomationsGlobalMenu(btn, event) {
    if (event) event.stopPropagation();
    document.querySelectorAll(".can-do-ha-menu, .can-do-floating-menu").forEach(m => m.remove());

    const menu = document.createElement("div");
    menu.className = "can-do-ha-menu";
    menu.innerHTML = `
                        <div class="can-do-ha-menu-item" onclick="toggleCanDoGlobalSettingsModal(); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                            <span>Catalog &amp; Settings...</span>
                        </div>
                        <div class="can-do-ha-menu-divider"></div>
                        <div class="can-do-ha-menu-item" onclick="exportCanDoRules(); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                            <span>Export All (Backup JSON)</span>
                        </div>
                        <div class="can-do-ha-menu-item" onclick="triggerCanDoRulesImport(); document.querySelectorAll('.can-do-ha-menu').forEach(m => m.remove());">
                            <span>Import Automations JSON...</span>
                        </div>
                    `;

    positionFloatingMenu(menu, btn);

    const closeHandler = (e) => {
        if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            menu.remove();
            document.removeEventListener("click", closeHandler);
        }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
}

function triggerCanDoRulesImport() {
    let input = document.getElementById("can_do_import_file");
    if (!input) {
        input = document.createElement("input");
        input.type = "file";
        input.id = "can_do_import_file";
        input.accept = ".json";
        input.style.display = "none";
        input.onchange = function () { importCanDoRules(this); };
        document.body.appendChild(input);
    }
    input.click();
}

function saveCanDoCatalogUrl(url) {
    if (!url) return;
    const trimmed = url.trim();
    const current = (localStorage.getItem("wican_can_do_catalog_url") || DEFAULT_CAN_DO_CATALOG_URL).trim();
    if (trimmed !== current) {
        if (trimmed === DEFAULT_CAN_DO_CATALOG_URL) {
            localStorage.removeItem("wican_can_do_catalog_url");
        } else {
            localStorage.setItem("wican_can_do_catalog_url", trimmed);
        }
        syncCatalogFromGitHub(true);
    }
}

function saveCanDoGlobalSettings(btn) {
    try {
        const urlInput = document.getElementById("modal_catalog_url");
        if (urlInput) {
            saveCanDoCatalogUrl(urlInput.value);
        }
    } catch (e) {
        console.error("Error saving catalog URL:", e);
    }
    const overlay = btn ? btn.closest(".can-do-global-settings-modal-overlay") : document.querySelector(".can-do-global-settings-modal-overlay");
    if (overlay) {
        overlay.remove();
    }
    showNotification("Settings updated successfully", "green", 2000);
}

function toggleCanDoGlobalSettingsModal() {
    document.querySelectorAll(".can-do-global-settings-modal-overlay").forEach(el => el.remove());

    const currentUnit = getUnitSystem();

    const overlay = document.createElement("div");
    overlay.className = "can-do-global-settings-modal-overlay ha-add-element-dialog-overlay";
    overlay.innerHTML = `
                        <div class="ha-add-element-dialog" style="max-width: 520px;" onclick="event.stopPropagation();">
                            <div class="ha-dialog-header">
                                <div class="ha-dialog-header-top">
                                    <div class="ha-dialog-title-wrap">
                                        <span class="can-do-ha-pill cond-pill">Settings</span>
                                        <h3 class="ha-dialog-title">Catalog &amp; Global Settings</h3>
                                    </div>
                                    <button type="button" class="ha-dialog-close-btn" onclick="this.closest('.can-do-global-settings-modal-overlay').remove();">✕</button>
                                </div>
                            </div>
                            <div class="ha-dialog-body" style="padding: 1.25rem; gap: 1.1rem; display: flex; flex-direction: column;">
                                <!-- Vehicle Make & Model Selection -->
                                <div class="ha-form-row" style="display: flex; flex-direction: column; gap: 0.35rem;">
                                    <label style="font-weight: 600; font-size: 0.85rem; color: var(--text-heading);">Vehicle Model / Platform:</label>
                                    <select id="can_do_vehicle_model" class="ha-form-select" onchange="changeCanDoVehicleModel(this.value)" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--input-bg); font-size: 0.88rem; color: var(--text-heading); box-sizing: border-box;">
                                    </select>
                                    <span style="font-size: 0.74rem; color: var(--text-muted);">Select your vehicle model family to load compatible CAN presets and signals.</span>
                                </div>

                                <!-- Vehicle Trim Selection -->
                                <div class="ha-form-row" style="display: flex; flex-direction: column; gap: 0.35rem;">
                                    <label style="font-weight: 600; font-size: 0.85rem; color: var(--text-heading);">Trim Level / Specific Variant:</label>
                                    <select id="can_do_vehicle_trim" class="ha-form-select" onchange="changeCanDoVehicleTrim(this.value)" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--input-bg); font-size: 0.88rem; color: var(--text-heading); box-sizing: border-box;">
                                    </select>
                                    <span style="font-size: 0.74rem; color: var(--text-muted);">Trim variants enable vehicle-specific features like ventilated seats, AWD, or HUD.</span>
                                </div>

                                <!-- Imperial / Metric Unit System -->
                                <div class="ha-form-row" style="display: flex; flex-direction: column; gap: 0.35rem;">
                                    <label style="font-weight: 600; font-size: 0.85rem; color: var(--text-heading);">Measurement Units:</label>
                                    <select id="can_do_unit_system" class="ha-form-select" onchange="changeUnitSystem(this.value)" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--input-bg); font-size: 0.88rem; color: var(--text-heading); box-sizing: border-box;">
                                        <option value="metric" ${currentUnit === "metric" ? "selected" : ""}>Metric (°C, km/h, bar, kPa)</option>
                                        <option value="imperial" ${currentUnit === "imperial" ? "selected" : ""}>Imperial (°F, mph, psi)</option>
                                    </select>
                                    <span style="font-size: 0.74rem; color: var(--text-muted);">Controls climate setpoint scales and sensor threshold units.</span>
                                </div>

                                <div style="border-top: 1px dashed var(--border-color); margin: 0.2rem 0;"></div>

                                <!-- Remote Catalog URL -->
                                <div class="ha-form-row" style="display: flex; flex-direction: column; gap: 0.35rem;">
                                    <label style="font-weight: 600; font-size: 0.85rem; color: var(--text-heading);">Remote Catalog Sync URL:</label>
                                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                                        <input type="text" id="modal_catalog_url" value="${getCanDoCatalogUrl()}" style="flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--input-bg); font-size: 0.85rem; color: var(--text-heading); box-sizing: border-box;">
                                        <button type="button" class="dash-outline-btn" onclick="syncCatalogFromGitHub(true)" style="padding: 8px 12px; font-size: 0.8rem; white-space: nowrap;">Sync Now</button>
                                    </div>
                                    <span style="font-size: 0.74rem; color: var(--text-muted);">GitHub RAW or local URL for remote CAN preset catalog JSON.</span>
                                </div>

                                <div style="display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.5rem;">
                                    <button type="button" class="dash-outline-btn" onclick="this.closest('.can-do-global-settings-modal-overlay').remove();">Cancel</button>
                                    <button type="button" class="dash-action-btn" onclick="saveCanDoGlobalSettings(this);">Done</button>
                                </div>
                            </div>
                        </div>
                    `;
    document.body.appendChild(overlay);
    overlay.onclick = () => overlay.remove();

    // Populate vehicle make/model/trim dropdowns from catalog
    try {
        populateVehicleDropdowns(getCatalogVehicles());
    } catch (e) {
        console.error("Error populating vehicle dropdowns:", e);
    }
}

function filterCanDoRules(query) {
    const q = (query || "").toLowerCase().trim();
    const cards = document.querySelectorAll("#can_do_rules_container .can-do-rule-card");
    cards.forEach(card => {
        if (!q) {
            card.style.display = "";
            return;
        }
        const name = (card.querySelector(".can-do-name")?.value || "").toLowerCase();
        const textContent = card.innerText.toLowerCase();
        const inputs = Array.from(card.querySelectorAll("input, select")).map(i => (i.value || "").toLowerCase()).join(" ");
        if (name.includes(q) || textContent.includes(q) || inputs.includes(q)) {
            card.style.display = "";
        } else {
            card.style.display = "none";
        }
    });
}


function selectCanDoItem(itemElem) {
    if (!itemElem) return;
    const card = itemElem.closest('.can-do-rule-card');
    if (!card) return;
    card.querySelectorAll('.can-do-trigger-item, .can-do-condition-item, .can-do-action-item, .can-do-condition-group, .can-do-choose-block, .can-do-ifthen-block').forEach(el => {
        if (el !== itemElem) el.classList.remove('selected');
    });
    itemElem.classList.add('selected');
}

function toggleCanDoItemBody(headerElem, ev) {
    if (ev) {
        // If the user clicked directly on an interactive button or input inside the header, don't toggle
        const interactive = ev.target.closest('button, input, select, label, .system-button');
        if (interactive && !ev.target.closest('.can-do-item-chevron')) {
            return;
        }
    }
    const item = headerElem.closest(".can-do-trigger-item, .can-do-condition-item, .can-do-action-item, .can-do-choose-block, .can-do-ifthen-block");
    if (!item) return;
    const body = item.querySelector(".can-do-subitem-body, .can-do-group-conditions-box, .can-do-choose-options-container");
    if (!body) return;
    const isHidden = (body.style.display === "none");
    if (isHidden) {
        // Expanding
        body.style.display = "";
        headerElem.style.borderBottom = "1px solid var(--border-color)";
        item.classList.remove("can-do-subitem-collapsed");
        selectCanDoItem(item);
    } else {
        // Collapsing: do NOT force selection; remove selected so collapsed boxes do not glow
        body.style.display = "none";
        headerElem.style.borderBottom = "none";
        item.classList.add("can-do-subitem-collapsed");
        item.classList.remove("selected");
    }
}


/* --- MOVE AUTOMATION RULE UP / DOWN --- */
function moveCanDoRule(btn, direction) {
    const card = btn.closest(".can-do-rule-card");
    if (!card) return;
    const container = card.parentElement;
    if (!container) return;

    const cards = Array.from(container.querySelectorAll(":scope > .can-do-rule-card"));
    const idx = cards.indexOf(card);
    if (idx === -1) return;

    const origRect = btn.getBoundingClientRect();
    const origDocY = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (direction === -1 && idx > 0) {
        container.insertBefore(card, cards[idx - 1]);
        triggerItemAnimation(card, "ha-item-move-up");
    } else if (direction === 1 && idx < cards.length - 1) {
        container.insertBefore(card, cards[idx + 1].nextElementSibling);
        triggerItemAnimation(card, "ha-item-move-down");
    }

    const newRect = btn.getBoundingClientRect();
    const deltaY = newRect.top - origRect.top;
    if (Math.abs(deltaY) > 1) {
        window.scrollTo({ top: origDocY + deltaY, behavior: "instant" });
    }

    markCanDoDirty();
}

function scrollToNewBlockHelper(elem, topOffset = 80) {
    if (!elem) return;
    triggerItemAnimation(elem, "ha-item-duplicate");
    setTimeout(() => {
        const rect = elem.getBoundingClientRect();
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        const targetScrollY = currentScrollY + rect.top - topOffset;
        window.scrollTo({
            top: Math.max(0, targetScrollY),
            behavior: "smooth"
        });
    }, 60);
}

function triggerItemAnimation(elem, animClass) {
    if (!elem) return;
    elem.classList.remove("ha-item-highlight", "ha-item-move-up", "ha-item-move-down", "ha-item-duplicate");
    // Force reflow
    void elem.offsetWidth;
    elem.classList.add(animClass);
    setTimeout(() => {
        elem.classList.remove(animClass);
    }, 700);
}

function moveCanDoItem(btn, direction) {
    const item = btn.closest(".can-do-action-item, .can-do-trigger-item, .can-do-condition-item, .can-do-condition-group, .can-do-condition-or-group, .can-do-choose-block, .can-do-ifthen-block, .can-do-choose-option-item, .can-do-payload-step-item");
    if (!item) return;
    const parent = item.parentElement;
    const selector = item.classList.contains("can-do-payload-step-item")
        ? ".can-do-payload-step-item"
        : (item.classList.contains("can-do-choose-option-item")
            ? ".can-do-choose-option-item"
            : (item.classList.contains("can-do-action-item") || item.classList.contains("can-do-choose-block") || item.classList.contains("can-do-ifthen-block")
                ? ":scope > .can-do-action-item, :scope > .can-do-choose-block, :scope > .can-do-ifthen-block"
                : (item.classList.contains("can-do-trigger-item")
                    ? ".can-do-trigger-item"
                    : ":scope > .can-do-condition-item, :scope > .can-do-condition-group, :scope > .can-do-condition-or-group")));

    const siblings = Array.from(parent.querySelectorAll(selector));
    const idx = siblings.indexOf(item);
    if (idx === -1) return;

    // Anchor button viewport position so moving items never jumps the screen
    const origRect = btn.getBoundingClientRect();
    const origDocY = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (direction === -1 && idx > 0) {
        parent.insertBefore(item, siblings[idx - 1]);
        triggerItemAnimation(item, "ha-item-move-up");
    } else if (direction === 1 && idx < siblings.length - 1) {
        parent.insertBefore(item, siblings[idx + 1].nextElementSibling);
        triggerItemAnimation(item, "ha-item-move-down");
    }

    const newRect = btn.getBoundingClientRect();
    const deltaY = newRect.top - origRect.top;
    if (Math.abs(deltaY) > 1) {
        window.scrollTo({ top: origDocY + deltaY, behavior: "instant" });
    }

    if (item.classList.contains("can-do-payload-step-item")) {
        renumberCanDoPayloadSteps(parent);
    }
    if (item.classList.contains("can-do-choose-option-item")) {
        renumberCanDoChooseOptions(parent);
    }
    const card = btn.closest(".can-do-rule-card");
    if (card) {
        updateCanDoSectionCountBadges(card);
    }
}

function updateCanDoItemConnectors(card) {
    if (!card) return;

    // 1. Triggers container
    const trigContainer = card.querySelector(".can-do-triggers-container");
    if (trigContainer) {
        trigContainer.querySelectorAll(".can-do-connector-divider").forEach(el => el.remove());
        const trigItems = Array.from(trigContainer.querySelectorAll(".can-do-trigger-item"));
        for (let i = 0; i < trigItems.length - 1; i++) {
            const div = document.createElement("div");
            div.className = "can-do-connector-divider";
            div.innerHTML = `<span class="can-do-connector-line trig"></span><span class="can-do-connector-pill trig" style="padding: 2px 12px; font-weight: 800;">OR</span><span class="can-do-connector-line trig"></span>`;
            trigContainer.insertBefore(div, trigItems[i + 1]);
        }
    }

    // 2. Conditions containers (recursive helper)
    function updateConditionContainerConnectors(container, defaultLabel = "AND", variantClass = "cond") {
        if (!container) return;
        container.querySelectorAll(":scope > .can-do-connector-divider").forEach(el => el.remove());
        const items = Array.from(container.querySelectorAll(":scope > .can-do-condition-item, :scope > .can-do-condition-group, :scope > .can-do-condition-or-group"));
        for (let i = 0; i < items.length - 1; i++) {
            const div = document.createElement("div");
            div.className = "can-do-connector-divider";
            div.innerHTML = `<span class="can-do-connector-line ${variantClass}"></span><span class="can-do-connector-pill ${variantClass}" style="padding: 2px 12px; font-weight: 800;">${defaultLabel}</span><span class="can-do-connector-line ${variantClass}"></span>`;
            container.insertBefore(div, items[i + 1]);
        }
    }

    const condContainer = card.querySelector(".can-do-conditions-container");
    if (condContainer) {
        updateConditionContainerConnectors(condContainer, "AND", "cond");

        // Groups (AND, OR, NOT)
        condContainer.querySelectorAll(".can-do-condition-group").forEach(group => {
            const gType = group.dataset.groupType || "or";
            const innerCont = group.querySelector(".can-do-group-conditions-container");
            if (gType === "and") {
                updateConditionContainerConnectors(innerCont, "AND", "group-and");
            } else if (gType === "not") {
                updateConditionContainerConnectors(innerCont, "NOR", "group-not");
            } else {
                updateConditionContainerConnectors(innerCont, "OR", "group-or");
            }
        });

        // Legacy OR groups
        condContainer.querySelectorAll(".can-do-condition-or-group").forEach(group => {
            const innerCont = group.querySelector(".can-do-or-group-container");
            updateConditionContainerConnectors(innerCont, "OR", "group-or");
        });
    }

    // 3. Actions containers
    function updateActionContainerConnectors(container) {
        if (!container) return;
        container.querySelectorAll(":scope > .can-do-connector-divider").forEach(el => el.remove());
        const actItems = Array.from(container.querySelectorAll(":scope > .can-do-action-item, :scope > .can-do-choose-block, :scope > .can-do-ifthen-block"));
        for (let i = 0; i < actItems.length - 1; i++) {
            const div = document.createElement("div");
            div.className = "can-do-connector-divider";
            div.innerHTML = `<span class="can-do-connector-line act"></span><span class="can-do-connector-pill act" style="padding: 2px 12px; font-weight: 800;">↓ THEN</span><span class="can-do-connector-line act"></span>`;
            container.insertBefore(div, actItems[i + 1]);
        }
    }

    const actContainer = card.querySelector(".can-do-actions-container");
    if (actContainer) {
        updateActionContainerConnectors(actContainer);

        // Choose blocks
        actContainer.querySelectorAll(".can-do-choose-block").forEach(block => {
            const optContainer = block.querySelector(".can-do-choose-options-container");
            if (optContainer) {
                optContainer.querySelectorAll(":scope > .can-do-connector-divider").forEach(el => el.remove());
                const optItems = Array.from(optContainer.querySelectorAll(":scope > .can-do-choose-option-item"));
                for (let i = 0; i < optItems.length - 1; i++) {
                    const div = document.createElement("div");
                    div.className = "can-do-connector-divider";
                    div.innerHTML = `<span class="can-do-connector-line choose"></span><span class="can-do-connector-pill choose" style="padding: 2px 12px; font-weight: 800;">ELSE IF</span><span class="can-do-connector-line choose"></span>`;
                    optContainer.insertBefore(div, optItems[i + 1]);
                }

                optItems.forEach(optItem => {
                    updateActionContainerConnectors(optItem.querySelector(".can-do-opt-actions-container"));
                });
            }
        });

        // If-Then blocks
        actContainer.querySelectorAll(".can-do-ifthen-block").forEach(block => {
            updateConditionContainerConnectors(block.querySelector(".can-do-ifthen-conditions-container"), "AND", "ifthen");
            updateActionContainerConnectors(block.querySelector(".can-do-ifthen-then-container"));
            updateActionContainerConnectors(block.querySelector(".can-do-ifthen-else-container"));
        });

        // Inner payload steps
        actContainer.querySelectorAll(".can-do-payload-steps-container").forEach(stepsCont => {
            stepsCont.querySelectorAll(".can-do-connector-divider").forEach(el => el.remove());
            const stepItems = Array.from(stepsCont.querySelectorAll(".can-do-payload-step-item"));
            for (let i = 0; i < stepItems.length - 1; i++) {
                const div = document.createElement("div");
                div.className = "can-do-connector-divider";
                div.innerHTML = `<span class="can-do-connector-line act"></span><span class="can-do-connector-pill act" style="padding: 2px 10px; border-radius: 12px; font-weight: 700;">↓ next frame</span><span class="can-do-connector-line act"></span>`;
                stepsCont.insertBefore(div, stepItems[i + 1]);
            }
        });
    }
}

function updateCanDoRuleSummaryPill(card) {
    if (!card) return;
    const pill = card.querySelector(".can-do-summary-pill");
    if (!pill) return;

    // Triggers summary
    const trigItems = card.querySelectorAll(".can-do-trigger-item");
    const trigSummaries = [];
    trigItems.forEach(t => {
        const src = t.querySelector(".can-do-trig-source")?.value || "preset";
        const forSec = parseFloat(t.querySelector(".can-do-trig-for-sec")?.value || "0");
        let sText = "";
        if (src === "preset") {
            const picker = t.querySelector(".can-do-trig-preset-picker");
            const selText = (picker && picker.selectedIndex >= 0) ? picker.options[picker.selectedIndex].text : "";
            sText = selText || "Button Preset";
        } else if (src === "can_msg") {
            const cid = t.querySelector(".can-do-trig-can-id")?.value || "";
            sText = cid ? `CAN ${cid}` : "Raw CAN";
        } else if (src === "ha_mqtt" || src === "mqtt_cmd") {
            const payload = t.querySelector(".can-do-trig-mqtt-payload")?.value || "";
            const topic = t.querySelector(".can-do-trig-mqtt-topic")?.value || "wican/can_do/trigger";
            sText = payload ? `HA (${payload})` : `HA (${topic})`;
        } else if (src === "clock") {
            const tm = t.querySelector(".can-do-trig-time")?.value || "";
            sText = tm ? `Time: ${tm}` : "Clock";
        } else if (src === "voltage") {
            const v = t.querySelector(".can-do-trig-voltage-val")?.value || "";
            sText = v ? `< ${v}V` : "Voltage";
        } else if (src === "interval") {
            const sec = t.querySelector(".can-do-trig-interval-sec")?.value || "";
            sText = sec ? `Every ${sec}s` : "Interval";
        } else {
            sText = src;
        }
        const clickCount = parseInt(t.querySelector(".can-do-trig-click-count")?.value || "1");
        if (clickCount === 2) {
            sText += " (Double)";
        } else if (clickCount === 3) {
            sText += " (Triple)";
        }
        if (forSec > 0 && src !== "clock" && src !== "interval") {
            sText += ` (${forSec}s)`;
        }
        trigSummaries.push(sText);
    });

    // Conditions summary
    const condItems = card.querySelectorAll(".can-do-conditions-container > .can-do-condition-item, .can-do-conditions-container > .can-do-condition-group");
    const condSummaries = [];
    condItems.forEach(c => {
        if (c.classList.contains("can-do-condition-group")) {
            const gType = (c.dataset.groupType || "and").toUpperCase();
            condSummaries.push(`${gType} group`);
            return;
        }
        const cType = c.querySelector(".can-do-cond-type")?.value || "preset";
        if (cType === "preset") {
            const picker = c.querySelector(".can-do-cond-preset-picker");
            const selText = (picker && picker.selectedIndex >= 0) ? picker.options[picker.selectedIndex].text : "";
            condSummaries.push(selText || "Preset Condition");
        } else if (cType === "param_range") {
            const expr = c.querySelector(".can-do-cond-expr")?.value || "";
            condSummaries.push(expr ? `State: ${expr}` : "Param Range");
        } else if (cType === "voltage") {
            const v = c.querySelector(".can-do-cond-voltage-val")?.value || "12.0";
            const dir = c.querySelector(".can-do-cond-voltage-dir")?.value || "below";
            condSummaries.push(`12V ${dir === "below" ? "<" : ">"} ${v}V`);
        } else {
            condSummaries.push(cType);
        }
    });

    // Actions summary
    const actItems = card.querySelectorAll(".can-do-actions-container > .can-do-action-item, .can-do-actions-container > .can-do-choose-block, .can-do-actions-container > .can-do-ifthen-block");
    const actSummaries = [];
    actItems.forEach(a => {
        if (a.classList.contains("can-do-choose-block")) {
            const optCount = a.querySelectorAll(".can-do-choose-option-item").length;
            actSummaries.push(`Choose (${optCount} branches)`);
            return;
        }
        if (a.classList.contains("can-do-ifthen-block")) {
            actSummaries.push("If-Then-Else");
            return;
        }
        const actType = a.querySelector(".can-do-act-type")?.value || "can_tx";
        const isImp = (getUnitSystem() === "imperial");
        const u = isImp ? "°F" : "°C";
        if (actType === "preset") {
            const picker = a.querySelector(".can-do-act-preset-picker");
            const selText = (picker && picker.selectedIndex > 0) ? picker.options[picker.selectedIndex].text : "";
            if (selText) {
                actSummaries.push(selText);
            } else if (!a.querySelector(".act-field-climate")?.classList.contains("hidden")) {
                const tt = a.querySelector(".can-do-act-target-temp")?.value || (isImp ? "72" : "21.0");
                actSummaries.push(`Climate ${tt}${u}`);
            } else if (!a.querySelector(".act-field-precon")?.classList.contains("hidden")) {
                const pm = a.querySelector(".can-do-act-precon-mode")?.value || "persistent";
                actSummaries.push(`Precondition (${pm})`);
            } else {
                actSummaries.push("Preset Template");
            }
        } else if (actType === "popup") {
            const pop = a.querySelector(".can-do-act-popup-msg")?.value || "";
            actSummaries.push(pop ? `Popup "${pop.substring(0, 15)}${pop.length > 15 ? "…" : ""}"` : "Popup");
        } else if (actType === "can_tx") {
            const cid = a.querySelector(".can-do-act-can-id")?.value || "";
            actSummaries.push(cid ? `TX ${cid}` : "CAN Sequence");
        } else if (actType === "delay") {
            const ms = a.querySelector(".can-do-act-wait-ms")?.value || "500";
            actSummaries.push(`Wait ${formatDurationDisplay(ms)}`);
        } else if (actType === "mqtt") {
            actSummaries.push("MQTT Alert");
        } else if (actType === "webhook") {
            actSummaries.push("Webhook");
        } else {
            actSummaries.push(actType);
        }
    });

    const trigText = trigSummaries.length > 0 ? trigSummaries.slice(0, 2).join(" • ") + (trigSummaries.length > 2 ? ` (+${trigSummaries.length - 2})` : "") : "No Trigger";
    const condText = condSummaries.length > 0 ? condSummaries.slice(0, 2).join(" • ") + (condSummaries.length > 2 ? ` (+${condSummaries.length - 2})` : "") : "";
    const actText = actSummaries.length > 0 ? actSummaries.slice(0, 2).join(" • ") + (actSummaries.length > 2 ? ` (+${actSummaries.length - 2})` : "") : "No Action";

    pill.innerHTML = `
                        <span class="can-do-ha-pill trig-pill" style="font-size: 0.72rem; padding: 2px 7px;">
                            When: ${trigText}
                        </span>
                        ${condText ? `<span class="can-do-ha-pill cond-pill" style="font-size: 0.72rem; padding: 2px 7px;">And if: ${condText}</span>` : ''}
                        <span class="can-do-ha-pill act-pill" style="font-size: 0.72rem; padding: 2px 7px;">
                            Then do: ${actText}
                        </span>
                    `;
}

function updateCanDoSectionCountBadges(card) {
    if (!card) return;
    const trigCount = card.querySelectorAll(".can-do-trigger-item").length;
    const condCount = card.querySelectorAll(".can-do-conditions-container > .can-do-condition-item, .can-do-conditions-container > .can-do-condition-group, .can-do-conditions-container > .can-do-condition-or-group").length;
    const actCount = card.querySelectorAll(".can-do-actions-container > .can-do-action-item, .can-do-actions-container > .can-do-choose-block, .can-do-actions-container > .can-do-ifthen-block").length;

    const trigBadge = card.querySelector(".can-do-trig-count-badge");
    if (trigBadge) trigBadge.textContent = trigCount;

    const condBadge = card.querySelector(".can-do-cond-count-badge");
    if (condBadge) condBadge.textContent = condCount;

    const actBadge = card.querySelector(".can-do-act-count-badge");
    if (actBadge) actBadge.textContent = actCount;

    const offActCount = card.querySelectorAll(".can-do-off-actions-container > .can-do-action-item, .can-do-off-actions-container > .can-do-choose-block, .can-do-off-actions-container > .can-do-ifthen-block").length;
    const offActBadge = card.querySelector(".can-do-off-act-count-badge");
    if (offActBadge) offActBadge.textContent = offActCount;

    // Smart 1-click Suggestion Banner for >1 Triggers
    const bannerSlot = card.querySelector(".can-do-choose-banner-slot");
    if (bannerSlot) {
        const hasChooseBlock = card.querySelector(".can-do-actions-container > .can-do-choose-block") !== null;
        if (trigCount >= 2 && !hasChooseBlock) {
            bannerSlot.innerHTML = `
                            <div class="can-do-choose-convert-banner" style="margin-bottom: 0.6rem; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem;">
                                <span style="font-weight: 600;"><b>${trigCount} Triggers Detected:</b> Currently running the same actions for all triggers.</span>
                                <button type="button" class="system-button" onclick="convertActionsToChooseBlock(this)" style="padding: 4px 10px; font-size: 0.76rem; font-weight: 700; background: var(--m3-tonal-choose-color); color: white; border: none; border-radius: 4px; cursor: pointer; transition: all 0.2s;" title="Automatically split and branch actions by trigger">Branch by Trigger (Choose Block)</button>
                            </div>
                        `;
        } else {
            bannerSlot.innerHTML = "";
        }
    }

    updateCanDoItemConnectors(card);
    updateCanDoRuleTriggerDropdowns(card);
    updateCanDoRuleSummaryPill(card);
}

function updateCanDoActivityStats(statsArray) {
    if (!statsArray || !Array.isArray(statsArray)) return;
    const cards = document.querySelectorAll("#can_do_rules_container .can-do-rule-card");
    statsArray.forEach((st, idx) => {
        const card = cards[idx];
        if (!card) return;
        const badge = card.querySelector(".can-do-activity-badge");
        if (!badge) return;

        const isRuleEnabled = card.querySelector(".can-do-rule-enabled") ? card.querySelector(".can-do-rule-enabled").checked : true;
        if (!isRuleEnabled) {
            badge.className = "can-do-activity-badge paused";
            badge.textContent = "Paused";
            badge.style.background = "";
            badge.style.color = "";
            badge.style.borderColor = "";
            badge.style.boxShadow = "";
            badge.title = "Automation paused";
            return;
        }

        if (st.is_active) {
            const ageSec = (st.age_ms !== undefined && st.age_ms >= 0) ? Math.round(st.age_ms / 1000) : 0;
            let ageStr = `${ageSec}s ago`;
            if (ageSec > 60) ageStr = `${Math.floor(ageSec / 60)}m ago`;
            badge.className = "can-do-activity-badge active-on";
            badge.textContent = `ON (${st.count}x, ${ageStr})`;
            badge.style.background = "";
            badge.style.color = "";
            badge.style.borderColor = "";
            badge.style.boxShadow = "";
            badge.title = "Rule is currently TOGGLED ON";
        } else if (st.count === 0 || st.age_ms === -1) {
            badge.className = "can-do-activity-badge idle";
            badge.textContent = "Idle";
            badge.style.background = "";
            badge.style.color = "";
            badge.style.borderColor = "";
            badge.style.boxShadow = "";
            badge.title = "Live trigger activity";
        } else {
            const ageSec = Math.round(st.age_ms / 1000);
            let ageStr = `${ageSec}s ago`;
            if (ageSec > 60) {
                ageStr = `${Math.floor(ageSec / 60)}m ago`;
            }
            badge.textContent = `${st.count}x (${ageStr})`;
            badge.title = `Fired ${st.count} time(s), last ${ageStr}`;

            // Highlight if fired recently (< 4s)
            if (st.age_ms >= 0 && st.age_ms < 4000) {
                badge.className = "can-do-activity-badge recent-fire";
            } else {
                badge.className = "can-do-activity-badge fired";
            }
            badge.style.background = "";
            badge.style.color = "";
            badge.style.borderColor = "";
            badge.style.boxShadow = "";
        }
    });
}

function extractCanDoActionData(item) {
    const steps = [];
    const payloadLines = [];
    item.querySelectorAll(".can-do-payload-step-item").forEach(stepItem => {
        const p = getByteGridString(stepItem, "can-do-step-byte");
        const rep = parseInt(stepItem.querySelector(".can-do-step-repeat")?.value || "1");
        const delayInp = stepItem.querySelector(".can-do-step-delay-ms")?.value.trim();
        const stepDelay = (delayInp !== "" && !isNaN(parseInt(delayInp))) ? parseInt(delayInp) : undefined;
        if (p) {
            const stepObj = { payload: p, repeat: rep };
            if (stepDelay !== undefined) stepObj.delay_ms = stepDelay;
            steps.push(stepObj);

            let lineStr = p;
            if (rep > 1) lineStr += ` [x${rep}]`;
            if (stepDelay !== undefined) lineStr += ` [${stepDelay}ms]`;
            payloadLines.push(lineStr);
        }
    });

    let actType = item.querySelector(".can-do-act-type")?.value || "can_tx";
    const presetPicker = item.querySelector(".can-do-act-preset-picker");
    const selectedPresetVal = presetPicker?.value || "";
    const selectedPresetName = presetPicker?.selectedOptions[0]?.dataset?.name || "";

    if (actType === "preset") {
        if (selectedPresetVal) {
            const parts = selectedPresetVal.split(/[:_]/);
            const cats = getFilteredActionPresets();
            const presetObj = cats[parseInt(parts[0])]?.presets[parseInt(parts[1])];
            if (presetObj) {
                if (presetObj.type === "climate_target" || presetObj.target_temp_c !== undefined || presetObj.target_temp_f !== undefined) {
                    actType = "climate_target";
                } else if (presetObj.type === "precondition" || presetObj.precon_mode !== undefined) {
                    actType = "precondition";
                } else {
                    actType = "can_tx";
                }
            }
        } else {
            actType = "can_tx";
        }
    }

    const isImperial = (getUnitSystem() === "imperial");
    const rawTemp = parseFloat(item.querySelector(".can-do-act-target-temp")?.value || (isImperial ? "72" : "21.0"));
    let tempC = 21.0;
    let tempF = 72;
    if (isImperial) {
        tempF = Math.min(82, Math.max(62, isNaN(rawTemp) ? 72 : rawTemp));
        tempC = Math.round(((tempF - 32) * 5 / 9) * 2) / 2;
    } else {
        tempC = Math.min(28.0, Math.max(17.0, isNaN(rawTemp) ? 21.0 : rawTemp));
        tempF = Math.round(tempC * 9 / 5 + 32);
    }

    const rawPassTemp = parseFloat(item.querySelector(".can-do-act-pass-temp")?.value || (isImperial ? "72" : "21.0"));
    let passTempC = tempC;
    let passTempF = tempF;
    if (isImperial) {
        passTempF = Math.min(82, Math.max(62, isNaN(rawPassTemp) ? tempF : rawPassTemp));
        passTempC = Math.round(((passTempF - 32) * 5 / 9) * 2) / 2;
    } else {
        passTempC = Math.min(28.0, Math.max(17.0, isNaN(rawPassTemp) ? tempC : rawPassTemp));
        passTempF = Math.round(passTempC * 9 / 5 + 32);
    }

    return {
        trigger_id: item.querySelector(".can-do-act-trig-id")?.value.trim() || "",
        preset_val: selectedPresetVal,
        preset_name: selectedPresetName,
        popup_message: item.querySelector(".can-do-act-popup-msg")?.value.trim() || "",
        type: actType,
        precon_mode: item.querySelector(".can-do-act-precon-mode")?.value || "persistent",
        precon_press: item.querySelector(".can-do-act-precon-press")?.value || "short",
        target_temp_c: tempC,
        target_temp_f: tempF,
        pass_temp_c: passTempC,
        pass_temp_f: passTempF,
        climate_zone: item.querySelector(".can-do-act-climate-zone")?.value || "driver",
        climate_sync_on: item.querySelector(".can-do-act-climate-sync")?.checked !== false,
        climate_driver_only: item.querySelector(".can-do-act-climate-drv-only")?.checked === true,
        can_id: item.querySelector(".can-do-act-can-id")?.value || "",
        steps: steps,
        payload: payloadLines.join("\n"),
        bus: parseInt(item.querySelector(".can-do-act-bus")?.value || "0"),
        delay_ms: parseInt(item.querySelector(".can-do-act-delay-ms")?.value || "10"),
        wait_ms: parseInt(item.querySelector(".can-do-act-wait-ms")?.value || "500"),
        mqtt_topic: item.querySelector(".can-do-act-mqtt-topic")?.value || "",
        mqtt_payload: item.querySelector(".can-do-act-mqtt-payload")?.value || "",
        webhook_url: item.querySelector(".can-do-act-webhook-url")?.value || ""
    };
}

function testCanDoActionUI(btn) {
    const item = btn.closest(".can-do-action-item");
    if (!item) return;
    const actData = extractCanDoActionData(item);
    const originalText = btn.textContent;
    btn.textContent = "Running...";
    btn.classList.add("btn-running");
    btn.disabled = true;

    fetch("/test_can_do_action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actData)
    }).then(res => {
        if (!res.ok) throw new Error("Status " + res.status);
        return res.text();
    }).then(msg => {
        btn.textContent = "✓ Executed!";
        btn.classList.remove("btn-running");
        btn.classList.add("btn-success");
        showNotification(`Action (${actData.type}) executed on CAN bus successfully!`, "green", 3500);
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("btn-success");
            btn.disabled = false;
        }, 2000);
    }).catch(err => {
        btn.textContent = "✕ Error";
        btn.classList.remove("btn-running");
        btn.classList.add("btn-error");
        showNotification("Test action failed: " + err, "red", 4000);
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("btn-error");
            btn.disabled = false;
        }, 2000);
    });
}

async function testAllCanDoActionsUI(btn) {
    const card = btn.closest(".can-do-rule-card");
    if (!card) return;
    const ruleData = extractCanDoRuleData(card);
    const originalText = btn.textContent;
    btn.textContent = "Executing All...";
    btn.classList.add("btn-running");
    btn.disabled = true;

    try {
        const res = await fetch("/test_can_do_rule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ruleData)
        });
        if (!res.ok) throw new Error("Status " + res.status);
        btn.textContent = "✓ Complete!";
        btn.classList.remove("btn-running");
        btn.classList.add("btn-success");
        showNotification(`Rule "${ruleData.name}" executed successfully!`, "green", 3500);
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("btn-success");
            btn.disabled = false;
        }, 2000);
    } catch (err) {
        btn.textContent = "✕ Error";
        btn.classList.remove("btn-running");
        btn.classList.add("btn-error");
        showNotification("Failed to execute rule: " + err, "red", 4000);
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("btn-error");
            btn.disabled = false;
        }, 2000);
    }
}
const testCanDoRuleUI = testAllCanDoActionsUI;

async function dryRunCanDoRuleUI(btn) {
    const card = btn.closest(".can-do-rule-card");
    if (!card) return;
    const ruleData = extractCanDoRuleData(card);
    const originalText = btn.textContent;
    btn.textContent = "Simulating...";
    btn.disabled = true;

    const condButtons = card.querySelectorAll(".can-do-btn-test-cond");
    if (condButtons.length > 0) {
        condButtons.forEach(b => testCanDoConditionUI(b));
        setTimeout(() => {
            btn.textContent = "Evaluated!";
            showNotification(`Dry run complete for "${ruleData.name}": conditions evaluated live without transmitting CAN frames.`, "blue", 4000);
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 2000);
        }, 800);
    } else {
        showNotification(`Rule "${ruleData.name}" has no conditions (unconditional trigger). Actions would execute on event.`, "green", 3500);
        btn.textContent = "✓ Pass (Always)";
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 2000);
    }
}

function extractCanDoConditionElement(elem) {
    if (elem.classList.contains("can-do-condition-group")) {
        const groupType = elem.querySelector(".can-do-group-type")?.value || "or";
        const innerContainer = elem.querySelector(".can-do-group-conditions-container");
        const innerConditions = [];
        if (innerContainer) {
            innerContainer.querySelectorAll(":scope > .can-do-condition-item, :scope > .can-do-condition-group, :scope > .can-do-condition-or-group").forEach(child => {
                innerConditions.push(extractCanDoConditionElement(child));
            });
        }
        return {
            type: groupType + "_group",
            group_type: groupType,
            invert: elem.querySelector(".can-do-group-invert")?.checked || false,
            conditions: innerConditions
        };
    } else if (elem.classList.contains("can-do-condition-or-group")) {
        const innerContainer = elem.querySelector(".can-do-or-group-container");
        const innerConditions = [];
        if (innerContainer) {
            innerContainer.querySelectorAll(":scope > .can-do-condition-item, :scope > .can-do-condition-group, :scope > .can-do-condition-or-group").forEach(child => {
                innerConditions.push(extractCanDoConditionElement(child));
            });
        }
        return {
            type: "or_group",
            group_type: "or",
            invert: elem.querySelector(".can-do-or-group-invert")?.checked || false,
            conditions: innerConditions
        };
    } else {
        const days = [];
        elem.querySelectorAll(".can-do-cond-day:checked").forEach(cb => days.push(cb.value));
        const condCanPayload = getByteGridString(elem, "can-do-cond-can");
        const presetPicker = elem.querySelector(".can-do-cond-preset-picker");
        const selectedPresetVal = presetPicker ? presetPicker.getAttribute("data-selected-preset") || presetPicker.value : "";
        const selectedPresetName = presetPicker?.selectedOptions[0]?.dataset?.name || "";
        let condType = elem.querySelector(".can-do-cond-type")?.value || "param_range";
        if (condType === "preset") {
            condType = elem.dataset.presetType || (elem.querySelector(".cond-field-expr:not(.hidden)") ? "param_range" : (elem.querySelector(".cond-field-can:not(.hidden)") ? "can_state" : "param_range"));
        }
        return {
            type: condType,
            preset_val: selectedPresetVal,
            preset_name: selectedPresetName,
            invert: elem.querySelector(".can-do-cond-invert")?.checked || false,
            expression: elem.querySelector(".can-do-cond-expr")?.value || "",
            can_id: elem.querySelector(".can-do-cond-can-id")?.value || "",
            match_payload: condCanPayload,
            days: days,
            start_time: elem.querySelector(".can-do-cond-start-time")?.value || "",
            end_time: elem.querySelector(".can-do-cond-end-time")?.value || "",
            voltage_val: elem.querySelector(".can-do-cond-voltage-val")?.value || "",
            voltage_dir: elem.querySelector(".can-do-cond-voltage-dir")?.value || "above"
        };
    }
}

function extractCanDoActionElement(elem) {
    if (elem.classList.contains("can-do-choose-block")) {
        const options = [];
        elem.querySelectorAll(".can-do-choose-options-container > .can-do-choose-option-item").forEach(optElem => {
            const optActions = [];
            optElem.querySelectorAll(".can-do-opt-actions-container > .can-do-action-item, .can-do-opt-actions-container > .can-do-choose-block, .can-do-opt-actions-container > .can-do-ifthen-block").forEach(actItem => {
                optActions.push(extractCanDoActionElement(actItem));
            });
            options.push({
                trigger_id: optElem.querySelector(".can-do-opt-trig-id")?.value.trim() || "",
                actions: optActions
            });
        });
        return {
            type: "choose",
            options: options
        };
    } else if (elem.classList.contains("can-do-ifthen-block")) {
        const condContainer = elem.querySelector(".can-do-ifthen-conditions-container");
        const ifConditions = [];
        if (condContainer) {
            condContainer.querySelectorAll(":scope > .can-do-condition-item, :scope > .can-do-condition-group, :scope > .can-do-condition-or-group").forEach(cElem => {
                ifConditions.push(extractCanDoConditionElement(cElem));
            });
        }

        const thenContainer = elem.querySelector(".can-do-ifthen-then-container");
        const thenActions = [];
        if (thenContainer) {
            thenContainer.querySelectorAll(":scope > .can-do-action-item, :scope > .can-do-choose-block, :scope > .can-do-ifthen-block").forEach(aElem => {
                thenActions.push(extractCanDoActionElement(aElem));
            });
        }

        const elseContainer = elem.querySelector(".can-do-ifthen-else-container");
        const elseActions = [];
        if (elseContainer) {
            elseContainer.querySelectorAll(":scope > .can-do-action-item, :scope > .can-do-choose-block, :scope > .can-do-ifthen-block").forEach(aElem => {
                elseActions.push(extractCanDoActionElement(aElem));
            });
        }

        return {
            type: "if_then",
            conditions: ifConditions,
            then_actions: thenActions,
            else_actions: elseActions
        };
    } else {
        return extractCanDoActionData(elem);
    }
}

function toggleCanDoHaExposeUI(cb) {
    const row = cb.closest("td")?.querySelector(".can-do-ha-details-row");
    if (row) {
        row.style.display = cb.checked ? "flex" : "none";
    }
}

function extractCanDoRuleData(card) {
    if (!card) return null;
    const execMode = card.querySelector(".can-do-exec-mode")?.value || "on_change";
    const cooldownMs = parseInt(card.querySelector(".can-do-cooldown-ms")?.value || "500");
    const timeoutResetMs = parseInt(card.querySelector(".can-do-timeout-reset-ms")?.value || "2000");
    const resetCanId = card.querySelector(".can-do-reset-can-id")?.value || "";
    const verifyCanId = card.querySelector(".can-do-verify-can-id")?.value || card.querySelector(".can-do-verify-id")?.value || "";
    const verifyPayload = getByteGridString(card, "can-do-verify");

    const autoRevertSec = parseInt(card.querySelector(".can-do-auto-revert-sec")?.value || card.querySelector(".can-do-toggle-revert-sec")?.value || "0");
    const latchTimeoutSec = parseInt(card.querySelector(".can-do-latch-timeout")?.value || "300");

    const haExpose = card.dataset.haExpose !== undefined
        ? (card.dataset.haExpose === "true")
        : (card.querySelector(".can-do-ha-expose") ? card.querySelector(".can-do-ha-expose").checked : true);
    const haIcon = card.dataset.haIcon
        || (card.querySelector(".can-do-ha-icon") ? card.querySelector(".can-do-ha-icon").value.trim() : "mdi:car-defrost-rear");

    const triggers = [];
    card.querySelectorAll(".can-do-trigger-item").forEach(item => {
        const fromPayload = getByteGridString(item, "can-do-trig-from");
        const toPayload = getByteGridString(item, "can-do-trig-to");
        const forSec = parseFloat(item.querySelector(".can-do-trig-for-sec")?.value || "0");
        triggers.push({
            id: item.querySelector(".can-do-trig-id")?.value.trim() || "",
            source: item.querySelector(".can-do-trig-source")?.value || "preset",
            click_count: parseInt(item.querySelector(".can-do-trig-click-count")?.value || "1"),
            for_sec: forSec,
            for_ms: Math.round(forSec * 1000),
            can_id: item.querySelector(".can-do-trig-can-id")?.value || "",
            from_payload: fromPayload,
            to_payload: toPayload,
            match_payload: toPayload,
            bus: parseInt(item.querySelector(".can-do-trig-bus")?.value || "0"),
            time: item.querySelector(".can-do-trig-time")?.value || "",
            interval_sec: parseInt(item.querySelector(".can-do-trig-interval-sec")?.value || "10"),
            voltage_val: item.querySelector(".can-do-trig-voltage-val")?.value || "",
            voltage_dir: item.querySelector(".can-do-trig-voltage-dir")?.value || "below",
            expression: item.querySelector(".can-do-trig-expr")?.value || "",
            mqtt_topic: item.querySelector(".can-do-trig-mqtt-topic")?.value || "",
            mqtt_payload: item.querySelector(".can-do-trig-mqtt-payload")?.value || ""
        });
    });

    const conditions = [];
    card.querySelectorAll(".can-do-conditions-container > .can-do-condition-item, .can-do-conditions-container > .can-do-condition-group, .can-do-conditions-container > .can-do-condition-or-group").forEach(elem => {
        conditions.push(extractCanDoConditionElement(elem));
    });

    const actions = [];
    card.querySelectorAll(".can-do-actions-container > .can-do-action-item, .can-do-actions-container > .can-do-choose-block, .can-do-actions-container > .can-do-ifthen-block").forEach(elem => {
        actions.push(extractCanDoActionElement(elem));
    });

    const offActions = [];
    card.querySelectorAll(".can-do-off-actions-container > .can-do-action-item, .can-do-off-actions-container > .can-do-choose-block, .can-do-off-actions-container > .can-do-ifthen-block").forEach(elem => {
        offActions.push(extractCanDoActionElement(elem));
    });

    // Maintain legacy trigger/condition/action for backward compatibility
    const primaryTrig = triggers[0] || { source: "preset" };
    const primaryCond = conditions[0] || { type: "none" };
    const primaryAct = actions[0] || { type: "precondition" };
    const primaryOffAct = offActions[0] || null;

    const isRuleEnabled = card.querySelector(".can-do-rule-enabled") ? card.querySelector(".can-do-rule-enabled").checked : true;

    const ruleObj = {
        name: card.querySelector(".can-do-name")?.value || "New CAN Do",
        enabled: isRuleEnabled,
        ha_expose: haExpose,
        ha_icon: haIcon,
        exec_mode: execMode,
        trigger_mode: card.querySelector(".can-do-trig-combine-mode")?.value || "any",
        cooldown_ms: cooldownMs,
        timeout_reset_ms: timeoutResetMs,
        reset_can_id: resetCanId,
        verify_can_id: verifyCanId,
        verify_payload: verifyPayload,
        triggers: triggers,
        conditions: conditions,
        actions: actions,
        trigger: primaryTrig,
        condition: primaryCond,
        action: primaryAct
    };

    ruleObj.latch_timeout_sec = latchTimeoutSec;
    if (execMode === "toggle") {
        ruleObj.auto_revert_sec = autoRevertSec;
        ruleObj.toggle_revert_sec = autoRevertSec;
        ruleObj.off_actions = offActions;
        if (primaryOffAct) ruleObj.off_action = primaryOffAct;
    }

    return ruleObj;
}

function duplicateCanDoRuleUI(btnOrCard) {
    const card = (btnOrCard && btnOrCard.classList?.contains("can-do-rule-card"))
        ? btnOrCard
        : (btnOrCard?.closest ? btnOrCard.closest(".can-do-rule-card") : (window._activeRuleCard || window._activeMenuCard));
    if (!card) {
        console.error("No card found to duplicate");
        return;
    }
    const ruleData = extractCanDoRuleData(card);
    if (!ruleData) return;

    // Clone name with (Copy) suffix
    if (ruleData.name) {
        ruleData.name = ruleData.name.replace(/\s*\(Copy(\s+\d+)?\)$/, "") + " (Copy)";
    } else {
        ruleData.name = "New CAN Do (Copy)";
    }

    addCanDoRuleUI(ruleData, false, false);
    const container = document.getElementById("can_do_rules_container");
    const newCard = container ? container.lastElementChild : null;
    if (newCard) {
        if (card.nextElementSibling !== newCard) {
            card.after(newCard);
        }
        triggerItemAnimation(newCard, "ha-item-duplicate");
        setTimeout(() => {
            newCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
    }
    showNotification("Duplicated CAN Do: " + ruleData.name, "green", 2500);
    autoSaveCanDoRules();
}

function deleteCanDoRuleUI(btn) {
    const card = btn.closest(".can-do-rule-card") || btn.closest(".pid-entry");
    if (!card) return;
    const name = card.querySelector(".can-do-name")?.value || "CAN Do";
    card.remove();

    const remaining = document.querySelectorAll("#can_do_rules_container .can-do-rule-card");
    if (remaining.length === 0) {
        const defaultRule = getDefaultPreconditionRule();
        defaultRule.enabled = false;
        addCanDoRuleUI(defaultRule, true);
        autoSaveCanDoRules(`Deleted "${name}". Default rule restored (Paused).`, "blue");
    } else {
        autoSaveCanDoRules(`Deleted "${name}"`, "blue");
    }
}


/* --- HOME ASSISTANT ANCHORED SAVE FAB CONTROLLER --- */
window._canDoIsDirty = false;
window._suppressCanDoDirty = false;

// markCanDoDirty/clearCanDoDirty defined at page init; local aliases:
function markCanDoDirty() { window.markCanDoDirty(); }

window.clearCanDoDirty = function () {
    window._canDoIsDirty = false;
    const fab = document.getElementById("can_do_anchored_save_fab");
    if (fab) {
        fab.classList.remove("dirty");
        return "dirty state cleared from FAB";
    }
    return "cleared";
};
function clearCanDoDirty() { return window.clearCanDoDirty(); }

window.saveAllCanDoAutomations = function (btn) {
    saveCanDoRulesUI(btn);
    clearCanDoDirty();
};
function saveAllCanDoAutomations(btn) { return window.saveAllCanDoAutomations(btn); }

// Comprehensive change listener: input, change, keyup anywhere inside automate tab
document.addEventListener("input", function (e) {
    if (e.target.closest("#automate, #can_do_rules_container")) {
        markCanDoDirty();
    }
}, true);
document.addEventListener("change", function (e) {
    if (e.target.closest("#automate, #can_do_rules_container")) {
        markCanDoDirty();
    }
}, true);
document.addEventListener("keyup", function (e) {
    if (e.target.closest("#automate, #can_do_rules_container") && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) {
        markCanDoDirty();
    }
}, true);

// Immediate observer attach function
function initCanDoMutationObserver() {
    const container = document.getElementById("can_do_rules_container");
    if (!container) return;
    if (window._can_doObserverAttached) return;
    window._can_doObserverAttached = true;
    const observer = new MutationObserver(function (mutations) {
        if (window._suppressCanDoDirty) return;
        for (let m of mutations) {
            if (m.addedNodes.length > 0 || m.removedNodes.length > 0) {
                markCanDoDirty();
                break;
            }
        }
    });
    observer.observe(container, { childList: true, subtree: true });
}

// Attach observer on DOM ready and also immediately if container is already in DOM
if (document.getElementById("can_do_rules_container")) {
    initCanDoMutationObserver();
}
document.addEventListener("DOMContentLoaded", initCanDoMutationObserver);

// Save & Load
function saveCanDoRulesUI(sourceElem) {
    const rules = [];
    const cards = document.querySelectorAll("#can_do_rules_container .can-do-rule-card");
    cards.forEach(card => {
        const ruleData = extractCanDoRuleData(card);
        if (ruleData) rules.push(ruleData);
    });
    window._cachedCanDoRules = rules;

    fetch("/store_can_do", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            settings: getCanDoDeviceSettings(),
            rules: rules
        })
    }).then(res => res.text()).then(msg => {
        clearCanDoDirty();
        showNotification("CAN Do saved successfully!", "green");
        const targetCard = sourceElem ? sourceElem.closest(".can-do-rule-card") : null;
        if (targetCard) {
            // Collapse specifically the saved CAN Do
            const body = targetCard.querySelector(".can-do-rule-body");
            const editBtn = targetCard.querySelector(".can-do-edit-btn");
            const toggleBtn = targetCard.querySelector(".can-do-toggle-btn");
            const nameInput = targetCard.querySelector(".can-do-name");
            if (body) {
                body.classList.add("hidden");
                body.style.display = "none";
            }
            if (editBtn) {
                editBtn.textContent = "Edit";
                editBtn.classList.remove("btn-save");
                editBtn.classList.add("btn-edit");
                editBtn.style.background = "";
                editBtn.title = "Edit this CAN Do";
            }
            if (toggleBtn) toggleBtn.textContent = "▼";
            if (nameInput) {
                nameInput.style.borderColor = "var(--border-color)";
                nameInput.style.backgroundColor = "transparent";
                nameInput.style.boxShadow = "none";
            }
        } else {
            cards.forEach(card => {
                const body = card.querySelector(".can-do-rule-body");
                const editBtn = card.querySelector(".can-do-edit-btn");
                const toggleBtn = card.querySelector(".can-do-toggle-btn");
                const nameInput = card.querySelector(".can-do-name");
                if (body) {
                    body.classList.add("hidden");
                    body.style.display = "none";
                }
                if (editBtn) {
                    editBtn.textContent = "Edit";
                    editBtn.classList.remove("btn-save");
                    editBtn.classList.add("btn-edit");
                    editBtn.style.background = "";
                    editBtn.title = "Edit this CAN Do";
                }
                if (toggleBtn) toggleBtn.textContent = "▼";
                if (nameInput) {
                    nameInput.style.borderColor = "var(--border-color)";
                    nameInput.style.backgroundColor = "transparent";
                    nameInput.style.boxShadow = "none";
                }
            });
        }
    }).catch(err => {
        showNotification("Failed to save CAN Do: " + err, "red");
    });
}

function getDefaultPreconditionRule() {
    return {
        name: "E-GMP Battery Preconditioning",
        enabled: true,
        exec_mode: "one_shot",
        cooldown_ms: 500,
        timeout_reset_ms: 2000,
        triggers: [
            {
                id: "sw_star",
                source: "preset",
                can_id: "0x448",
                bus: 0,
                to_payload: "* * * * * 1*",
                from_payload: "* * * * * 0*"
            }
        ],
        actions: [
            {
                trigger_id: "sw_star",
                type: "precondition",
                precon_mode: "persistent",
                precon_press: "short",
                popup_message: ""
            }
        ]
    };
}

function loadCanDoRulesUI() {
    initCanDoVehicleProfileUI();
    initUnitSystemUI();
    initCanDoCaptureModeUI();
    loadCanDoCatalog();
    fetch("/load_can_do").then(res => res.json()).then(data => {
        if (data && data.settings) {
            let settingsChanged = false;
            if (data.settings.vehicle_model) {
                localStorage.setItem("wican_vehicle_model", data.settings.vehicle_model);
                settingsChanged = true;
            }
            if (data.settings.vehicle_trim) {
                localStorage.setItem("wican_vehicle_trim", data.settings.vehicle_trim);
                settingsChanged = true;
            }
            if (data.settings.vehicle_profile) {
                localStorage.setItem("wican_vehicle_profile", data.settings.vehicle_profile);
                settingsChanged = true;
            }
            if (data.settings.unit_system) {
                localStorage.setItem("wican_unit_system", data.settings.unit_system);
                const unitSel = document.getElementById("can_do_unit_system");
                if (unitSel) unitSel.value = data.settings.unit_system;
                changeUnitSystem(data.settings.unit_system, false);
            }
            if (settingsChanged) {
                initCanDoVehicleProfileUI();
            }
            if (data.settings.custom_presets) {
                const cp = data.settings.custom_presets;
                if (Array.isArray(cp.triggers)) {
                    localStorage.setItem("wican_custom_trig_presets", JSON.stringify(cp.triggers));
                }
                if (Array.isArray(cp.actions)) {
                    localStorage.setItem("wican_custom_act_presets", JSON.stringify(cp.actions));
                }
                if (Array.isArray(cp.conditions)) {
                    localStorage.setItem("wican_custom_cond_presets", JSON.stringify(cp.conditions));
                }
                if (typeof refreshAllCanDoPresetDropdowns === "function") {
                    refreshAllCanDoPresetDropdowns();
                }
            }
            if (data.settings.custom_widgets) {
                const cw = data.settings.custom_widgets;
                if (cw.state_widgets && typeof cw.state_widgets === "object") {
                    localStorage.setItem("wican_state_widgets", JSON.stringify(cw.state_widgets));
                }
                if (cw.dash_buttons && typeof cw.dash_buttons === "object") {
                    localStorage.setItem("wican_dash_can_do_buttons", JSON.stringify(cw.dash_buttons));
                }
                if (typeof getDashboardWidgetLayout === "function") {
                    const currentLayout = getDashboardWidgetLayout();
                    let layoutUpdated = false;
                    const customCards = Array.isArray(cw.custom_cards) ? cw.custom_cards : [
                        ...Object.keys(cw.state_widgets || {}),
                        ...Object.keys(cw.dash_buttons || {})
                    ];
                    customCards.forEach(id => {
                        if ((id.startsWith("can_state_") || id.startsWith("can_do_btn_")) && !currentLayout.includes(id)) {
                            currentLayout.push(id);
                            layoutUpdated = true;
                        }
                    });
                    if (layoutUpdated) {
                        localStorage.setItem("wican_dash_widgets", JSON.stringify(currentLayout));
                    }
                    if (typeof renderDashboardGrid === "function") {
                        renderDashboardGrid();
                        if (window._lastStatusObj && typeof updateDashboardCards === "function") {
                            updateDashboardCards(window._lastStatusObj);
                        }
                    }
                }
            }
        }
        const container = document.getElementById("can_do_rules_container");
        if (container) container.innerHTML = "";
        window._suppressCanDoDirty = true;
        if (data && data.rules && Array.isArray(data.rules) && data.rules.length > 0) {
            window._cachedCanDoRules = data.rules;
            data.rules.forEach(r => addCanDoRuleUI(r, true));
        } else {
            // Default loaded automation on new installs
            const defRule = getDefaultPreconditionRule();
            window._cachedCanDoRules = [defRule];
            addCanDoRuleUI(defRule, true);
        }
        setTimeout(() => { window._suppressCanDoDirty = false; clearCanDoDirty(); }, 150);
    }).catch(err => {
        console.log("No saved CAN Do rules found, initializing default rule:", err);
        const container = document.getElementById("can_do_rules_container");
        if (container && container.children.length === 0) {
            window._suppressCanDoDirty = true;
            const defRule = getDefaultPreconditionRule();
            window._cachedCanDoRules = [defRule];
            addCanDoRuleUI(defRule, true);
        }
        // Always release suppress so manual edits always work
        setTimeout(() => { window._suppressCanDoDirty = false; window._canDoIsDirty = false; }, 500);
    });
}

function initCanDoCaptureModeUI() {
    const saved = localStorage.getItem("wican_can_do_capture_mode") || "auto";
    const sel = document.getElementById("can_do_capture_mode");
    if (sel) sel.value = saved;
    fetch("/set_capture_mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: saved })
    }).catch(() => { });
}

function toggleCanDoCaptureMode(val) {
    localStorage.setItem("wican_can_do_capture_mode", val);
    fetch("/set_capture_mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: val })
    }).then(() => {
        let msg = "Capture Mode: Auto (Pause on Capturing)";
        if (val === "paused") msg = "Capture Mode: Always Paused";
        if (val === "disabled") msg = "Capture Mode: Disabled (Always Run)";
        showNotification(msg, "blue", 3000);
        checkStatus();
    }).catch(err => {
        showNotification("Failed to set Capture Mode: " + err, "red");
    });
}

// --- CAN DO BACKUP & RESTORE ---
function exportSingleCanDoRuleUI(btn) {
    const card = btn.closest(".can-do-rule-card");
    if (!card) return;
    const ruleData = extractCanDoRuleData(card);
    if (!ruleData) return;

    const cleanName = (ruleData.name || "can_do_rule").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const jsonStr = JSON.stringify(ruleData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `can_do_rule_${cleanName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(`Exported rule "${ruleData.name}"!`, "green", 2500);
}

function copySingleCanDoRuleUI(btn) {
    const card = btn.closest(".can-do-rule-card");
    if (!card) return;
    const ruleData = extractCanDoRuleData(card);
    if (!ruleData) return;

    const jsonStr = JSON.stringify(ruleData, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonStr).then(() => {
            showNotification(`Copied "${ruleData.name || 'CAN Do'}" JSON to clipboard!`, "green", 2500);
        }).catch(() => {
            prompt("Copy CAN Do JSON:", jsonStr);
        });
    } else {
        prompt("Copy CAN Do JSON:", jsonStr);
    }
}

function exportCanDoRules() {
    fetch("/load_can_do").then(res => res.json()).then(data => {
        const exportObj = (data && data.rules) ? data : {
            settings: getCanDoDeviceSettings(),
            rules: window._cachedCanDoRules || []
        };
        const jsonStr = JSON.stringify(exportObj, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "wican_can_do_rules.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification("CAN Do backed up successfully!", "green");
    }).catch(err => {
        showNotification("Failed to export CAN Do: " + err, "red");
    });
}

function importCanDoRules(inputElem) {
    const file = inputElem.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            const container = document.getElementById("can_do_rules_container");
            if (data && Array.isArray(data.rules)) {
                if (container) container.innerHTML = "";
                data.rules.forEach(r => addCanDoRuleUI(r, true));
                if (data.settings) {
                    if (data.settings.vehicle_model) localStorage.setItem("wican_vehicle_model", data.settings.vehicle_model);
                    if (data.settings.vehicle_trim) localStorage.setItem("wican_vehicle_trim", data.settings.vehicle_trim);
                    if (data.settings.vehicle_profile) localStorage.setItem("wican_vehicle_profile", data.settings.vehicle_profile);
                    if (data.settings.unit_system) {
                        localStorage.setItem("wican_unit_system", data.settings.unit_system);
                        const unitSel = document.getElementById("can_do_unit_system");
                        if (unitSel) unitSel.value = data.settings.unit_system;
                        changeUnitSystem(data.settings.unit_system, false);
                    }
                    initCanDoVehicleProfileUI();
                    if (data.settings.custom_presets) {
                        const cp = data.settings.custom_presets;
                        if (Array.isArray(cp.triggers)) localStorage.setItem("wican_custom_trig_presets", JSON.stringify(cp.triggers));
                        if (Array.isArray(cp.actions)) localStorage.setItem("wican_custom_act_presets", JSON.stringify(cp.actions));
                        if (Array.isArray(cp.conditions)) localStorage.setItem("wican_custom_cond_presets", JSON.stringify(cp.conditions));
                        if (typeof refreshAllCanDoPresetDropdowns === "function") refreshAllCanDoPresetDropdowns();
                    }
                    if (data.settings.custom_widgets) {
                        const cw = data.settings.custom_widgets;
                        if (cw.state_widgets && typeof cw.state_widgets === "object") localStorage.setItem("wican_state_widgets", JSON.stringify(cw.state_widgets));
                        if (cw.dash_buttons && typeof cw.dash_buttons === "object") localStorage.setItem("wican_dash_can_do_buttons", JSON.stringify(cw.dash_buttons));
                    }
                }
                const payload = {
                    settings: data.settings || getCanDoDeviceSettings(),
                    rules: data.rules
                };
                fetch("/store_can_do", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                }).then(res => res.text()).then(msg => {
                    showNotification(`Restored and saved ${data.rules.length} CAN Do rule(s) successfully!`, "green");
                }).catch(err => {
                    showNotification("Rules loaded in editor. Click 'Store CAN Do Rules' to save.", "blue");
                });
            } else if (data && (data.triggers || data.trigger || data.name)) {
                // Single rule import! Append to existing container without clearing
                addCanDoRuleUI(data, false, true);
                showNotification(`Imported rule "${data.name || 'Custom Rule'}"! Click Save to persist.`, "green", 4000);
            } else {
                showNotification("Invalid CAN Do backup file format.", "red");
            }
        } catch (err) {
            showNotification("Failed to parse backup file: " + err, "red");
        }
        inputElem.value = "";
    };
    reader.readAsText(file);
}

// --- TIME & SNTP MANAGEMENT ---
function fetchDeviceTime() {
    fetch("/get_time").then(res => res.json()).then(data => {
        if (data) {
            const disp = document.getElementById("device_time_display");
            const badge = document.getElementById("device_time_sync_badge");
            if (disp) disp.textContent = data.time_str || "--:--:--";
            if (badge) {
                badge.className = "";
                badge.style.background = "";
                badge.style.color = "";
                if (data.synced) {
                    badge.textContent = "✓ Synced";
                    badge.classList.add("badge-green");
                } else {
                    badge.textContent = "⚠ Unset / Not Synced";
                    badge.classList.add("badge-yellow");
                }
            }
            const enSelect = document.getElementById("sntp_enabled");
            if (enSelect) {
                enSelect.value = data.sntp_enabled ? "enable" : "disable";
                toggleSntpFields(enSelect.value);
            }
            const srvInput = document.getElementById("sntp_server");
            if (srvInput && data.sntp_server) srvInput.value = data.sntp_server;
            const tzInput = document.getElementById("sntp_timezone");
            const tzSelect = document.getElementById("tz_preset");
            if (data.timezone) {
                if (tzInput) tzInput.value = data.timezone;
                if (tzSelect) {
                    const hasOption = Array.from(tzSelect.options).some(o => o.value === data.timezone);
                    if (hasOption) {
                        tzSelect.value = data.timezone;
                        if (tzInput) tzInput.style.display = "none";
                    } else {
                        tzSelect.value = "custom";
                        if (tzInput) tzInput.style.display = "block";
                    }
                }
            }
        }
    }).catch(err => console.log("Error fetching device time:", err));
}

function toggleSntpFields(val) {
    const row = document.getElementById("sntp_server_row");
    if (row) row.classList.toggle("hidden", val !== "enable");
}

function getSelectedTimezone() {
    const select = document.getElementById("tz_preset");
    const tzInput = document.getElementById("sntp_timezone");
    if (select && select.value && select.value !== "custom") {
        return select.value;
    }
    return tzInput?.value?.trim() || "UTC0";
}

function syncTimeFromBrowser() {
    const epoch = Math.floor(Date.now() / 1000);
    const tz = getSelectedTimezone();

    fetch("/set_time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epoch: epoch, tz: tz })
    }).then(res => res.text()).then(msg => {
        showNotification("Clock synchronized successfully from browser!", "green");
        fetchDeviceTime();
    }).catch(err => {
        showNotification("Failed to sync clock: " + err, "red");
    });
}

function saveTimeConfigUI() {
    const enabled = document.getElementById("sntp_enabled")?.value === "enable";
    const server = document.getElementById("sntp_server")?.value || "pool.ntp.org";
    const tz = getSelectedTimezone();
    toggleSntpFields(document.getElementById("sntp_enabled")?.value);

    fetch("/store_time_config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sntp_enabled: enabled, sntp_server: server, timezone: tz })
    }).then(res => res.text()).then(msg => {
        showNotification("Time settings saved!", "green");
        fetchDeviceTime();
    }).catch(err => {
        showNotification("Failed to save time settings: " + err, "red");
    });
}

function onTzSelectChange(select) {
    const tzInput = document.getElementById("sntp_timezone");
    if (select.value === "custom") {
        if (tzInput) {
            tzInput.style.display = "block";
            tzInput.focus();
        }
    } else {
        if (tzInput) {
            tzInput.style.display = "none";
            tzInput.value = select.value;
        }
        saveTimeConfigUI();
    }
}
const applyTzPreset = onTzSelectChange;

// --- CAN DO SETTINGS MENU HANDLERS ---
function toggleCanDoSettingsMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById("can_do_settings_menu");
    if (menu) {
        menu.classList.toggle("show");
    }
}

function closeCanDoSettingsMenu() {
    const menu = document.getElementById("can_do_settings_menu");
    if (menu) {
        menu.classList.remove("show");
    }
}

// Close modal on Escape key
document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        closeCanDoSettingsMenu();
    }
});