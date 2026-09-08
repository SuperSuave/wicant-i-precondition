// --- CAN HARDWARE & FILTER CONFIGURATION ---

var canData = [];

function isNameUnique(name) {
    return canData.every((item) => item["Name"] !== name);
}

function postCANFLT() {
    var obj = { "can_flt": canData };
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        if (typeof showNotification === "function") {
            showNotification(this.responseText, "green");
        }
        if (typeof submit_enable === "function") {
            submit_enable();
        }
    };
    xhttp.open("POST", "/store_canflt");
    xhttp.setRequestHeader("Content-Type", "application/json");
    xhttp.send(JSON.stringify(obj));
}

function storeCANFLT() {
    postCANFLT();
    const storeBtn = document.getElementById("store_canflt_button");
    if (storeBtn) storeBtn.disabled = true;
}

function restoreCANFLTRow(canId, name, pid, pidi, startBit, bitLength, expression, cycle) {
    var table = document.getElementById("can_flt_table");
    if (!table) return;

    var row = table.insertRow(-1);
    row.insertCell(0).innerHTML = canId;
    row.insertCell(1).innerHTML = name;
    row.insertCell(2).innerHTML = pid;
    row.insertCell(3).innerHTML = pidi;
    row.insertCell(4).innerHTML = startBit;
    row.insertCell(5).innerHTML = bitLength;
    row.insertCell(6).innerHTML = expression;
    row.insertCell(7).innerHTML = cycle;
    row.insertCell(8).innerHTML = '<button style="width: 100%;" onclick="deleteCANFLTRow(this)">Delete</button>';

    canData.push({
        CANID: canId,
        Name: name,
        PID: pid,
        PIDIndex: pidi,
        StartBit: startBit,
        BitLength: bitLength,
        Expression: expression,
        Cycle: cycle
    });
}

function loadCANFLT() {
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        if (this.responseText === "NONE") return;
        try {
            var obj = JSON.parse(this.responseText);
            if (obj && Array.isArray(obj.can_flt)) {
                canData = [];
                const table = document.getElementById("can_flt_table");
                if (table) {
                    // Retain header row
                    while (table.rows.length > 1) {
                        table.deleteRow(1);
                    }
                }
                obj.can_flt.forEach((item) => {
                    restoreCANFLTRow(
                        item["CANID"],
                        item["Name"],
                        item["PID"],
                        item["PIDIndex"],
                        item["StartBit"],
                        item["BitLength"],
                        item["Expression"],
                        item["Cycle"]
                    );
                });
            }
        } catch (e) {
            console.error("Error parsing CAN filter response:", e);
        }
    };
    xhttp.open("GET", "/load_canflt");
    xhttp.send();
}

function addCANFLTRow() {
    var canId = parseInt(document.getElementById("canId").value);
    var startBit = parseInt(document.getElementById("startBit").value);
    var bitLength = parseInt(document.getElementById("bitLength").value);
    var cycle = parseInt(document.getElementById("cycle").value);
    var name = document.getElementById("name").value.trim();
    var expression = document.getElementById("expression").value.trim();
    var pid = parseInt(document.getElementById("pid").value);
    var pidi = parseInt(document.getElementById("pindex").value);

    if (isNaN(canId) || canId < 0 || canId > 536870912) {
        alert("CAN ID must be a valid number between 0 and 536870912");
        return;
    }
    if (isNaN(startBit) || isNaN(bitLength) || startBit > 64 - bitLength || bitLength <= 0 || bitLength > 64 || startBit < 0 || startBit > 63) {
        alert("startBit or bitLength error");
        return;
    }
    if (isNaN(cycle) || cycle < 100 || cycle > 10000) {
        alert("cycle must be between 100 and 10000");
        return;
    }
    if (name.length < 1 || name.length > 16) {
        alert("Name must be between 1 and 16 characters in length.");
        return;
    }
    if (expression.length < 1 || expression.length > 64) {
        alert("Expression must be between 1 and 64 characters in length.");
        return;
    }
    if (isNaN(pid) || pid < -1 || pid > 255) {
        alert("PID must be a number between -1 and 255");
        return;
    }
    if (isNaN(pidi) || pidi < 0 || pidi > 7) {
        alert("PID must be a number between 0 and 7");
        return;
    }

    if (!isNameUnique(name)) {
        alert("Name must be unique.");
        return;
    }

    var table = document.getElementById("can_flt_table");
    if (table.rows.length - 1 >= 100) {
        alert("Maximum row limit (100) reached.");
        return;
    }

    restoreCANFLTRow(canId, name, pid, pidi, startBit, bitLength, expression, cycle);

    document.getElementById("canId").value = "";
    document.getElementById("name").value = "";
    document.getElementById("pid").value = "";
    document.getElementById("pindex").value = "";
    document.getElementById("startBit").value = "";
    document.getElementById("bitLength").value = "";
    document.getElementById("expression").value = "";
    document.getElementById("cycle").value = "";

    const storeBtn = document.getElementById("store_canflt_button");
    if (storeBtn) storeBtn.disabled = false;
}

