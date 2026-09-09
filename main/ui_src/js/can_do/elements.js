// --- CAN DO AUTOMATION CARD & ELEMENT INTERACTION HELPERS ---

function escapeHtml(str) {
    return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toggleCanDoSettingsMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById("can_do_settings_menu");
    if (menu) menu.classList.toggle("show");
}

function closeCanDoSettingsMenu() {
    const menu = document.getElementById("can_do_settings_menu");
    if (menu) menu.classList.remove("show");
}

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
    } else if (typeof saveCanDoRulesUI === "function") {
        saveCanDoRulesUI(btn);
    }
}

function handleCanDoHeaderClick(event, headerElem) {
    if (event.target.closest("button") || event.target.closest("input") || event.target.closest("select") || event.target.closest("textarea")) {
        return;
    }
    toggleCanDoRuleCard(headerElem);
}

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

    if (typeof markCanDoDirty === "function") markCanDoDirty();
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
    if (!parent) return;

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

    if (item.classList.contains("can-do-payload-step-item") && typeof renumberCanDoPayloadSteps === "function") {
        renumberCanDoPayloadSteps(parent);
    }
    if (item.classList.contains("can-do-choose-option-item")) {
        renumberCanDoChooseOptions(parent);
    }
    const card = btn.closest(".can-do-rule-card");
    if (card && typeof updateCanDoSectionCountBadges === "function") {
        updateCanDoSectionCountBadges(card);
    }
}

function updateCanDoItemConnectors(card) {
    if (!card) return;

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

        condContainer.querySelectorAll(".can-do-condition-or-group").forEach(group => {
            const innerCont = group.querySelector(".can-do-or-group-container");
            updateConditionContainerConnectors(innerCont, "OR", "group-or");
        });
    }

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

        actContainer.querySelectorAll(".can-do-ifthen-block").forEach(block => {
            updateConditionContainerConnectors(block.querySelector(".can-do-ifthen-conditions-container"), "AND", "ifthen");
            updateActionContainerConnectors(block.querySelector(".can-do-ifthen-then-container"));
            updateActionContainerConnectors(block.querySelector(".can-do-ifthen-else-container"));
        });

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
        if (clickCount === 2) sText += " (Double)";
        else if (clickCount === 3) sText += " (Triple)";
        if (forSec > 0 && src !== "clock" && src !== "interval") {
            sText += ` (${forSec}s)`;
        }
        trigSummaries.push(sText);
    });

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
        const isImp = (typeof getUnitSystem === "function" && getUnitSystem() === "imperial");
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
            actSummaries.push(`Wait ${typeof formatDurationDisplay === "function" ? formatDurationDisplay(ms) : ms + 'ms'}`);
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
        <span class="can-do-ha-pill trig-pill" style="font-size: 0.72rem; padding: 2px 7px;">When: ${trigText}</span>
        ${condText ? `<span class="can-do-ha-pill cond-pill" style="font-size: 0.72rem; padding: 2px 7px;">And if: ${condText}</span>` : ''}
        <span class="can-do-ha-pill act-pill" style="font-size: 0.72rem; padding: 2px 7px;">Then do: ${actText}</span>
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
    if (typeof updateCanDoRuleTriggerDropdowns === "function") updateCanDoRuleTriggerDropdowns(card);
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
            badge.title = "Automation paused";
            return;
        }

        if (st.is_active) {
            const ageSec = (st.age_ms !== undefined && st.age_ms >= 0) ? Math.round(st.age_ms / 1000) : 0;
            let ageStr = `${ageSec}s ago`;
            if (ageSec > 60) ageStr = `${Math.floor(ageSec / 60)}m ago`;
            badge.className = "can-do-activity-badge active-on";
            badge.textContent = `ON (${st.count}x, ${ageStr})`;
            badge.title = "Rule is currently TOGGLED ON";
        } else if (st.count === 0 || st.age_ms === -1) {
            badge.className = "can-do-activity-badge idle";
            badge.textContent = "Idle";
            badge.title = "Live trigger activity";
        } else {
            const ageSec = Math.round(st.age_ms / 1000);
            let ageStr = `${ageSec}s ago`;
            if (ageSec > 60) ageStr = `${Math.floor(ageSec / 60)}m ago`;
            badge.textContent = `${st.count}x (${ageStr})`;
            badge.title = `Fired ${st.count} time(s), last ${ageStr}`;

            if (st.age_ms >= 0 && st.age_ms < 4000) {
                badge.className = "can-do-activity-badge recent-fire";
            } else {
                badge.className = "can-do-activity-badge fired";
            }
        }
    });
}

