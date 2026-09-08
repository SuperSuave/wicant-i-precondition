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