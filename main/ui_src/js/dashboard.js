// --- DYNAMIC WIDGET DASHBOARD SYSTEM ---

window._dashEditMode = false;
window._lastStatusObj = null;
window._canDoStateCache = {};

function escapeHtml(str) {
    return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
        update: function (obj) {
            const modeText = document.getElementById("dash_wifi_mode_text");
            const ipText = document.getElementById("dash_sta_ip_text");
            const netBadge = document.getElementById("dash_net_badge");
            if (!obj) return;
            if (modeText && obj.wifi_mode) modeText.textContent = obj.wifi_mode;
            if (ipText && obj.sta_ip) ipText.textContent = obj.sta_ip;
            if (netBadge && obj.wifi_mode) {
                netBadge.innerHTML = (obj.wifi_mode === "AP")
                    ? '<span class="status-dot blue"></span> AP Mode'
                    : '<span class="status-dot green"></span> Connected';
            }
        }
    },
    can_hw: {
        id: "can_hw", name: "CAN Bus Status", icon: "", category: "Hardware",
        render: function (isEditMode) {
            return `<div class="dash-card-header"><span class="dash-card-title"><svg class="icon"><use href="#icon-broadcast"/></svg> CAN Bus</span>
                    <div class="dash-card-actions"><div id="dash_can_mode_status" class="dash-status"><span class="status-dot green"></span> Normal</div></div></div>
                    <div><div class="dash-kv-list">
                        <div class="dash-kv-row"><span class="dash-kv-label">Bitrate:</span><strong id="dash_can_bitrate_val" class="dash-kv-val">500K</strong></div>
                        <div class="dash-kv-row"><span class="dash-kv-label">TCP/UDP Port:</span><strong id="dash_can_port_val" class="dash-kv-val" style="font-family: monospace;">3333</strong></div>
                    </div></div>
                    <button type="button" onclick="openTab(event, 'can_hardware_tab')" class="dash-outline-btn" style="width: 100%; border: none; background: rgba(255,255,255,0.04);">CAN Settings</button>`;
        },
        update: function (obj) {
            const br = document.getElementById("dash_can_bitrate_val");
            const pt = document.getElementById("dash_can_port_val");
            const md = document.getElementById("dash_can_mode_status");
            if (!obj) return;
            if (br && obj.can_datarate) br.textContent = obj.can_datarate;
            if (pt && obj.port) pt.textContent = obj.port;
            if (md && obj.can_mode) {
                md.innerHTML = (obj.can_mode === "silent")
                    ? '<span class="status-dot yellow"></span> Silent'
                    : '<span class="status-dot green"></span> Normal';
            }
        }
    },
    can_do: {
        id: "can_do", name: "CAN Do Automations", icon: "", category: "Automations",
        render: function (isEditMode) {
            return `<div class="dash-card-header"><span class="dash-card-title"><svg class="icon"><use href="#icon-play"/></svg> CAN Do Automations</span>
                    <div class="dash-card-actions"><span id="can_do_dash_badge" class="dash-status"><span class="status-dot green"></span> Active</span></div></div>
                    <div><div class="dash-subtext" style="margin-bottom: 0.8rem;">Automate actions, triggers, and vehicle telemetry hooks.</div></div>
                    <button type="button" onclick="openTab(event, 'automate')" class="dash-outline-btn" style="width: 100%; border: none; background: rgba(255,255,255,0.04);">Open Automations</button>`;
        },
        update: function (obj) { }
    },
    can_state_monitor: {
        id: "can_state_monitor", name: "CAN State Monitor", icon: "", category: "Monitoring",
        render: function (isEditMode, instanceId) {
            const watched = getWatchedCanDoSignals(instanceId);
            let itemsHtml = watched.map(w => `
                <div class="dash-kv-row">
                    <span class="dash-kv-label">${escapeHtml(w.customLabel || w.catalogId)}</span>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="can-do-age-label" style="font-size: 0.7rem; color: var(--text-muted);">Age: --</span>
                        <span class="dash-badge badge-gray can-do-state-badge">Waiting...</span>
                    </div>
                </div>
            `).join("");

            return `<div class="dash-card-header"><span class="dash-card-title"><svg class="icon"><use href="#icon-broadcast"/></svg> State Monitor</span>
                    <div class="dash-card-actions"><div id="can_do_live_indicator_${instanceId}" class="dash-status"><span class="status-dot green"></span> Live</div></div></div>
                    <div><div class="can-do-watched-container dash-kv-list" style="margin-bottom: 0.5rem;">
                        ${itemsHtml || '<div class="dash-subtext">No signals configured to watch.</div>'}
                    </div></div>
                    ${renderWidgetEditControlsHTML(instanceId, isEditMode)}`;
        },
        update: function (obj) { }
    },
    can_do_buttons: {
        id: "can_do_buttons", name: "CAN Do Action Buttons", icon: "", category: "Quick Action",
        render: function (isEditMode, instanceId) {
            const buttons = getCanDoActionButtons(instanceId);
            let btnsHtml = buttons.map((b, idx) => `
                <button type="button" class="dash-outline-btn" style="width: 100%; margin-bottom: 0.4rem;" onclick="executeDashboardCanDoButton('${instanceId}', ${idx}, this)">
                    ${escapeHtml(b.customLabel || b.ruleName)}
                </button>
            `).join("");

            return `<div class="dash-card-header"><span class="dash-card-title"><svg class="icon"><use href="#icon-star"/></svg> Action Buttons</span></div>
                    <div>${btnsHtml || '<div class="dash-subtext">No quick action buttons added.</div>'}</div>
                    ${renderWidgetEditControlsHTML(instanceId, isEditMode)}`;
        },
        update: function (obj) { }
    }
};

