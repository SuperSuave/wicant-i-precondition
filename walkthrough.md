# Delta Walkthrough: Changes Compared to `L1Z3/wicant-i-precondition:main`

This walkthrough details all the enhancements, subsystems, firmware architecture additions, UI capabilities, and stability fixes implemented in this repository compared to its direct upstream fork: [`L1Z3/wicant-i-precondition:main`](https://github.com/L1Z3/wicant-i-precondition).

---

## 🧭 Executive Summary: What L1Z3 Built vs. What Was Added Here

`L1Z3/wicant-i-precondition:main` established the foundation for E-GMP battery preconditioning:
* It implemented the preconditioning Hierarchical State Machine (`precondition.c` / `hsm.c`).
* It hardcoded button sniffing for preconditioning (listening for steering-wheel Star button presses).
* It introduced cluster track popup message emulation (`track_popup.c`).
* It added a basic HTTP preconditioning start button and HV battery SoC display.

### What This Fork Adds On Top of L1Z3:
1. **"CAN Do" Reactive Automation Engine**: Transformed the device from a dedicated preconditioning tool into a generic, multi-purpose CAN automation hub (If-This-Then-That).
2. **Decoupled Precondition Triggering**: Replaced hardcoded button sniffing with event-driven CAN Do triggers, enabling any button to trigger preconditioning and freeing vehicle buttons to be repurposed.
3. **Dynamic Widget Dashboard**: Customizable dashboard grid with live CAN State Monitors, CAN Do Quick Action Buttons, 12V battery health, and HV pack thermal diagnostics.
4. **Firmware CAN State Cache (`/api/can_states`)**: Background telemetry cache serving decoded signal values to the browser with live activity pulses.
5. **Vehicle Profiles & Trim Feature Gating**: Make/Model and Trim selection (EV6, Ioniq 5/6, GV60) with automatic capability filtering (ventilated seats, heated steering, power tailgate).
6. **Dual Unit System**: Comprehensive Imperial (°F, mph, mi, psi) vs. Metric (°C, km/h, km, bar) conversions across all UI controls and conditions.
7. **Device Flash Persistence (Cross-Device Sync)**: Saves vehicle profile, unit system, custom presets, and custom widget configurations to WiCAN LittleFS flash (`/littlefs/cando.json`), while isolating card column layout in local storage.
8. **Recursive Logic & Advanced Action Blocks**: Home Assistant-style AND/OR/NOT condition nesting, conditional `If-Then-Else` actions, and multi-trigger `Choose` branching.
9. **Home Assistant MQTT Auto-Discovery & Inbound Triggers**: One-click button entity exposure with MDI icon selection.
10. **Multi-Network Wi-Fi Priority Fallback**: Storing up to 5 Wi-Fi networks with priority reordering and dynamic failover.
11. **SNTP Real-Time Clock**: Background NTP sync and 1-click browser time sync.
12. **Sniffer Guard (Capture Mode)**: Auto-pauses automations when SavvyCAN, SavvyLens, or Wireshark connects to port 23.
13. **Firmware Crash & Persistence Fixes**: Fixed HTTP 500 on config save, stack overflow crashes, sleep mode crash, and single-AP Wi-Fi saving bugs.
14. **Gzip Web Asset Pipeline**: Minifies and compresses the 823 KB web interface down to ~96 KB (`homepage.html.gz`), preventing ESP32 partition overflows.
15. **Preset Catalogs**: Over 2,500 lines in `cando_catalog.json`.

---

## 🗺️ Architectural Delta Diagram

```
                 L1Z3 Upstream Base                         This Fork (SuperSuave)
        ┌───────────────────────────────────┐        ┌────────────────────────────────────────────────────────┐
        │  • Hardcoded Button Sniffing      │        │  • CAN Do Reactive Automation Engine (Any CAN Frame)   │
        │  • Precondition State Machine     │  ===>  │  • Decoupled Event-Driven Precondition Triggers        │
        │  • Track Popup MITM Emulation     │        │  • Firmware State Cache (/api/can_states)              │
        │  • Static Precon Web Page         │        │  • Dynamic Widget Dashboard & Quick Action Buttons     │
        │  • Browser localStorage Only      │        │  • LittleFS Flash Sync for Profiles, Presets & Widgets │
        │  • Single Wi-Fi Network           │        │  • Multi-Network Wi-Fi with Priority Fallback          │
        │  • Unminified HTML in Flash       │        │  • Gzip Minification Pipeline (823 KB -> 96 KB)        │
        └───────────────────────────────────┘        └────────────────────────────────────────────────────────┘
```

---

## 📦 Detailed Component Breakdown

### 1. 🤖 "CAN Do" Automation Engine (`autopid.c` & `autopid.h`)
* **L1Z3 Upstream**: `autopid.c` only contained standard OBD-II PID polling routines and ELM327 emulation.
* **This Fork**:
  * **Reactive Rule Engine**: Evaluates incoming CAN frames against user-defined trigger patterns with full 8-byte payload wildcards (`*`) and edge transitions (`from_payload` &rarr; `to_payload`).
  * **4 Execution Modes**: `one_shot` (auto-rearming on button release), `toggle` (with optional auto-revert timers), `continuous_hold` (re-triggering while held), and `poll_verify`.
  * **Anti-Looping Safety**: Configurable cooldowns (`cooldown_ms`), timeout resets, and verification frames.
  * **Multi-Action Dispatcher**: Injects CAN frames (custom bus, ID, payload, repeat count, inter-frame delays), triggers preconditioning, sends cluster OSD popups, or executes HTTP webhooks.
  * **Rule Dry-Run Endpoint (`/test_cando_rule`)**: Simulates rule execution directly from the web interface for safe testing.
  * **Boot Engine Auto-Load**: User rules are parsed from LittleFS flash into RAM on device startup across all protocol modes (`SLCAN`, `SAVVYCAN`, `REALDASH`, `ELM327`, `AUTO_PID`).

---

### 2. ⚡ Preconditioning Decoupling (`precondition.c` & `precondition.h`)
* **L1Z3 Upstream**: Preconditioning listened directly to steering wheel button frames on the CAN bus, hardcoding which button activated heating and requiring a firmware rebuild to re-map.
* **This Fork**:
  * **Decoupled Button Sniffing**: Button sniffing in `precondition_init()` is set to `BUTTON_DISABLED` by default, delegating trigger management entirely to the CAN Do engine.
  * **Arbitrary Button Assignment**: Any vehicle button (steering wheel Star, Voice button, cluster button, or OBD-II command) can trigger preconditioning.
  * **Repurposable Buttons**: Steering wheel buttons can be repurposed for other automations (e.g. garage door opening, climate preset, sport mode) without triggering preconditioning.
  * **Exposed Action Interface**: Provides `precondition_action_execute()` and `precondition_toggle_request()` for async event-driven execution.

---

### 3. 📊 Dynamic Widget Dashboard (`homepage_full.html`)
* **L1Z3 Upstream**: A static, single-purpose web page with basic precon controls and raw text fields.
* **This Fork**:
  * **Dynamic Drag & Drop Grid**: Modular dashboard cards that can be added, removed, or reordered (`▲`/`▼`) via "✏️ Customize".
  * **12V Auxiliary Battery Card**: Real-time voltage display with color-coded health badges (`Good`, `Normal`, `Low`, `Critical`).
  * **HV Traction Battery Card**: State of Charge (SoC %), cell temperatures (min/max/average), telemetry age tracking, and DC fast-charging readiness gate indicator (`Optimal > 21°C / 70°F`).
  * **CAN State Monitor Cards (`/api/can_states`)**:
    * Monitor arbitrary vehicle signals and PIDs in real time.
    * Live glowing green pulse indicator confirming active bus telemetry.
    * Stale detection badge (>30s) when telemetry is outdated.
  * **CAN Do Action Buttons Card**:
    * Dashboard quick-access buttons to run any automation rule with 1 click.
    * Custom icons, active execution spinner (`⏳ Executing...`), and success feedback (`✓ Done!`).
  * **System Status & Clock Cards**: Wi-Fi status, CAN bitrate, port type, and SNTP clock.

---

### 4. 🧠 Recursive Logic & Visual Automation Builder
* **L1Z3 Upstream**: No automation builder or logic interface.
* **This Fork**:
  * **Recursive Condition Blocks (Home Assistant Style)**:
    * Single dropdown menu offering `📄 Single Condition`, `🔵 AND Block`, `🟣 OR Block`, and `🔴 NOT Block`.
    * Supports arbitrary infinite nesting of logic groups.
    * Instant 1-click condition conversion via `🔀 Create Block ▼`.
  * **"If - Then - Else" Action Blocks**: Conditional execution within action sequences: runs `THEN` actions if conditions pass, or fallback `ELSE` actions if false.
  * **"Choose" Action Branching**: Multi-trigger decision trees routing different triggers to distinct action sequences within a single rule card, with smart suggestion banners (`💡 2 Triggers Detected`).
  * **Interactive Byte Grid Editor**: 8-byte visual bitmask matrix for viewing and editing CAN payloads with wildcards (`*`) and live hex conversion.
  * **Granular Cloning & Backup**: Clone rules, triggers, or actions with 1 click; export or restore individual rules or full suites via JSON.

---

### 5. 🚗 Vehicle Profiles & Feature Gating (`cando_catalog.json` & DBCs)
* **L1Z3 Upstream**: Generic E-GMP implementation without trim distinctions.
* **This Fork**:
  * **Curated Vehicle Profiles**: Make, Model, and Trim selectors for Kia EV6 (Light, Wind, GT-Line, GT), Hyundai Ioniq 5 (SE, SEL, Limited, N), Hyundai Ioniq 6, and Genesis GV60.
  * **Feature Capability Gating**: Automatically filters out triggers and actions if the selected trim lacks required hardware (ventilated seats, heated steering, 360 camera, power tailgate).
  * **Dual Unit System**:
    * Toggle between **Imperial** (°F, mph, mi, psi) and **Metric** (°C, km/h, km, bar).
    * Automatically scales climate target inputs (62°F–82°F vs 17.0°C–28.0°C), speed conditions, and helper labels.

---

### 6. 💾 Device Flash Persistence (Cross-Device Sync)
* **L1Z3 Upstream**: Relied entirely on client browser `localStorage`, causing settings to be lost when switching devices (e.g. from laptop to phone).
* **This Fork**:
  * **WiCAN LittleFS Flash Storage (`/littlefs/cando.json`)**:
    * Vehicle Model & Trim selection.
    * Metric vs. Imperial unit preferences.
    * Custom Presets (all user-created triggers, actions, and conditions).
    * Custom Widget Definitions (monitored PIDs in `can_state_X` and shortcut buttons in `cando_btn_X`).
  * **Client Browser Isolation (`localStorage`)**:
    * Card ordering and column layouts remain local per device so mobile single-column and desktop multi-column layouts do not interfere.
  * **Zero C Firmware Changes Needed**: Rides on the existing LittleFS `/store_cando` endpoint, which writes raw JSON and cleanly ignores non-rule keys during boot.

---

### 7. 🏠 Home Assistant Integration & Inbound MQTT (`mqtt.c`)
* **L1Z3 Upstream**: Outbound MQTT telemetry only.
* **This Fork**:
  * **Inbound MQTT Triggers**: Automations can trigger via MQTT topics (`wican/cando/trigger` or `wican/<device_id>/cando/trigger`).
  * **MQTT Auto-Discovery Buttons**: Check `☑️ Expose as Button Entity to Home Assistant` on any CAN Do rule with custom MDI icon selection (`mdi:car-defrost-rear`, `mdi:car-electric`, `mdi:fan`, `mdi:car-door`, `mdi:car-key`).
  * **Zero-YAML Setup**: WiCAN publishes standard MQTT Discovery payloads (`homeassistant/button/wican_<id>/cando_<rule>/config`) with `retain=1`.

---

### 8. 📶 Network Resilience & Multi-AP Wi-Fi (`wifi_network.c`)
* **L1Z3 Upstream**: Single Wi-Fi network configuration only.
* **This Fork**:
  * **Multi-Network Saved Table**: Configures up to 5 Wi-Fi networks (Garage, Phone Hotspot, Work).
  * **Priority Reordering**: Move networks up (`▲`) or down (`▼`) to establish connection priority.
  * **Dynamic Fallback in Firmware**: `wifi_conn_task` automatically cycles candidate networks and reconnects if the primary connection drops.
  * **Single-AP Bug Fix**: Resolved a critical bug where station configuration was completely skipped when `net_count <= 1`.

---

### 9. 🛡️ System Stability & Crash Fixes (`config_server.c`)
* **L1Z3 Upstream**: Experienced crashes under certain HTTP configuration requests.
* **This Fork**:
  * **HTTP 500 Fix on `store_config`**: Eliminated file handle leaks and filename rename collisions on LittleFS.
  * **Stack Overflow Protection**: Resolved httpd stack overflow and ADC re-initialization crashes during config updates.
  * **Dynamic Config Updates**: Applied settings updates without requiring a disruptive device reboot.
  * **Sniffer Guard (Capture Mode)**: Auto-pauses automations when SavvyCAN, SavvyLens, or Wireshark connects to port 23.
  * **SNTP Real-Time Clock (`time_sync.c`)**: Automatic NTP background sync plus 1-click browser time sync.

---

### 10. 🗜️ Gzip Web Asset Pipeline (`tools/minify_html.ps1`)
* **L1Z3 Upstream**: Embedded uncompressed HTML directly into firmware, nearing the 1,740 KB `ota_0` flash partition limit.
* **This Fork**:
  * Added PowerShell and Python build-time minifiers compressing `main/homepage_full.html` (823 KB) down to `main/homepage.html.gz` (~96 KB, **-88.3% compression**).
  * Served with `Content-Encoding: gzip`, delegating decompression to the client browser with zero ESP32 RAM overhead.

---

## 📑 Direct File Comparison Matrix: L1Z3 vs. This Fork

| File Path | Status in L1Z3 | Status in This Fork | Changes Introduced Here |
| :--- | :--- | :--- | :--- |
| [`main/autopid.c`](file:///d:/Documents/wicant-i-precondition/main/autopid.c) | Basic PID polling | **Major Rewrite** | Reactive CAN Do engine, state cache (`/api/can_states`), dry-run execution, latching, cooldown timers. |
| [`main/autopid.h`](file:///d:/Documents/wicant-i-precondition/main/autopid.h) | PID headers | **Expanded** | CAN Do rule structs, trigger/condition/action models, execution modes. |
| [`main/precondition.c`](file:///d:/Documents/wicant-i-precondition/main/precondition.c) | Hardcoded button hooks | **Decoupled** | Disabled direct button sniffing (`BUTTON_DISABLED`); exposed event action API. |
| [`main/config_server.c`](file:///d:/Documents/wicant-i-precondition/main/config_server.c) | Basic endpoints | **Enhanced** | Added `/store_cando`, `/load_cando`, `/api/can_states`, `/test_cando_rule`, gzip serving, HTTP 500 & stack overflow fixes. |
| [`main/homepage_full.html`](file:///d:/Documents/wicant-i-precondition/main/homepage_full.html) | Basic HTML form | **Overhauled** | Dynamic widget dashboard, visual CAN Do builder, vehicle profile selector, dual unit system, flash persistence. |
| [`main/homepage.html.gz`](file:///d:/Documents/wicant-i-precondition/main/homepage.html.gz) | *Not present* | **NEW** | Gzip-compressed production web asset (~96 KB). |
| [`main/cando_catalog.json`](file:///d:/Documents/wicant-i-precondition/main/cando_catalog.json) | *Not present* | **NEW** | 2,500+ lines of curated E-GMP commands, triggers, conditions, and PIDs. |
| [`main/wifi_network.c`](file:///d:/Documents/wicant-i-precondition/main/wifi_network.c) | Single-AP only | **Enhanced** | Up to 5 networks with priority fallback; fixed single-AP saving bug. |
| [`main/time_sync.c`](file:///d:/Documents/wicant-i-precondition/main/time_sync.c) | *Not present* | **NEW** | SNTP client and browser clock synchronization engine. |
| [`main/mqtt.c`](file:///d:/Documents/wicant-i-precondition/main/mqtt.c) | Basic telemetry | **Enhanced** | Inbound CAN Do trigger topics and Home Assistant MQTT auto-discovery buttons. |
| [`tools/minify_html.ps1`](file:///d:/Documents/wicant-i-precondition/tools/minify_html.ps1) | *Not present* | **NEW** | Automated HTML minification and gzip compression tool. |
