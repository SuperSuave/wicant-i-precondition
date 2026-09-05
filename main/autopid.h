/*
 * This file is part of the WiCAN project.
 *
 * Copyright (C) 2022  Meatpi Electronics.
 * Written by Ali Slim <ali@meatpi.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#ifndef __AUTO_PID_H__
#define __AUTO_PID_H__

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "driver/twai.h"
#include "cJSON.h"

#define BUFFER_SIZE 1024
#define QUEUE_SIZE 10


typedef struct {
    uint8_t data[BUFFER_SIZE];
    uint32_t length;
    uint8_t* priority_data;
    uint8_t  priority_data_len;
} response_t;

typedef enum
{
    SENSOR = 0,
    BINARY_SENSOR = 1,
} sensor_type_t;

////////////////

typedef enum
{
    PID_STD = 0,
    PID_CUSTOM = 1,
    PID_SPECIFIC = 2,
    PID_MAX
}pid_type_t;

typedef enum
{
    DEST_DEFAULT,
    DEST_MQTT_TOPIC,
    DEST_MQTT_WALLBOX,
    DEST_MAX
}destination_type_t;

typedef struct 
{
    char *name;
    char *expression;
    char *unit;
    char *class;
    uint32_t period; 
    float min;
    float max;
    sensor_type_t sensor_type;
    char* destination;
    destination_type_t destination_type;
    int64_t timer;
    float value;
    bool failed;
}parameter_t;

typedef struct 
{
    char* cmd;
    char* init;
    uint32_t period; 
    parameter_t *parameters;
    uint32_t parameters_count;
    pid_type_t pid_type;
    char* rxheader;
}pid_data2_t;

typedef struct 
{
    pid_data2_t *pids;
    uint32_t pid_count;
    char* custom_init;
    char* standard_init;
    char* specific_init;
    char* selected_car_model;
    char* grouping;
    char* autopid_polling;
    char* webhook_data_mode; // "full" or "diff" (defaults to "full")
    destination_type_t group_destination_type;
    char* group_destination;    //"destination"
    bool pid_std_en;
    bool pid_custom_en;
    bool pid_specific_en;
    char* std_ecu_protocol;
    char* vehicle_model;
    bool ha_discovery_en;
    uint32_t cycle;     //To be removed when std pid gets its own period
    SemaphoreHandle_t mutex;
}all_pids_t;


typedef struct{
    char* name;
    float value;
    sensor_type_t sensor_type; 
}autopid_value_t;

/* --------------------------------------------------------------------------
 * "CAN Do" Automation Engine Data Structures
 * -------------------------------------------------------------------------- */

typedef enum {
    CANDO_TRIG_CAN_MESSAGE = 0, /* Triggered by incoming CAN frame */
    CANDO_TRIG_CLOCK = 1,       /* Triggered by clock time (HH:MM:SS) */
    CANDO_TRIG_INTERVAL = 2,    /* Triggered by repeating timer interval */
    CANDO_TRIG_VOLTAGE = 3,     /* Triggered by battery voltage threshold */
    CANDO_TRIG_MQTT_COMMAND = 4,/* Triggered by incoming MQTT/HA command */
} cando_trigger_source_t;

typedef enum {
    CANDO_MATCH_EXACT = 0,     /* Match exact payload bytes */
    CANDO_MATCH_MASK = 1,      /* Match using data bitmask and expected byte values */
    CANDO_MATCH_EXPRESSION = 2,/* Evaluate math expression on payload (e.g. [B0:B1] > 3000) */
} cando_match_type_t;

typedef enum {
    CANDO_EXEC_CONTINUOUS = 0,     /* Fire every time trigger condition is true */
    CANDO_EXEC_ONE_SHOT = 1,       /* Fire once when true; latch until explicit reset */
    CANDO_EXEC_ON_CHANGE = 2,      /* Fire only when payload/evaluated value changes */
    CANDO_EXEC_POLL_VERIFY = 3,    /* Fire action and wait for confirmation status CAN message */
    CANDO_EXEC_TOGGLE = 4,         /* Flip-flop toggle mode (Press to Start ON actions, Press to Cancel OFF actions) */
} cando_exec_mode_t;