const DEFAULT_DASH_WIDGETS = ["batt_12v", "hv_battery", "precon", "can_do", "network", "can_hw"];

function preconActivate() {
    fetch("/precondition_toggle", { method: "POST" })
        .then(res => res.text())
        .then(text => {
            if (typeof showNotification === "function") showNotification(text, "green");
            setTimeout(checkStatus, 200);
        })
        .catch(() => {
            if (typeof showNotification === "function") showNotification("Failed to toggle preconditioning", "red");
        });
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

function updateDashboardCards(obj) {
    if (!obj) return;
    window._lastStatusObj = obj;

    const layout = getDashboardWidgetLayout();
    layout.forEach(widgetId => {
        const w = DASH_WIDGET_CATALOG[widgetId];
        if (w && typeof w.update === "function") {
            w.update(obj);
        }
    });

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

function getWatchedCanDoSignals(instanceId) {
    try {
        const store = JSON.parse(localStorage.getItem("wican_state_widgets") || "{}");
        return store[instanceId] || [];
    } catch (e) { return []; }
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

            const items = (typeof getCanDoMonitorableItems === "function") ? getCanDoMonitorableItems() : [];

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

function checkStatus() {
    try {
        const xhttp = new XMLHttpRequest();
        xhttp.onload = function () {
            try {
                var obj = JSON.parse(this.responseText);
                if (obj.wifi_mode == "APStation") {
                    if (document.getElementById("wifi_mode_current")) document.getElementById("wifi_mode_current").innerHTML = "AP+Station";
                } else if (obj.wifi_mode == "AP") {
                    if (document.getElementById("wifi_mode_current")) document.getElementById("wifi_mode_current").innerHTML = "AP";
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
                if (obj.can_do_stats && Array.isArray(obj.can_do_stats) && typeof updateCanDoActivityStats === "function") {
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

function getCanDoMonitorableItems() {
    const items = [];
    if (typeof CAN_DO_CATALOG === "undefined" || !CAN_DO_CATALOG || !Array.isArray(CAN_DO_CATALOG.commands)) return items;

    CAN_DO_CATALOG.commands.forEach(cmd => {
        if (!cmd || !cmd.can_id) return;
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
            const rData = (typeof extractCanDoRuleData === "function") ? extractCanDoRuleData(c) : null;
            if (rData) list.push({ id: `rule_${idx}`, name: rData.name || `Rule #${idx + 1}`, data: rData });
        });
        if (list.length > 0) return list;
    }
    const defaultRule = (typeof getDefaultPreconditionRule === "function") ? getDefaultPreconditionRule() : {};
    return [{ id: "rule_0", name: "E-GMP Battery Preconditioning", data: defaultRule }];
}

async function executeDashboardCanDoButton(instanceId, idx, btn) {
    const list = getCanDoActionButtons(instanceId);
    const item = list[idx];
    if (!item) return;

    const rules = getAvailableCanDoRulesList();
    const matched = rules.find(r => r.id === item.ruleId || r.name === item.ruleName);
    const ruleData = matched ? matched.data : item.ruleData;

    if (!ruleData) {
        if (typeof showNotification === "function") showNotification("Rule configuration not found. Please re-configure button.", "yellow", 3000);
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
        if (typeof showNotification === "function") showNotification(`Executed "${item.customLabel || item.ruleName}" successfully!`, "green", 3000);
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.background = "";
            btn.disabled = false;
        }, 1800);
    } catch (err) {
        btn.innerHTML = `<span>Failed</span>`;
        btn.style.background = "var(--md-sys-color-error)";
        if (typeof showNotification === "function") showNotification(`Execution failed: ${err.message || err}`, "red", 3500);
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
        if (typeof showNotification === "function") showNotification("Please select a CAN Do automation rule", "yellow", 2500);
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
    if (typeof showNotification === "function") showNotification(`Added button for "${customLabel || ruleName}"!`, "green", 2000);
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
        if (typeof showNotification === "function") showNotification("Please select a CAN signal to monitor", "yellow", 2500);
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
    if (typeof showNotification === "function") showNotification("Added signal to monitor card!", "green", 2000);
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
        if (typeof showNotification === "function") showNotification("Cannot remove all widgets. At least 1 widget must remain.", "red", 3000);
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
    if (typeof showNotification === "function") showNotification("Removed widget card from dashboard", "blue", 2500);
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
        if (typeof showNotification === "function") showNotification("Added new CAN State Monitor card!", "green", 2500);
        return;
    }

    if (widgetId === "can_do_buttons" || widgetId.startsWith("can_do_btn_")) {
        let nextIdx = 0;
        while (layout.includes(`can_do_btn_${nextIdx}`)) nextIdx++;
        const newInstId = `can_do_btn_${nextIdx}`;
        layout.push(newInstId);
        saveDashboardWidgetLayout(layout);
        if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
        if (typeof showNotification === "function") showNotification("Added new CAN Do Buttons card!", "green", 2500);
        return;
    }

    if (!layout.includes(widgetId) && DASH_WIDGET_CATALOG[widgetId]) {
        layout.push(widgetId);
        saveDashboardWidgetLayout(layout);
        if (typeof showNotification === "function") showNotification(`Added widget: ${DASH_WIDGET_CATALOG[widgetId].name}!`, "green", 2500);
    }
}

function resetDashboardWidgets() {
    if (confirm("Reset dashboard back to the default 6-card layout?")) {
        localStorage.removeItem("wican_dash_widgets");
        renderDashboardGrid();
        if (window._lastStatusObj) updateDashboardCards(window._lastStatusObj);
        if (typeof showNotification === "function") showNotification("Dashboard reset to default layout!", "green", 2500);
    }
}

function initDashboardWidgets() {
    renderDashboardGrid();
}
document.addEventListener("DOMContentLoaded", initDashboardWidgets);

setInterval(() => {
    const dashTab = document.getElementById("dashboard_tab");
    if (dashTab && dashTab.style.display !== "none") {
        updateCanDoStateWidgets();
    }
}, 3000);