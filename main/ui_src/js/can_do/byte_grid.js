// --- BYTE GRID HELPER FUNCTIONS (D1 - D8) ---

function renderByteInputsHTML(prefixClass, payloadStr = "") {
    const rawBytes = (payloadStr || "").trim().split(/\s+/);
    let html = `<div class="${prefixClass}-grid" style="display: inline-flex; gap: 5px; align-items: flex-end; flex-wrap: wrap; margin-top: 4px;">`;
    for (let i = 0; i < 8; i++) {
        const rawVal = rawBytes[i] || "";
        let val = (rawVal === "**" || rawVal === "*") ? "" : rawVal;
        if (val === "SEQ3") val = "~3";
        if (val === "INC" || val === "ROLL") val = "++";
        html += `
            <div style="display: flex; flex-direction: column; align-items: center;">
                <span class="byte-label" onclick="cycleByteCounter(this)" title="Click to cycle rolling counter (~3 -> ++ -> *R -> Clear)" style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); margin-bottom: 2px; cursor: pointer; user-select: none;">D${i + 1}</span>
                <input type="text" class="${prefixClass}-byte byte-input" data-idx="${i}" maxlength="4" value="${val}" placeholder="*" 
                        oninput="handleByteInput(this)" onkeydown="handleByteKeyDown(event, this)" onpaste="handleBytePaste(event, this)"
                        title="Hex byte (e.g. 0F), wildcard (*), 3-step roll (~3/SEQ3), or increment (++)"
                        style="width: 32px; height: 26px; text-align: center; font-family: monospace; font-size: 0.85rem; font-weight: bold; text-transform: uppercase; padding: 0;">
            </div>
        `;
    }
    html += `
        <button type="button" class="system-button" onclick="setByteGridPreset(this, '${prefixClass}', '00')" title="Fill all bytes with 00" style="height: 26px; padding: 0 5px; font-size: 0.72rem; margin-left: 4px;">00</button>
        <button type="button" class="system-button" onclick="setByteGridPreset(this, '${prefixClass}', 'FF')" title="Fill all bytes with FF" style="height: 26px; padding: 0 5px; font-size: 0.72rem; margin-left: 2px;">FF</button>
        <button type="button" class="system-button" onclick="setByteGridPreset(this, '${prefixClass}', '')" title="Set all bytes to wildcard (*)" style="height: 26px; padding: 0 5px; font-size: 0.72rem; margin-left: 2px;">**</button>
        <button type="button" class="system-button" onclick="clearByteInputs(this, '${prefixClass}')" title="Clear all bytes" style="height: 26px; padding: 0 6px; font-size: 0.72rem; margin-left: 2px;">Clear</button>
    </div>`;
    return html;
}

function setByteGridPreset(btn, prefixClass, fillVal) {
    const grid = btn.closest(`.${prefixClass}-grid`);
    if (grid) {
        grid.querySelectorAll(`.${prefixClass}-byte`).forEach(inp => inp.value = fillVal);
        const card = btn.closest(".can-do-rule-card");
        if (card && typeof updateCanDoRuleSummaryPill === "function") {
            updateCanDoRuleSummaryPill(card);
        }
    }
}

function handleByteInput(input) {
    let val = input.value.trim().toUpperCase();
    if (val === "SQ" || val === "~3") {
        input.value = "~3";
        input.title = "3-step rolling counter (~0, ~1, ~2)";
    } else if (val === "++" || val === "IN") {
        input.value = "++";
        input.title = "Increment counter (+1 on every step)";
    } else if (val.length > 2) {
        input.value = val.slice(0, 2);
    } else {
        input.value = val;
    }
    const grid = input.closest("[class$='-grid']");
    const idx = parseInt(input.getAttribute("data-idx"));
    if (input.value.length === 2 && idx < 7) {
        const nextInput = grid ? grid.querySelector(`[data-idx="${idx + 1}"]`) : null;
        if (nextInput && !nextInput.value) {
            nextInput.focus();
            nextInput.select();
        }
    }
}

function handleBytePaste(event, input) {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData('text');
    if (!text) return;
    const grid = input.closest("[class$='-grid']");
    if (!grid) return;
    const startIdx = parseInt(input.getAttribute("data-idx") || "0");
    let clean = text.trim();
    if (clean.startsWith("0x") || clean.startsWith("0X")) clean = clean.slice(2);
    clean = clean.replace(/[,;:]/g, " ");
    let bytes = clean.split(/\s+/).filter(b => b.length > 0);
    if (bytes.length === 1 && bytes[0].length > 2) {
        bytes = bytes[0].match(/.{1,2}/g) || [bytes[0]];
    }
    bytes.forEach((b, i) => {
        const targetIdx = startIdx + i;
        if (targetIdx < 8) {
            const target = grid.querySelector(`[data-idx="${targetIdx}"]`);
            if (target) {
                let bv = b.toUpperCase();
                if (bv === "SEQ3" || bv === "SQ") bv = "~3";
                if (bv === "INC" || bv === "ROLL") bv = "++";
                target.value = bv;
            }
        }
    });
    const lastIdx = Math.min(startIdx + bytes.length, 7);
    const nextInput = grid.querySelector(`[data-idx="${lastIdx}"]`);
    if (nextInput) {
        nextInput.focus();
        nextInput.select();
    }
}

