// --- CAN Do Dirty State Tracking ---
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

// --- Application Bootstrap ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial UI & theme setup
    if (typeof initAppTheme === "function") initAppTheme();
    if (typeof initActiveTab === "function") initActiveTab();


    // 2. Fetch device time and config
    if (typeof fetchDeviceTime === "function") fetchDeviceTime();
    if (typeof Load === "function") Load();

    // 3. Load CAN Do automation catalog & rules
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

    // 4. Initial status check
    if (typeof checkStatus === "function") {
        checkStatus();
    }

    // 5. Sync anchored save FAB visibility
    const canDoFab = document.getElementById("can_do_anchored_save_fab");
    const autoTab = document.getElementById("automate");
    if (canDoFab) {
        const isAutoActive = autoTab && (autoTab.style.display === "block");
        canDoFab.style.display = isAutoActive ? "inline-flex" : "none";
    }
});