function extractCanDoActionData(item) {
    const steps = [];
    const payloadLines = [];
    item.querySelectorAll(".can-do-payload-step-item").forEach(stepItem => {
        const p = (typeof getByteGridString === "function") ? getByteGridString(stepItem, "can-do-step-byte") : "";
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
        if (selectedPresetVal && typeof getFilteredActionPresets === "function") {
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

    const isImperial = (typeof getUnitSystem === "function" && getUnitSystem() === "imperial");
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
    }).then(() => {
        btn.textContent = "✓ Executed!";
        btn.classList.remove("btn-running");
        btn.classList.add("btn-success");
        if (typeof showNotification === "function") showNotification(`Action (${actData.type}) executed on CAN bus successfully!`, "green", 3500);
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("btn-success");
            btn.disabled = false;
        }, 2000);
    }).catch(err => {
        btn.textContent = "✕ Error";
        btn.classList.remove("btn-running");
        btn.classList.add("btn-error");
        if (typeof showNotification === "function") showNotification("Test action failed: " + err, "red", 4000);
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
    const ruleData = (typeof extractCanDoRuleData === "function") ? extractCanDoRuleData(card) : null;
    if (!ruleData) return;

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
        if (typeof showNotification === "function") showNotification(`Rule "${ruleData.name}" executed successfully!`, "green", 3500);
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("btn-success");
            btn.disabled = false;
        }, 2000);
    } catch (err) {
        btn.textContent = "✕ Error";
        btn.classList.remove("btn-running");
        btn.classList.add("btn-error");
        if (typeof showNotification === "function") showNotification("Failed to execute rule: " + err, "red", 4000);
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
    const ruleData = (typeof extractCanDoRuleData === "function") ? extractCanDoRuleData(card) : null;
    if (!ruleData) return;

    const originalText = btn.textContent;
    btn.textContent = "Simulating...";
    btn.disabled = true;

    const condButtons = card.querySelectorAll(".can-do-btn-test-cond");
    if (condButtons.length > 0 && typeof testCanDoConditionUI === "function") {
        condButtons.forEach(b => testCanDoConditionUI(b));
        setTimeout(() => {
            btn.textContent = "Evaluated!";
            if (typeof showNotification === "function") {
                showNotification(`Dry run complete for "${ruleData.name}": conditions evaluated live without transmitting CAN frames.`, "blue", 4000);
            }
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 2000);
        }, 800);
    } else {
        if (typeof showNotification === "function") {
            showNotification(`Rule "${ruleData.name}" has no conditions (unconditional trigger). Actions would execute on event.`, "green", 3500);
        }
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
        const condCanPayload = (typeof getByteGridString === "function") ? getByteGridString(elem, "can-do-cond-can") : "";
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
    if (row) row.style.display = cb.checked ? "flex" : "none";
}

function duplicateCanDoRuleUI(btnOrCard) {
    const card = (btnOrCard && btnOrCard.classList?.contains("can-do-rule-card"))
        ? btnOrCard
        : (btnOrCard?.closest ? btnOrCard.closest(".can-do-rule-card") : (window._activeRuleCard || window._activeMenuCard));
    if (!card) return;

    const ruleData = (typeof extractCanDoRuleData === "function") ? extractCanDoRuleData(card) : null;
    if (!ruleData) return;

    if (ruleData.name) {
        ruleData.name = ruleData.name.replace(/\s*\(Copy(\s+\d+)?\)$/, "") + " (Copy)";
    } else {
        ruleData.name = "New CAN Do (Copy)";
    }

    if (typeof addCanDoRuleUI === "function") {
        addCanDoRuleUI(ruleData, false, false);
    }

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
    if (typeof showNotification === "function") showNotification("Duplicated CAN Do: " + ruleData.name, "green", 2500);
    if (typeof autoSaveCanDoRules === "function") autoSaveCanDoRules();
}

