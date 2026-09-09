// --- CAN DO PERSISTENCE, BACKUP & RESTORE ---

function initCanDoVehicleProfileUI() {
    if (typeof populateVehicleDropdowns === "function" && typeof getCatalogVehicles === "function") {
        populateVehicleDropdowns(getCatalogVehicles());
    }
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

function exportSingleCanDoRuleUI(btn) {
    const card = btn.closest(".can-do-rule-card");
    if (!card) return;
    const ruleData = (typeof extractCanDoRuleData === "function") ? extractCanDoRuleData(card) : null;
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
    if (typeof showNotification === "function") showNotification(`Exported rule "${ruleData.name}"!`, "green", 2500);
}

function copySingleCanDoRuleUI(btn) {
    const card = btn.closest(".can-do-rule-card");
    if (!card) return;
    const ruleData = (typeof extractCanDoRuleData === "function") ? extractCanDoRuleData(card) : null;
    if (!ruleData) return;

    const jsonStr = JSON.stringify(ruleData, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonStr).then(() => {
            if (typeof showNotification === "function") showNotification(`Copied "${ruleData.name || 'CAN Do'}" JSON to clipboard!`, "green", 2500);
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
        if (typeof showNotification === "function") showNotification("CAN Do backed up successfully!", "green");
    }).catch(err => {
        if (typeof showNotification === "function") showNotification("Failed to export CAN Do: " + err, "red");
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
                if (typeof addCanDoRuleUI === "function") {
                    data.rules.forEach(r => addCanDoRuleUI(r, true));
                }
                if (data.settings) {
                    if (data.settings.vehicle_model) localStorage.setItem("wican_vehicle_model", data.settings.vehicle_model);
                    if (data.settings.vehicle_trim) localStorage.setItem("wican_vehicle_trim", data.settings.vehicle_trim);
                    if (data.settings.vehicle_profile) localStorage.setItem("wican_vehicle_profile", data.settings.vehicle_profile);
                    if (data.settings.unit_system) {
                        localStorage.setItem("wican_unit_system", data.settings.unit_system);
                        const unitSel = document.getElementById("can_do_unit_system");
                        if (unitSel) unitSel.value = data.settings.unit_system;
                        if (typeof changeUnitSystem === "function") changeUnitSystem(data.settings.unit_system, false);
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
                    if (typeof showNotification === "function") showNotification(`Restored and saved ${data.rules.length} CAN Do rule(s) successfully!`, "green");
                }).catch(err => {
                    if (typeof showNotification === "function") showNotification("Rules loaded in editor. Click 'Store CAN Do Rules' to save.", "blue");
                });
            } else if (data && (data.triggers || data.trigger || data.name)) {
                if (typeof addCanDoRuleUI === "function") {
                    addCanDoRuleUI(data, false, true);
                }
                if (typeof showNotification === "function") showNotification(`Imported rule "${data.name || 'Custom Rule'}"! Click Save to persist.`, "green", 4000);
            } else {
                if (typeof showNotification === "function") showNotification("Invalid CAN Do backup file format.", "red");
            }
        } catch (err) {
            if (typeof showNotification === "function") showNotification("Failed to parse backup file: " + err, "red");
        }
        inputElem.value = "";
    };
    reader.readAsText(file);
}

function saveAllCanDoAutomations(elem) {
    if (typeof saveCanDoRulesUI === "function") {
        saveCanDoRulesUI(elem);
    }
}

function saveCanDoRulesUI(sourceElem) {
    const rules = [];
    const cards = document.querySelectorAll("#can_do_rules_container .can-do-rule-card");
    cards.forEach(card => {
        const ruleData = (typeof extractCanDoRuleData === "function") ? extractCanDoRuleData(card) : null;
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
        if (typeof clearCanDoDirty === "function") clearCanDoDirty();
        if (typeof showNotification === "function") showNotification("CAN Do saved successfully!", "green");
        const targetCard = sourceElem ? sourceElem.closest(".can-do-rule-card") : null;
        if (targetCard) {
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
        if (typeof showNotification === "function") showNotification("Failed to save CAN Do: " + err, "red");
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
    if (typeof initUnitSystemUI === "function") initUnitSystemUI();
    initCanDoCaptureModeUI();
    if (typeof loadCanDoCatalog === "function") loadCanDoCatalog();

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
                if (typeof changeUnitSystem === "function") changeUnitSystem(data.settings.unit_system, false);
            }
            if (settingsChanged) {
                initCanDoVehicleProfileUI();
            }
            if (data.settings.custom_presets) {
                const cp = data.settings.custom_presets;
                if (Array.isArray(cp.triggers)) localStorage.setItem("wican_custom_trig_presets", JSON.stringify(cp.triggers));
                if (Array.isArray(cp.actions)) localStorage.setItem("wican_custom_act_presets", JSON.stringify(cp.actions));
                if (Array.isArray(cp.conditions)) localStorage.setItem("wican_custom_cond_presets", JSON.stringify(cp.conditions));
                if (typeof refreshAllCanDoPresetDropdowns === "function") refreshAllCanDoPresetDropdowns();
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
            if (typeof addCanDoRuleUI === "function") {
                data.rules.forEach(r => addCanDoRuleUI(r, true));
            }
        } else {
            const defRule = getDefaultPreconditionRule();
            window._cachedCanDoRules = [defRule];
            if (typeof addCanDoRuleUI === "function") {
                addCanDoRuleUI(defRule, true);
            }
        }
        setTimeout(() => {
            window._suppressCanDoDirty = false;
            if (typeof clearCanDoDirty === "function") clearCanDoDirty();
        }, 150);
    }).catch(err => {
        console.log("No saved CAN Do rules found, initializing default rule:", err);
        const container = document.getElementById("can_do_rules_container");
        if (container && container.children.length === 0) {
            window._suppressCanDoDirty = true;
            const defRule = getDefaultPreconditionRule();
            window._cachedCanDoRules = [defRule];
            if (typeof addCanDoRuleUI === "function") {
                addCanDoRuleUI(defRule, true);
            }
        }
        setTimeout(() => {
            window._suppressCanDoDirty = false;
            window._canDoIsDirty = false;
        }, 500);
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
        if (typeof showNotification === "function") showNotification(msg, "blue", 3000);
        if (typeof checkStatus === "function") checkStatus();
    }).catch(err => {
        if (typeof showNotification === "function") showNotification("Failed to set Capture Mode: " + err, "red");
    });
}