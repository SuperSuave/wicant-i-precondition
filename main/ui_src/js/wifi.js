// --- MULTI-NETWORK STA CONFIG HELPERS ---
function renderStaNetworksList(networks) {
    const container = document.getElementById("sta_networks_container");
    if (!container) return;
    container.innerHTML = "";
    let list = (networks && Array.isArray(networks) && networks.length > 0) ? networks : [];
    if (list.length === 0) {
        const s = document.getElementById("ssid_value")?.value || "";
        const p = document.getElementById("pass_value")?.value || "";
        const sec = document.getElementById("sta_security")?.value || "wpa3";
        if (s) {
            list.push({ ssid: s, pass: p, security: sec });
        } else {
            list.push({ ssid: "MeatPi", pass: "TomatoSauce", security: "wpa3" });
        }
    }
    list.forEach((net, idx) => {
        renderStaNetworkItem(container, net, idx + 1);
    });
    updateStaNetworksUI();
}

function renderStaNetworkItem(container, data = {}, priority = 1) {
    const div = document.createElement("div");
    div.className = "sta-net-card";

    div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="sta-net-title">
                            Priority <span class="sta-net-priority">${priority}</span>:
                        </span>
                        <div style="display: flex; align-items: center; gap: 0.3rem;">
                            <button type="button" class="system-button can-do-btn-move" onclick="moveStaNetworkItem(this, -1)" title="Increase Priority">▲</button>
                            <button type="button" class="system-button can-do-btn-move" onclick="moveStaNetworkItem(this, 1)" title="Decrease Priority">▼</button>
                            <button type="button" class="delete-btn" onclick="removeStaNetworkItem(this)" title="Remove Network"><svg style="width:14px;height:14px;fill:currentColor;"><use href="#icon-trash"/></svg></button>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 90px; gap: 0.5rem; align-items: center;">
                        <div>
                            <label>SSID:</label>
                            <input type="text" class="sta-net-ssid" value="${data.ssid || ''}" placeholder="Wi-Fi SSID" oninput="updateLegacyStaFields()">
                        </div>
                        <div>
                            <label>Password:</label>
                            <div class="sta-net-pass-wrap">
                                <input type="password" class="sta-net-pass" value="${data.pass || ''}" placeholder="Password" oninput="updateLegacyStaFields()">
                                <button type="button" class="sta-net-toggle-pass" onclick="togglePassVisibility(this)" title="Toggle Password">Show</button>
                            </div>
                        </div>
                        <div>
                            <label>Security:</label>
                            <select class="sta-net-sec" onchange="updateLegacyStaFields()">
                                <option value="wpa3" ${data.security === 'wpa3' ? 'selected' : ''}>WPA3</option>
                                <option value="wpa2" ${data.security === 'wpa2' ? 'selected' : ''}>WPA2</option>
                            </select>
                        </div>
                    </div>
                `;
    container.appendChild(div);
    updateStaNetworksUI();
}

function addStaNetworkRow() {
    const container = document.getElementById("sta_networks_container");
    if (!container) return;
    const currentCount = container.querySelectorAll(".sta-net-card").length;
    if (currentCount >= 5) {
        showNotification("Maximum of 5 Wi-Fi networks supported", "yellow", 3000);
        return;
    }
    renderStaNetworkItem(container, { ssid: "", pass: "", security: "wpa3" }, currentCount + 1);
    updateLegacyStaFields();
}

function removeStaNetworkItem(btn) {
    const card = btn.closest(".sta-net-card");
    if (!card) return;
    const container = card.parentElement;
    card.remove();
    renumberStaNetworks(container);
    updateLegacyStaFields();
}

function moveStaNetworkItem(btn, dir) {
    const card = btn.closest(".sta-net-card");
    if (!card) return;
    const container = card.parentElement;
    const cards = Array.from(container.querySelectorAll(".sta-net-card"));
    const idx = cards.indexOf(card);
    if (idx === -1) return;

    if (dir === -1 && idx > 0) {
        container.insertBefore(card, cards[idx - 1]);
    } else if (dir === 1 && idx < cards.length - 1) {
        container.insertBefore(card, cards[idx + 1].nextElementSibling);
    }
    renumberStaNetworks(container);
    updateLegacyStaFields();
}

function renumberStaNetworks(container) {
    if (!container) return;
    container.querySelectorAll(".sta-net-card").forEach((card, idx) => {
        const p = card.querySelector(".sta-net-priority");
        if (p) p.textContent = idx + 1;
    });
    updateStaNetworksUI();
}

function getStaNetworksData() {
    const container = document.getElementById("sta_networks_container");
    if (!container) return [];
    const list = [];
    container.querySelectorAll(".sta-net-card").forEach(card => {
        const ssid = card.querySelector(".sta-net-ssid")?.value.trim() || "";
        const pass = card.querySelector(".sta-net-pass")?.value || "";
        const sec = card.querySelector(".sta-net-sec")?.value || "wpa3";
        if (ssid) {
            list.push({ ssid: ssid, pass: pass, security: sec });
        }
    });
    return list;
}

function updateLegacyStaFields() {
    const nets = getStaNetworksData();
    const first = nets[0] || { ssid: "", pass: "", security: "wpa3" };
    const s = document.getElementById("ssid_value");
    const p = document.getElementById("pass_value");
    const sec = document.getElementById("sta_security");
    if (s) s.value = first.ssid;
    if (p) p.value = first.pass;
    if (sec) sec.value = first.security;
}

function updateStaNetworksUI() {
    const container = document.getElementById("sta_networks_container");
    const addBtn = document.getElementById("btn_add_wifi_net");
    if (addBtn) addBtn.disabled = false;
    if (container) {
        container.querySelectorAll("input, select, button").forEach(el => {
            el.disabled = false;
        });
    }
}


function togglePassVisibility(btn) {
    const input = btn.parentElement.querySelector("input");
    if (!input) return;
    input.type = (input.type === "password") ? "text" : "password";
}