function handleByteKeyDown(event, input) {
    const grid = input.closest("[class$='-grid']");
    const idx = parseInt(input.getAttribute("data-idx"));
    if (event.key === "Backspace" && input.value === "" && idx > 0) {
        const prevInput = grid ? grid.querySelector(`[data-idx="${idx - 1}"]`) : null;
        if (prevInput) {
            prevInput.focus();
            prevInput.select();
        }
    } else if (event.key === "ArrowRight" && idx < 7) {
        const nextInput = grid ? grid.querySelector(`[data-idx="${idx + 1}"]`) : null;
        if (nextInput) { nextInput.focus(); nextInput.select(); }
    } else if (event.key === "ArrowLeft" && idx > 0) {
        const prevInput = grid ? grid.querySelector(`[data-idx="${idx - 1}"]`) : null;
        if (prevInput) { prevInput.focus(); prevInput.select(); }
    } else if (event.key === " ") {
        event.preventDefault();
        const nextInput = grid ? grid.querySelector(`[data-idx="${idx + 1}"]`) : null;
        if (nextInput) { nextInput.focus(); nextInput.select(); }
    }
}

function clearByteInputs(btn, prefixClass) {
    const grid = btn.closest(`.${prefixClass}-grid`);
    if (grid) {
        grid.querySelectorAll(`.${prefixClass}-byte`).forEach(inp => inp.value = "");
    }
}

function cycleByteCounter(labelElem) {
    const input = labelElem.parentElement?.querySelector(".byte-input");
    if (!input) return;
    const current = input.value.trim().toUpperCase();
    if (current === "" || current === "*") {
        input.value = "~3";
        if (typeof showNotification === "function") showNotification("Set 3-step rolling counter (~3: 0x0F -> 0x1F -> 0x2F)", "blue", 1800);
    } else if (current === "~3" || current === "SQ" || current === "SEQ3") {
        input.value = "++";
        if (typeof showNotification === "function") showNotification("Set incrementing counter (++: 0x00 -> 0xFF)", "blue", 1800);
    } else if (current === "++" || current === "INC" || current === "ROLL") {
        input.value = "*R";
        if (typeof showNotification === "function") showNotification("Set nibble counter (*R: 0x0 -> 0xF)", "blue", 1800);
    } else {
        input.value = "";
        if (typeof showNotification === "function") showNotification("Cleared byte (wildcard)", "gray", 1200);
    }
    handleByteInput(input);
}

function getByteGridString(container, prefixClass) {
    const grid = container.querySelector(`.${prefixClass}-grid`);
    if (!grid) return "";
    const inputs = grid.querySelectorAll(`.${prefixClass}-byte`);
    const bytes = [];
    let hasAny = false;
    inputs.forEach(inp => {
        let v = inp.value.trim().toUpperCase();
        if (!v || v === "*") {
            bytes.push("**");
        } else if (v === "~3" || v === "SQ" || v === "SEQ3") {
            bytes.push("SEQ3");
            hasAny = true;
        } else if (v === "++" || v === "INC" || v === "ROLL") {
            bytes.push("INC");
            hasAny = true;
        } else if (v.length === 1) {
            bytes.push("*" + v);
            hasAny = true;
        } else {
            bytes.push(v);
            hasAny = true;
        }
    });
    if (!hasAny) return "";
    while (bytes.length > 0 && bytes[bytes.length - 1] === "**") {
        bytes.pop();
    }
    return bytes.join(" ");
}

function populateByteGrid(container, prefixClass, payloadStr) {
    const grid = container.querySelector(`.${prefixClass}-grid`);
    if (!grid) return;
    const bytes = (payloadStr || "").trim().split(/\s+/);
    const inputs = grid.querySelectorAll(`.${prefixClass}-byte`);
    inputs.forEach((inp, idx) => {
        let b = bytes[idx];
        if (b === "SEQ3") b = "~3";
        if (b === "INC" || b === "ROLL") b = "++";
        inp.value = (b && b !== "**" && b !== "*") ? b : "";
    });
}

const setByteGridString = populateByteGrid;