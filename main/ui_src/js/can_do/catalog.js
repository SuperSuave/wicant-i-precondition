/* CAN_DO_CATALOG_START - Dynamic GitHub & SPIFFS Catalog Loader */

const CAN_DO_DEFAULT_FALLBACK_CATALOG = {
    catalog_version: "0.0.0",
    vehicles: [
        { id: "all_egmp", name: "All Gen5W Models (Universal)", family: "all_egmp", make: "Universal" }
    ],
    commands: []
};

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

let CAN_DO_CATALOG = {
    catalog_version: "0.0.0",
    vehicles: [],
    commands: [],
};

async function loadCanDoCatalog() {
    const applyCatalog = (data, source, info) => {
        if (!data || typeof data !== "object") {
            data = CAN_DO_DEFAULT_FALLBACK_CATALOG;
        }
        // Preserve custom imported/user presets if present in localStorage
        const customSaved = localStorage.getItem("wican_custom_imported_catalog");
        if (customSaved) {
            try {
                data = mergeCatalogData(data, JSON.parse(customSaved));
            } catch (e) { }
        }
        CAN_DO_CATALOG = data;
        try {
            localStorage.setItem("wican_can_do_catalog", JSON.stringify(data));
        } catch (e) { }
        updateCatalogStatusUI(source, info);
        populateVehicleDropdowns(data.vehicles || CAN_DO_DEFAULT_FALLBACK_CATALOG.vehicles);
        if (typeof refreshAllCanDoPresetDropdowns === "function") {
            refreshAllCanDoPresetDropdowns();
        }
    };

    // Initial default fallback
    if (!CAN_DO_CATALOG || !Array.isArray(CAN_DO_CATALOG.vehicles) || CAN_DO_CATALOG.vehicles.length === 0) {
        CAN_DO_CATALOG = CAN_DO_DEFAULT_FALLBACK_CATALOG;
    }

    // 1. Instant check from browser cache
    try {
        const cached = localStorage.getItem("wican_can_do_catalog");
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && Array.isArray(parsed.vehicles) && parsed.vehicles.length > 0) {
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
        } else {
            if (!CAN_DO_CATALOG || !Array.isArray(CAN_DO_CATALOG.vehicles) || CAN_DO_CATALOG.vehicles.length === 0) {
                applyCatalog(CAN_DO_DEFAULT_FALLBACK_CATALOG, "fallback");
            }
        }
    } catch (err) {
        console.warn("Failed to load /can_do_catalog.json from device:", err);
        if (!CAN_DO_CATALOG || !Array.isArray(CAN_DO_CATALOG.vehicles) || CAN_DO_CATALOG.vehicles.length === 0) {
            applyCatalog(CAN_DO_DEFAULT_FALLBACK_CATALOG, "fallback");
        }
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

const GEN5W_MODEL_LIST = [
    { id: "all_egmp", name: "All Gen5W Models (Universal)", make: "Universal" },
    { id: "hyundai_ioniq5", name: "Hyundai Ioniq 5", make: "Hyundai" },
    { id: "kia_ev6", name: "Kia EV6", make: "Kia" },
    { id: "hyundai_ioniq6", name: "Hyundai Ioniq 6", make: "Hyundai" }
];

function getCatalogVehicles() {
    if (CAN_DO_CATALOG && Array.isArray(CAN_DO_CATALOG.vehicles) && CAN_DO_CATALOG.vehicles.length > 0) {
        return CAN_DO_CATALOG.vehicles;
    }
    return CAN_DO_DEFAULT_FALLBACK_CATALOG.vehicles || [];
}

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

function changeCanDoVehicleModel(modelId, syncToDevice = true) {
    localStorage.setItem("wican_vehicle_model", modelId);
    populateTrimDropdown(modelId, modelId, getCatalogVehicles());
    const trimSel = document.getElementById("can_do_vehicle_trim");
    const activeProfile = (trimSel && trimSel.value) ? trimSel.value : modelId;
    localStorage.setItem("wican_vehicle_profile", activeProfile);
    localStorage.setItem("wican_vehicle_trim", activeProfile);

    const hiddenSel = document.getElementById("can_do_vehicle_profile");
    if (hiddenSel) hiddenSel.value = activeProfile;

    if (typeof refreshAllCanDoPresetDropdowns === "function") {
        refreshAllCanDoPresetDropdowns();
    }

    const modelSel = document.getElementById("can_do_vehicle_model");
    const mName = modelSel ? (modelSel.selectedOptions[0]?.text || modelId) : modelId;
    showNotification("Vehicle model set to: " + mName, "green", 3000);
    if (syncToDevice && typeof autoSaveCanDoRules === "function") {
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

function getSelectedVehicleProfile() {
    const trimSel = document.getElementById("can_do_vehicle_trim");
    if (trimSel && trimSel.value) return trimSel.value;
    const modelSel = document.getElementById("can_do_vehicle_model");
    if (modelSel && modelSel.value) return modelSel.value;
    const hiddenSel = document.getElementById("can_do_vehicle_profile");
    if (hiddenSel && hiddenSel.value) return hiddenSel.value;
    return localStorage.getItem("wican_vehicle_profile") || "all_egmp";
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