typedef struct {
    char id[32];            /* Optional Trigger ID (e.g. "lock_btn", "climate_start") */
    cando_trigger_source_t source;
    uint8_t bus;            /* CAN_BUS_0 or CAN_BUS_1 */
    uint32_t can_id;        /* CAN ID (11-bit standard or 29-bit extended) */
    bool is_ext;            /* true if 29-bit extended ID */
    cando_match_type_t match_type;
    cando_exec_mode_t exec_mode;
    uint8_t match_data[8];  /* Expected byte pattern (To / current payload) */
    uint8_t match_mask[8];  /* Bitmask for matching */
    uint8_t data_len;       /* Length of expected match payload */
    uint8_t from_data[8];   /* Expected previous byte pattern (From payload) */
    uint8_t from_mask[8];   /* Bitmask for From payload */
    uint8_t from_len;       /* Length of From payload */
    bool has_from;          /* true if From payload filter is active */
    bool has_to;            /* true if To payload filter is active */
    bool any_change;        /* true if any payload change triggers */
    bool has_last_payload;  /* true once first frame has been tracked */
    char *expression;       /* Optional trigger math expression string */

    /* Hold Duration & Continuous Assertion */
    uint32_t for_ms;        /* Must remain continuously active for this duration before firing (0 = instant) */
    int64_t asserted_since_us; /* Timestamp when condition was first asserted (0 = not asserted) */
    bool hold_fired;        /* Flag indicating hold threshold has fired for current continuous assertion */

    /* MQTT / Home Assistant Command Fields */
    char mqtt_topic[64];
    char mqtt_payload[64];

    /* Clock & Calendar Fields */
    uint8_t hour;           /* 0-23 */
    uint8_t minute;         /* 0-59 */
    uint8_t second;         /* 0-59 */
    uint8_t days_of_week;   /* Bitmask: Bit 0=Sun, 1=Mon, ..., 6=Sat */
    uint32_t interval_sec;  /* Period for interval timers */

    /* Battery Voltage Fields */
    float voltage_threshold;
    bool voltage_above;     /* true if trigger when > threshold, false if < threshold */

    /* Verification & Polling Confirmation */
    uint32_t verify_can_id;  /* Expected status CAN ID after action */
    uint8_t verify_data[8];  /* Expected confirmation payload */
    uint8_t verify_mask[8];  /* Mask for confirmation payload */
    uint8_t verify_len;      /* Length of verification payload pattern */
    bool has_verify;         /* true if verification payload pattern active */
    bool pending_verify;     /* true when action sent and waiting for verification CAN frame */

    /* Reset conditions */
    uint32_t reset_can_id;   /* Reset CAN ID to re-arm one-shot latch */
    uint32_t timeout_reset_ms; /* Auto re-arm latch if trigger absent for N ms */

    /* Multi-press / Double-press Tracking */
    uint8_t click_count_target;  /* Number of clicks required to trigger (1 = single press, 2 = double press, etc.) */
    uint32_t click_window_ms;    /* Max time gap between clicks (default 450ms) */
    uint8_t current_clicks;      /* Number of clicks registered in current window */
    int64_t last_click_us;       /* Timestamp of last click release */
    bool was_pressed;            /* Tracks leading press edge before release */

    /* Combo / Held State Tracking */
    bool is_held;                /* Active asserted state on CAN bus */

    /* Execution state tracking */
    bool triggered_latched;  /* Latched state flag for one-shot mode */
    uint8_t last_payload[8]; /* Previous payload for ON_CHANGE mode */
    float last_eval_val;     /* Previous evaluated expression result */
    uint32_t cooldown_ms;    /* Minimum time (ms) between triggers */
    int64_t last_triggered_us; /* Timestamp of last execution */
} cando_trigger_t;

typedef enum {
    CANDO_ROLL_NONE = 0,
    CANDO_ROLL_SEQ3,        /* Cycles 0x0F -> 0x1F -> 0x2F (e.g. E-GMP 0x2CF Climate Temp) */
    CANDO_ROLL_BYTE_INC,    /* Cycles 0x00 -> 0xFF */
    CANDO_ROLL_NIBBLE_INC   /* Cycles low nibble 0x0 -> 0xF */
} cando_roll_mode_t;

typedef struct {
    uint8_t target_bus;     /* Target bus to play CAN frame (CAN_BUS_0 or CAN_BUS_1) */
    uint32_t tx_can_id;     /* Response CAN ID */
    bool is_ext;            /* Extended 29-bit CAN ID flag */
    uint8_t tx_data[8];     /* Payload bytes to play */
    uint8_t tx_len;         /* Payload byte length (0-8) */
    uint32_t delay_ms;      /* Delay before transmitting frame */
    int8_t roll_byte_idx;   /* -1 if no rolling byte, or 0..7 index of rolling byte */
    cando_roll_mode_t roll_mode;
    uint8_t roll_counter;   /* Dynamic sequence counter state */
} cando_sequence_step_t;

typedef enum {
    CANDO_ACT_CAN_TX = 0,
    CANDO_ACT_POPUP,
    CANDO_ACT_PRECONDITION,
    CANDO_ACT_CLIMATE_TARGET,
    CANDO_ACT_DELAY,
    CANDO_ACT_MQTT,
    CANDO_ACT_WEBHOOK
} cando_action_type_t;

