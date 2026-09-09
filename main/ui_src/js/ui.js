// --- GENERAL UI, TABS, THEMES & NOTIFICATIONS ---

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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

function submit_enable() {
    const wifiModeEl = document.getElementById("wifi_mode");
    if (!wifiModeEl) return;

    const isAp = (wifiModeEl.value === "AP");
    const ssidEl = document.getElementById("ssid_value");
    const passEl = document.getElementById("pass_value");
    const secEl = document.getElementById("sta_security");

    if (ssidEl) ssidEl.disabled = isAp;
    if (passEl) passEl.disabled = isAp;
    if (secEl) secEl.disabled = isAp;

    const bleEl = document.getElementById("ble_status");
    const apAutoDisable = document.getElementById("ap_auto_disable");

    if (bleEl) {
        if (isAp) {
            bleEl.disabled = false;
            if (apAutoDisable) apAutoDisable.disabled = true;
        } else {
            bleEl.disabled = true;
            bleEl.checked = false;
        }

        const warn = document.getElementById("ble_warning_div");
        const mqttEl = document.getElementById("mqtt_en");
        const mqttDiv = document.getElementById("mqtt_en_div");

        if (!bleEl.checked) {
            if (warn) warn.style.display = "block";
            if (mqttEl) { mqttEl.checked = false; mqttEl.disabled = true; }
            if (mqttDiv) mqttDiv.style.display = "none";
        } else {
            if (warn) warn.style.display = "none";
            if (mqttEl) mqttEl.disabled = false;
        }
    }

    if (typeof updateStaNetworksUI === "function") updateStaNetworksUI();

    const submitBtn = document.getElementById("submit_button");
    if (submitBtn) submitBtn.disabled = false;
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
        document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    }
}

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

function openTab(evt, tabName) {
    const tabcontent = document.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    const tablinks = document.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
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

    window.scrollTo(0, 0);
    const contentDiv = document.querySelector(".content");
    if (contentDiv) contentDiv.scrollTop = 0;
}

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

let _rtfNarrow = null;
try {
    if (typeof Intl !== "undefined" && Intl.RelativeTimeFormat) {
        _rtfNarrow = new Intl.RelativeTimeFormat('en', { style: 'narrow', numeric: 'always' });
    }
} catch (e) { }

function formatAge(ageMs) {
    if (ageMs === undefined || ageMs === null || isNaN(ageMs)) return "0s";
    const seconds = Math.max(0, Math.round(ageMs / 1000));
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return _rtfNarrow ? _rtfNarrow.format(-minutes, 'minute').replace(' ago', '').replace(' ', '') : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    return _rtfNarrow ? _rtfNarrow.format(-hours, 'hour').replace(' ago', '').replace(' ', '') : `${hours}h`;
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