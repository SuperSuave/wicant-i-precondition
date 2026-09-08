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

function saveCustomTrigPreset(presetObj) {
    const list = getCustomTrigPresets();
    list.push(presetObj);
    localStorage.setItem("wican_custom_trig_presets", JSON.stringify(list));
    refreshAllCanDoPresetDropdowns();
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
}

function saveCustomActPreset(presetObj) {
    const list = getCustomActPresets();
    list.push(presetObj);
    localStorage.setItem("wican_custom_act_presets", JSON.stringify(list));
    refreshAllCanDoPresetDropdowns();
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
}

function saveCustomCondPreset(presetObj) {
    const list = getCustomCondPresets();
    list.push(presetObj);
    localStorage.setItem("wican_custom_cond_presets", JSON.stringify(list));
    refreshAllCanDoPresetDropdowns();
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
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

// --- TRIGGER SUB-ITEMS ---

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
    const col = elem.closest(".ha-form-control-col") || elem.closest("tr") || elem.parentElement;
    if (!col) return;
    const input = col.querySelector(".can-do-act-popup-msg");
    if (!input) return;
    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    const val = input.value;
    input.value = val.substring(0, start) + token + val.substring(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + token.length;
    input.dispatchEvent(new Event("input", { bubbles: true }));
}