function deleteCANFLTRow(button) {
    var row = button.parentNode.parentNode;
    var canIdToDelete = row.cells[0].textContent;
    var indexToDelete = canData.findIndex((item) => item["CANID"] === parseInt(canIdToDelete));
    if (indexToDelete !== -1) {
        canData.splice(indexToDelete, 1);
    }
    row.parentNode.removeChild(row);

    const storeBtn = document.getElementById("store_canflt_button");
    if (storeBtn) storeBtn.disabled = false;
}

function bindEvents() {
    if (typeof ws === "undefined" || !ws) return;
    ws.onmessage = function (evt) {
        var received_msg = evt.data;
        if (received_msg[0] == "t") {
            var len = (received_msg[4] - "0") * 2;
            var data_str = "";
            for (var i = 0; i < len; i += 2) {
                data_str += received_msg.substr(i + 5, 2) + " ";
            }
            if (typeof monitor_add_line === "function") {
                monitor_add_line(received_msg.substr(1, 3) + "h", "Std", received_msg[4], data_str, 0);
            }
        } else if (received_msg[0] == "T") {
            var len = (received_msg[9] - "0") * 2;
            var data_str = "";
            for (var i = 0; i < len; i += 2) {
                data_str += received_msg.substr(i + 10, 2) + " ";
            }
            if (typeof monitor_add_line === "function") {
                monitor_add_line(received_msg.substr(1, 8) + "h", "Ext", received_msg[9], data_str, 0);
            }
        } else if (received_msg[0] == "r") {
            if (typeof monitor_add_line === "function") {
                monitor_add_line(received_msg.substr(1, 3) + "h", "RTR-Std", received_msg[4], 0, 0);
            }
        } else if (received_msg[0] == "R") {
            if (typeof monitor_add_line === "function") {
                monitor_add_line(received_msg.substr(1, 8) + "h", "RTR-Ext", received_msg[9], 0, 0);
            }
        }
    };
}

function ws_close() {
    if (typeof ws !== "undefined" && ws) {
        var crStr = typeof cr !== "undefined" ? cr : "\r";
        ws.send("C" + crStr);
        ws.close();
    }
}

function mon_button_en(b) {
    const btn = document.getElementById("mon_button");
    const rate = document.getElementById("mon_datarate");
    const filter = document.getElementById("mon_filter");
    const mask = document.getElementById("mon_mask");

    if (b == 1) {
        if (btn) btn.value = "Start";
        if (rate) rate.disabled = false;
        if (filter) filter.disabled = false;
        if (mask) mask.disabled = false;
    } else {
        if (btn) btn.value = "Stop";
        if (rate) rate.disabled = true;
        if (filter) filter.disabled = true;
        if (mask) mask.disabled = true;
    }
}

function parseCanDoPattern(patternStr) {
    if (!patternStr || typeof patternStr !== "string") return [];
    return patternStr.trim().split(/\s+/).map(tok => {
        if (tok === '*') return { type: 'any' };
        if (tok.startsWith('!')) {
            return { type: 'not', value: parseInt(tok.slice(1), 16) };
        }
        if (tok.endsWith('*')) {
            return { type: 'nibble_hi', value: parseInt(tok[0], 16) };
        }
        if (tok.startsWith('*')) {
            return { type: 'nibble_lo', value: parseInt(tok[1], 16) };
        }
        return { type: 'eq', value: parseInt(tok, 16) };
    });
}

function matchCanDoPayload(hexData, tokens) {
    if (!hexData || !tokens || tokens.length === 0) return false;
    if (hexData.length < tokens.length * 2) return false;
    for (let i = 0; i < tokens.length; i++) {
        const byteStr = hexData.slice(i * 2, i * 2 + 2);
        const byteVal = parseInt(byteStr, 16);
        if (isNaN(byteVal)) return false;
        const tok = tokens[i];
        if (tok.type === 'any') continue;
        if (tok.type === 'eq' && byteVal !== tok.value) return false;
        if (tok.type === 'not' && byteVal === tok.value) return false;
        if (tok.type === 'nibble_hi' && (byteVal >> 4) !== tok.value) return false;
        if (tok.type === 'nibble_lo' && (byteVal & 0x0F) !== tok.value) return false;
    }
    return true;
}