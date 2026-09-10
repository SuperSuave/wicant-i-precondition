// --- SYSTEM CONFIGURATION, BACKUP & FIRMWARE ---

function reboot() {
    const btn = document.getElementById("reboot_button");
    if (btn) btn.disabled = true;
    if (typeof showNotification === "function") showNotification("Rebooting please reconnect...", "yellow");
    fetch("/system_reboot", { method: "POST", body: "reboot" }).catch(() => { });
}

function otaClick() {
    const fileInput = document.getElementById("ota_file");
    if (!fileInput || fileInput.files.length === 0) {
        if (typeof showNotification === "function") showNotification("No files selected!", "red");
        alert("No files selected!");
    } else {
        const submitBtn = document.getElementById("ota_submit_button");
        if (submitBtn) submitBtn.disabled = true;
        if (typeof showNotification === "function") showNotification("Updating please wait...", "green");
        setTimeout(function () {
            const form = document.getElementById("ota_form");
            if (form) form.submit();
        }, 5000);
    }
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

    const delay = 500;
    let combinedData = {};

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
                console.warn(`Failed to fetch ${endpoint}:`, fetchError);
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
    if (!fileInput || !fileInput.files[0]) return;

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
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(jsonData[key])
                            });

                            if (!response.ok) {
                                hasErrors = true;
                            }
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

                fileInput.value = '';
            } catch (parseError) {
                alert('Failed to parse configuration file');
            }
        };

        reader.readAsText(fileInput.files[0]);
    } catch (error) {
        alert('Upload failed');
    }
}

