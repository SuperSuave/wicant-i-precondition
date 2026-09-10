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

    // Create Native <dialog> Element
    const dialog = document.createElement("dialog");
    dialog.className = "ha-add-element-dialog-overlay ha-native-dialog";
    dialog.style.cssText = "border: none; padding: 0; background: transparent; max-width: 100vw; max-height: 100vh;";

    dialog.innerHTML = `
                        <div class="ha-add-element-dialog" onclick="event.stopPropagation();">
                            <div class="ha-dialog-header">
                                <div class="ha-dialog-header-top">
                                    <div class="ha-dialog-title-wrap">
                                        <span class="can-do-ha-pill ${typeConfig.pillClass}">${typeConfig.pillText}</span>
                                        <h3 class="ha-dialog-title">${typeConfig.title}</h3>
                                    </div>
                                    <button type="button" class="ha-dialog-close-btn" onclick="const d = this.closest('dialog'); if (d) { d.close(); d.remove(); }" title="Close dialog">✕</button>
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

    document.body.appendChild(dialog);
    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    }
    const overlay = dialog;

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
        if (typeof overlay.close === "function") overlay.close();
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
        if (e.target === overlay) {
            if (typeof overlay.close === "function") overlay.close();
            overlay.remove();
        }
    };

    overlay.onclose = () => overlay.remove();

    renderPicker();
    setTimeout(() => searchInput.focus(), 60);
}

function showCanDoHaSettingsModal(btn) {
    const card = btn ? btn.closest(".can-do-rule-card") : null;
    if (!card) return;

    document.querySelectorAll(".can-do-ha-settings-modal-overlay, dialog.ha-native-dialog").forEach(el => {
        if (el.querySelector("#can_do_modal_ha_expose")) el.remove();
    });

    const ruleName = card.querySelector(".can-do-name")?.value || "CAN Do Automation";
    const currentExpose = card.dataset.haExpose !== undefined ? (card.dataset.haExpose === "true") : true;
    const currentIcon = card.dataset.haIcon || "mdi:car-defrost-rear";

    const dialog = document.createElement("dialog");
    dialog.className = "ha-add-element-dialog-overlay ha-native-dialog";
    dialog.style.cssText = "border: none; padding: 0; background: transparent; max-width: 100vw; max-height: 100vh;";

    dialog.innerHTML = `
        <div class="ha-add-element-dialog" style="max-width: 480px;" onclick="event.stopPropagation();">
            <div class="ha-dialog-header">
                <div class="ha-dialog-header-top">
                    <div class="ha-dialog-title-wrap">
                        <span class="can-do-ha-pill act-pill">Home Assistant</span>
                        <h3 class="ha-dialog-title">Home Assistant Integration</h3>
                    </div>
                    <button type="button" class="ha-dialog-close-btn" onclick="const d = this.closest('dialog'); if (d) { d.close(); d.remove(); }" title="Close dialog">✕</button>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    "${escapeHtml(ruleName)}"
                </div>
            </div>
            <div class="ha-dialog-body" style="padding: 1.25rem; gap: 1.1rem; display: flex; flex-direction: column;">
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
                    <input type="text" id="can_do_modal_ha_icon" value="${escapeHtml(currentIcon)}" placeholder="mdi:car-defrost-rear" style="width: 100%; box-sizing: border-box; font-family: monospace; font-size: 0.88rem; padding: 0.45rem 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--input-bg); color: var(--text-heading);">
                    <span style="font-size: 0.73rem; color: var(--text-muted); margin-top: 3px; display: block;">Specify any standard icon from <a href="https://pictogrammers.com/library/mdi/" target="_blank" rel="noopener" style="color: var(--md-sys-color-primary); text-decoration: underline;">pictogrammers.com/mdi</a></span>

                    <div style="margin-top: 0.6rem; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center;">
                        <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted); margin-right: 2px;">Quick Pick:</span>
                        <button type="button" class="dash-outline-btn" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:car-defrost-rear'">Defrost</button>
                        <button type="button" class="dash-outline-btn" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:car-electric'">EV Battery</button>
                        <button type="button" class="dash-outline-btn" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:air-conditioner'">Climate</button>
                        <button type="button" class="dash-outline-btn" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:car-door-lock'">Locks</button>
                        <button type="button" class="dash-outline-btn" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:car-back'">Trunk</button>
                        <button type="button" class="dash-outline-btn" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:car-light-high'">Lights</button>
                        <button type="button" class="dash-outline-btn" style="padding: 2px 7px; font-size: 0.74rem;" onclick="document.getElementById('can_do_modal_ha_icon').value='mdi:flash'">Generic</button>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.8rem; border-top: 1px solid var(--border-color); padding-top: 0.9rem;">
                    <button type="button" class="dash-outline-btn" onclick="const d = this.closest('dialog'); if (d) { d.close(); d.remove(); }">Cancel</button>
                    <button type="button" class="dash-action-btn" style="font-weight: 600; margin: 0;" onclick="saveCanDoHaSettingsModal(this, window._activeHaTargetCard);">Save HA Settings</button>
                </div>
            </div>
        </div>
    `;

    window._activeHaTargetCard = card;
    document.body.appendChild(dialog);
    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    }

    dialog.onclick = (e) => {
        if (e.target === dialog) {
            if (typeof dialog.close === "function") dialog.close();
            dialog.remove();
        }
    };
    dialog.onclose = () => dialog.remove();
}

function saveCanDoHaSettingsModal(btn, card) {
    if (!card) {
        card = window._activeHaTargetCard;
    }
    const dialog = btn ? btn.closest("dialog") : document.querySelector("dialog");
    if (!card || !dialog) return;

    const exposeCb = dialog.querySelector("#can_do_modal_ha_expose");
    const iconInput = dialog.querySelector("#can_do_modal_ha_icon");

    card.dataset.haExpose = (exposeCb && exposeCb.checked) ? "true" : "false";
    card.dataset.haIcon = (iconInput && iconInput.value.trim()) ? iconInput.value.trim() : "mdi:car-defrost-rear";

    if (typeof dialog.close === "function") dialog.close();
    dialog.remove();
    autoSaveCanDoRules("Updated Home Assistant settings for " + (card.querySelector(".can-do-name")?.value || "rule"), "blue");
}

function getExposedCatalogCategories() {
    try {
        const saved = localStorage.getItem("wican_ha_exposed_catalog_cats");
        if (saved) return JSON.parse(saved);
    } catch (e) { }
    return { doors: true, locks: true, battery: true, climate: true, seats: false, dynamics: false };
}

function saveExposedCatalogCategories(cats) {
    try {
        localStorage.setItem("wican_ha_exposed_catalog_cats", JSON.stringify(cats));
    } catch (e) { }
}

function toggleCanDoGlobalSettingsModal() {
    document.querySelectorAll(".can-do-global-settings-modal-overlay").forEach(el => el.remove());

    const currentUnit = getUnitSystem();
    const exposedCats = getExposedCatalogCategories();

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

                                <!-- Home Assistant Catalog Entity Exposure -->
                                <div style="border-top: 1px dashed var(--border-color); padding-top: 0.8rem; margin-top: 0.2rem;">
                                    <label style="font-weight: 600; font-size: 0.88rem; color: var(--text-heading); display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.4rem;">
                                        <span>Home Assistant Vehicle State Exposure</span>
                                    </label>
                                    <span style="font-size: 0.74rem; color: var(--text-muted); display: block; margin-bottom: 0.6rem;">Select which catalog vehicle signal categories are automatically exposed as Home Assistant sensors:</span>

                                    <div id="ha_cat_exposure_grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; font-size: 0.82rem; color: var(--text-heading);">
                                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                                            <input type="checkbox" id="ha_cat_doors" ${exposedCats.doors ? "checked" : ""} style="accent-color: var(--md-sys-color-primary);">
                                            <span>Door &amp; Hatch States</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                                            <input type="checkbox" id="ha_cat_locks" ${exposedCats.locks ? "checked" : ""} style="accent-color: var(--md-sys-color-primary);">
                                            <span>Door Lock Status</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                                            <input type="checkbox" id="ha_cat_battery" ${exposedCats.battery ? "checked" : ""} style="accent-color: var(--md-sys-color-primary);">
                                            <span>Battery SOC &amp; Charging</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                                            <input type="checkbox" id="ha_cat_climate" ${exposedCats.climate ? "checked" : ""} style="accent-color: var(--md-sys-color-primary);">
                                            <span>Climate &amp; Temps</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;" id="lbl_ha_cat_seats">
                                            <input type="checkbox" id="ha_cat_seats" ${exposedCats.seats ? "checked" : ""} style="accent-color: var(--md-sys-color-primary);">
                                            <span>Seat &amp; Wheel Comfort</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                                            <input type="checkbox" id="ha_cat_dynamics" ${exposedCats.dynamics ? "checked" : ""} style="accent-color: var(--md-sys-color-primary);">
                                            <span>Gears &amp; Speed</span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Imperial / Metric Unit System -->
                                <div class="ha-form-row" style="display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.4rem;">
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
        updateVehicleFeatureGatingUI();
    } catch (e) {
        console.error("Error populating vehicle dropdowns:", e);
    }
}

function updateVehicleFeatureGatingUI() {
    try {
        const modelSel = document.getElementById("can_do_vehicle_model");
        const trimSel = document.getElementById("can_do_vehicle_trim");
        if (!modelSel || !trimSel) return;

        const selectedTrimId = trimSel.value || modelSel.value;
        const vehicles = (typeof getCatalogVehicles === "function") ? getCatalogVehicles() : [];
        const activeVehicle = vehicles.find(v => v.id === selectedTrimId || v.family === selectedTrimId) || vehicles[0];

        if (activeVehicle && activeVehicle.features) {
            const seatsCb = document.getElementById("ha_cat_seats");
            const seatsLbl = document.getElementById("lbl_ha_cat_seats");
            const hasSeatsFeature = activeVehicle.features.includes("heated_seats") || activeVehicle.features.includes("ventilated_seats") || activeVehicle.features.includes("heated_wheel");

            if (seatsCb) {
                if (!hasSeatsFeature) {
                    seatsCb.checked = false;
                    seatsCb.disabled = true;
                    if (seatsLbl) {
                        seatsLbl.style.opacity = "0.5";
                        seatsLbl.title = "Not supported by selected vehicle trim";
                    }
                } else {
                    seatsCb.disabled = false;
                    if (seatsLbl) {
                        seatsLbl.style.opacity = "1.0";
                        seatsLbl.title = "";
                    }
                }
            }
        }
    } catch (err) {
        console.warn("Failed to gate HA feature categories by vehicle:", err);
    }
}

function saveCanDoGlobalSettings(btn) {
    try {
        const urlInput = document.getElementById("modal_catalog_url");
        if (urlInput) {
            saveCanDoCatalogUrl(urlInput.value);
        }

        const overlay = btn ? btn.closest(".can-do-global-settings-modal-overlay") : document.querySelector(".can-do-global-settings-modal-overlay");
        if (overlay) {
            const cats = {
                doors: overlay.querySelector("#ha_cat_doors")?.checked ?? true,
                locks: overlay.querySelector("#ha_cat_locks")?.checked ?? true,
                battery: overlay.querySelector("#ha_cat_battery")?.checked ?? true,
                climate: overlay.querySelector("#ha_cat_climate")?.checked ?? true,
                seats: overlay.querySelector("#ha_cat_seats")?.checked ?? false,
                dynamics: overlay.querySelector("#ha_cat_dynamics")?.checked ?? false
            };
            saveExposedCatalogCategories(cats);
        }
    } catch (e) {
        console.error("Error saving catalog settings:", e);
    }
    const overlay = btn ? btn.closest(".can-do-global-settings-modal-overlay") : document.querySelector(".can-do-global-settings-modal-overlay");
    if (overlay) {
        overlay.remove();
    }
    showNotification("Settings updated successfully", "green", 2000);
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