typedef struct {
    cando_action_type_t type;
    char trigger_id[32];    /* Only execute if triggered by this trigger_id (empty/NULL = any) */
    char *popup_message;    /* Optional dashboard track popup text (via track_popup_show) */
    char precon_mode[16];   /* "persistent", "continuous", "once", "cancel" */
    char precon_press[16];  /* "short", "long" */
    float target_temp_c;    /* Target temperature in Celsius (e.g. 21.0) */
    char climate_zone[16];  /* "driver" or "passenger" */
    bool climate_sync_on;   /* Optional: Enforce SYNC Mode ON (0x4A0) */
    bool climate_driver_only;/* Optional: Enforce Driver Only Mode (0x41D) */
    cando_sequence_step_t *steps;
    uint8_t step_count;
    char *mqtt_topic;       /* Optional MQTT topic for notification alert */
    char *webhook_url;      /* Optional Webhook URL for POST alert */
} cando_action_t;

typedef struct {
    char *name;             /* Rule descriptive name */
    bool enabled;           /* Rule active flag */
    bool ha_expose;         /* Expose as Home Assistant Button entity via MQTT Auto-Discovery */
    char ha_icon[32];       /* Optional MDI Icon (e.g. "mdi:car-defrost-rear") */
    uint32_t exec_count;    /* Number of times this rule has fired */
    int64_t last_exec_us;   /* Timestamp of last execution (esp_timer_get_time) */
    cando_exec_mode_t exec_mode; /* Rule execution mode (e.g. CANDO_EXEC_TOGGLE) */

    /* Stateful Toggle & Cancellation Tracking */
    bool is_active_state;   /* Toggled ON (true) or OFF (false) */
    uint32_t auto_revert_sec; /* Auto revert to OFF after N seconds (0 = disabled) */
    int64_t active_since_us; /* Timestamp when rule was toggled ON */

    bool trigger_combine_all;  /* false = ANY trigger (OR), true = ALL triggers simultaneously (AND combo) */
    cando_trigger_t *triggers; /* Multiple trigger definitions (OR/AND) */
    uint8_t trigger_count;
    cando_trigger_t trigger;/* Primary trigger */

    /* Primary / ON Actions */
    cando_action_t *actions;/* Multiple action blocks (Choose / Branching) */
    uint8_t action_count;
    cando_action_t action;  /* Primary action */

    /* OFF / Cancel Actions (for CANDO_EXEC_TOGGLE mode) */
    cando_action_t *off_actions;
    uint8_t off_action_count;
    cando_action_t off_action;
} cando_rule_t;

typedef enum {
    CANDO_CAPTURE_AUTO = 0,
    CANDO_CAPTURE_ALWAYS_PAUSED = 1,
    CANDO_CAPTURE_DISABLED = 2
} cando_capture_mode_t;

typedef struct 
{
    cando_rule_t *rules;
    uint32_t rule_count;
    cando_capture_mode_t capture_mode; /* Capture Mode: Auto (SavvyCAN/SavvyLens), Always Paused, Disabled */
    bool reverse_engineering_mode; /* Deprecated alias for ALWAYS_PAUSED */
    SemaphoreHandle_t mutex;
} cando_rule_set_t;

void cando_process_rx_frame(const twai_message_t *msg, uint8_t bus);
void cando_process_timer_tick(void);
void cando_process_mqtt_trigger(const char *topic, const char *payload);
void cando_publish_ha_discovery(void);
void cando_unpublish_ha_rule(const char *rule_name);
bool cando_evaluate_rule(cando_rule_t *rule, const twai_message_t *msg, uint8_t bus);
esp_err_t cando_load_config(void);
esp_err_t cando_save_config(const char *json_str);
char *cando_get_config(void);
bool cando_test_single_action_json(const char *json_str);
void cando_get_stats_json(cJSON *root);
void cando_set_capture_mode(cando_capture_mode_t mode);
cando_capture_mode_t cando_get_capture_mode(void);
bool cando_is_capture_active(void);
void cando_set_reverse_engineering_mode(bool enable);
bool cando_get_reverse_engineering_mode(void);

////////////////

// typedef struct 
// {
//     char *data;              // Pointer to a dynamically allocated string
//     SemaphoreHandle_t mutex; // Mutex to protect access to the data
// } autopid_data_t;

void autopid_parser(char* str, uint32_t len, QueueHandle_t *q);
void autopid_init(char* id);
char *autopid_data_read(void);
bool autopid_get_ecu_status(void);
char* autopid_get_config(void);
esp_err_t autopid_find_standard_pid(uint8_t protocol, char *available_pids, uint32_t available_pids_size) ;
void autopid_request_data(void);
#endif