function postConfig(btn) {
    var obj = {};
    const bools = ["webhook_en", "grouping", "autopid_polling", "ap_auto_disable", "mqtt_en", "ble_status", "sleep_status"];
    bools.forEach(id => {
        const el = document.getElementById(id);
        if (el) obj[id] = el.checked ? "enable" : "disable";
    });

    const getVal = (id, fallback = "") => document.getElementById(id)?.value || fallback;

    obj["wifi_mode"] = getVal("wifi_mode");
    obj["webhook_en"] = getVal("webhook_en");
    obj["ap_ch"] = getVal("ap_ch_value");

    if (typeof updateLegacyStaFields === "function") updateLegacyStaFields();

    obj["sta_ssid"] = getVal("ssid_value");
    obj["sta_pass"] = getVal("pass_value");
    obj["sta_security"] = getVal("sta_security", "wpa3");
    obj["sta_networks"] = (typeof getStaNetworksData === "function") ? getStaNetworksData() : [];

    obj["can_datarate"] = getVal("can_datarate");
    obj["can_mode"] = getVal("can_mode");
    obj["can1_datarate"] = getVal("can1_datarate");
    obj["can1_mode"] = getVal("can1_mode");
    obj["can1_en"] = getVal("can1_en");
    obj["can_fwd_mode"] = getVal("can_fwd_mode");
    obj["port_type"] = getVal("port_type");
    obj["port"] = getVal("tcp_port_value");
    obj["ap_pass"] = getVal("ap_pass_value");
    obj["protocol"] = getVal("protocol");
    obj["ble_pass"] = getVal("ble_pass_value");
    obj["ble_status"] = getVal("ble_status");
    obj["sleep_status"] = getVal("sleep_status");
    obj["sleep_volt"] = getVal("sleep_volt");
    obj["sleep_time"] = getVal("sleep_time");
    obj["batt_alert"] = getVal("batt_alert");
    obj["batt_alert_ssid"] = getVal("batt_alert_ssid");
    obj["batt_alert_pass"] = getVal("batt_alert_pass");
    obj["batt_alert_volt"] = getVal("batt_alert_volt");
    obj["batt_alert_protocol"] = getVal("batt_alert_protocol");

    let mqtt_txt = "mqtt://";
    let raw_batt_url = getVal("batt_alert_url").replace(/^mqtt:\/\//, "");
    obj["batt_alert_url"] = mqtt_txt.concat(raw_batt_url);
    obj["batt_alert_port"] = getVal("batt_alert_port");
    obj["batt_alert_topic"] = getVal("batt_alert_topic");
    obj["batt_alert_time"] = getVal("batt_alert_time");
    obj["batt_mqtt_user"] = getVal("batt_mqtt_user");
    obj["batt_mqtt_pass"] = getVal("batt_mqtt_pass");
    obj["mqtt_en"] = getVal("mqtt_en");

    let raw_mqtt_url = getVal("mqtt_url").replace(/^mqtt:\/\//, "");
    obj["mqtt_url"] = mqtt_txt.concat(raw_mqtt_url);
    obj["mqtt_port"] = getVal("mqtt_port");
    obj["mqtt_user"] = getVal("mqtt_user");
    obj["mqtt_pass"] = getVal("mqtt_pass");
    obj["keep_alive"] = getVal("keep_alive");
    obj["mqtt_tx_topic"] = getVal("mqtt_tx_topic");
    obj["ap_auto_disable"] = getVal("ap_auto_disable");
    obj["mqtt_tx_en"] = document.getElementById("mqtt_tx_en_checkbox")?.checked ? "enable" : "disable";
    obj["mqtt_rx_topic"] = getVal("mqtt_rx_topic");
    obj["mqtt_rx_en"] = document.getElementById("mqtt_rx_en_checkbox")?.checked ? "enable" : "disable";
    obj["mqtt_status_topic"] = getVal("mqtt_status_topic");
    obj["mqtt_elm327_log"] = getVal("mqtt_elm327_log");
    obj["precon_mode"] = getVal("precon_mode", "once");
    obj["precon_button"] = getVal("precon_button", "sw_star");
    obj["precon_press"] = getVal("precon_press", "short");

    let origText = "";
    if (btn) {
        origText = btn.textContent || btn.value;
        btn.textContent = "Saving...";
        btn.disabled = true;
    }

    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        if (typeof showNotification === "function") showNotification(this.responseText || "Settings saved successfully", "green");
        if (btn) {
            btn.textContent = "✓ Saved!";
            setTimeout(() => {
                btn.textContent = origText;
                btn.disabled = false;
            }, 2000);
        }
    };
    xhttp.onerror = function () {
        if (typeof showNotification === "function") showNotification("Failed to save settings", "red");
        if (btn) {
            btn.textContent = "✕ Error";
            setTimeout(() => {
                btn.textContent = origText;
                btn.disabled = false;
            }, 2000);
        }
    };
    xhttp.open("POST", "/store_config");
    xhttp.setRequestHeader("Content-Type", "application/json");
    xhttp.send(JSON.stringify(obj));
}

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

                const setElVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el && val !== undefined) el.value = val;
                };

                setElVal("wifi_mode", obj.wifi_mode || "AP");
                setElVal("ap_ch_value", obj.ap_ch || "6");
                setElVal("ap_pass_value", obj.ap_pass || "Testpass");
                setElVal("can_datarate", obj.can_datarate || "500K");
                setElVal("can_mode", obj.can_mode || "normal");
                setElVal("port_type", obj.port_type || "tcp");
                setElVal("tcp_port_value", obj.port || "3333");
                setElVal("ble_pass_value", obj.ble_pass || "000000");
                setElVal("sleep_volt", obj.sleep_volt || "13.2");
                setElVal("sleep_time", obj.sleep_time || "2");

                const sleepDisp = document.getElementById("sleep_volt_value");
                if (sleepDisp) sleepDisp.textContent = obj.sleep_volt || "13.2";
                const sleepTimeDisp = document.getElementById("sleep_time_value");
                if (sleepTimeDisp) sleepTimeDisp.textContent = obj.sleep_time || "2";

                // Render station networks list
                if (typeof renderStaNetworksList === "function") {
                    renderStaNetworksList(obj.sta_networks || []);
                }

                // MQTT Broker fields
                let cleanMqttUrl = (obj.mqtt_url || "").replace(/^mqtt:\/\//, "");
                setElVal("mqtt_url", cleanMqttUrl);
                setElVal("mqtt_port", obj.mqtt_port || "1883");
                setElVal("mqtt_user", obj.mqtt_user || "");
                setElVal("mqtt_pass", obj.mqtt_pass || "");
                setElVal("keep_alive", obj.keep_alive || "60");
                setElVal("mqtt_tx_topic", obj.mqtt_tx_topic || "wican/can/tx");
                setElVal("mqtt_rx_topic", obj.mqtt_rx_topic || "wican/can/rx");
                setElVal("mqtt_status_topic", obj.mqtt_status_topic || "wican/status");
                setElVal("mqtt_elm327_log", obj.mqtt_elm327_log || "disable");

                const txCb = document.getElementById("mqtt_tx_en_checkbox");
                if (txCb) {
                    txCb.checked = (obj.mqtt_tx_en === "enable");
                    if (typeof txCheckBoxChanged === "function") txCheckBoxChanged();
                }

                const rxCb = document.getElementById("mqtt_rx_en_checkbox");
                if (rxCb) {
                    rxCb.checked = (obj.mqtt_rx_en === "enable");
                    if (typeof rxCheckBoxChanged === "function") rxCheckBoxChanged();
                }

                const mqttDiv = document.getElementById("mqtt_en_div");
                if (mqttDiv) {
                    mqttDiv.style.display = (obj.mqtt_en === "enable") ? "block" : "none";
                }

                if (typeof submit_enable === "function") {
                    // Update disabled/enabled states based on wifi_mode & ble
                    const isAp = (obj.wifi_mode === "AP");
                    const bleEl = document.getElementById("ble_status");
                    if (bleEl) bleEl.disabled = !isAp;
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

function txCheckBoxChanged() {
    const topic = document.getElementById("mqtt_tx_topic");
    const checked = document.getElementById("mqtt_tx_en_checkbox")?.checked;
    if (topic) topic.disabled = !checked;
}

function rxCheckBoxChanged() {
    const topic = document.getElementById("mqtt_rx_topic");
    const checked = document.getElementById("mqtt_rx_en_checkbox")?.checked;
    if (topic) topic.disabled = !checked;
}

function alert_elm327() {
    alert("If elm327 log is enabled then only CAN frames processed by elm327 will be sent to MQTT broker.");
}