function deleteCanDoRuleUI(btn) {
    const card = btn.closest(".can-do-rule-card") || btn.closest(".pid-entry");
    if (!card) return;
    const name = card.querySelector(".can-do-name")?.value || "CAN Do";
    card.remove();

    const remaining = document.querySelectorAll("#can_do_rules_container .can-do-rule-card");
    if (remaining.length === 0) {
        // --- SAFE FALLBACK USED HERE ---
        const defaultRule = (typeof getDefaultPreconditionRule === "function")
            ? getDefaultPreconditionRule()
            : { name: "Default", triggers: [], actions: [] };

        defaultRule.enabled = false;
        if (typeof addCanDoRuleUI === "function") {
            addCanDoRuleUI(defaultRule, true);
        }
        if (typeof autoSaveCanDoRules === "function") {
            autoSaveCanDoRules(`Deleted "${name}". Default rule restored (Paused).`, "blue");
        }
    } else {
        if (typeof autoSaveCanDoRules === "function") {
            autoSaveCanDoRules(`Deleted "${name}"`, "blue");
        }
    }
}

function insertCanDoPopupTokenUnit(elem, tokenBase) {
    const isImperial = (typeof getUnitSystem === "function" && getUnitSystem() === "imperial");
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

function showTrackPopup() {
    const textInput = document.getElementById("track_popup_text");
    const popupButton = document.getElementById("track_popup_button");
    if (!textInput || textInput.value.length === 0) {
        if (typeof showNotification === "function") showNotification("Enter track popup text", "red");
        return;
    }

    const xhttp = new XMLHttpRequest();
    if (popupButton) popupButton.disabled = true;
    xhttp.onload = function () {
        if (popupButton) popupButton.disabled = false;
        if (typeof showNotification === "function") {
            if (this.status >= 200 && this.status < 300) {
                showNotification(this.responseText, "green");
            } else {
                showNotification(this.responseText || "Failed to show track popup", "red");
            }
        }
    };
    xhttp.onerror = function () {
        if (popupButton) popupButton.disabled = false;
        if (typeof showNotification === "function") showNotification("Failed to show track popup", "red");
    };
    xhttp.open("POST", "/track_popup");
    xhttp.setRequestHeader("Content-Type", "text/plain; charset=UTF-8");
    xhttp.send(textInput.value);
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
        card.querySelectorAll(".can-do-subitem-body").forEach(b => {
            b.style.display = "";
        });
    });
    if (typeof showNotification === "function") {
        showNotification("All automations expanded", "blue", 1800);
    }
}

function triggerCanDoRulesImport() {
    let input = document.getElementById("can_do_import_file");
    if (!input) {
        input = document.createElement("input");
        input.type = "file";
        input.id = "can_do_import_file";
        input.accept = ".json";
        input.style.display = "none";
        input.onchange = function () {
            if (typeof importCanDoRules === "function") {
                importCanDoRules(this);
            }
        };
        document.body.appendChild(input);
    }
    input.click();
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
        body.style.display = "";
        headerElem.style.borderBottom = "1px solid var(--border-color)";
        item.classList.remove("can-do-subitem-collapsed");
        selectCanDoItem(item);
    } else {
        body.style.display = "none";
        headerElem.style.borderBottom = "none";
        item.classList.add("can-do-subitem-collapsed");
        item.classList.remove("selected");
    }
}

document.addEventListener("input", function (e) {
    if (e.target.closest("#automate, #can_do_rules_container")) {
        if (typeof markCanDoDirty === "function") markCanDoDirty();
    }
}, true);

document.addEventListener("change", function (e) {
    if (e.target.closest("#automate, #can_do_rules_container")) {
        if (typeof markCanDoDirty === "function") markCanDoDirty();
    }
}, true);

document.addEventListener("keyup", function (e) {
    if (e.target.closest("#automate, #can_do_rules_container") && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) {
        if (typeof markCanDoDirty === "function") markCanDoDirty();
    }
}, true);

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        closeCanDoSettingsMenu();
    }
});
