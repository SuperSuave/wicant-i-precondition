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
    CANDO_TRIG_CAN_MESSAGE,  /* Triggered by incoming CAN frame */
    CANDO_TRIG_CLOCK,        /* Triggered by clock time (HH:MM:SS) */
    CANDO_TRIG_INTERVAL,     /* Triggered by repeating timer interval */
    CANDO_TRIG_VOLTAGE,      /* Triggered by battery voltage threshold */
} cando_trigger_source_t;

typedef enum {
    CANDO_MATCH_EXACT,      /* Match exact payload bytes */
    CANDO_MATCH_MASK,       /* Match using data bitmask and expected byte values */
    CANDO_MATCH_EXPRESSION, /* Evaluate math expression on payload (e.g. [B0:B1] > 3000) */
} cando_match_type_t;

typedef enum {
    CANDO_EXEC_CONTINUOUS,      /* Fire every time trigger condition is true */
    CANDO_EXEC_ONE_SHOT,        /* Fire once when true; latch until explicit reset */
    CANDO_EXEC_ON_CHANGE,       /* Fire only when payload/evaluated value changes */
    CANDO_EXEC_POLL_VERIFY,     /* Fire action and wait for confirmation status CAN message */
} cando_exec_mode_t;

typedef struct {
    cando_trigger_source_t source;
    uint8_t bus;            /* CAN_BUS_0 or CAN_BUS_1 */
    uint32_t can_id;        /* CAN ID (11-bit standard or 29-bit extended) */
    bool is_ext;            /* true if 29-bit extended ID */
    cando_match_type_t match_type;
    cando_exec_mode_t exec_mode;
    uint8_t match_data[8];  /* Expected byte pattern */
    uint8_t match_mask[8];  /* Bitmask for matching */
    uint8_t data_len;       /* Length of expected match payload */
    char *expression;       /* Optional trigger math expression string */

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

    /* Reset conditions */
    uint32_t reset_can_id;   /* Reset CAN ID to re-arm one-shot latch */
    uint32_t timeout_reset_ms; /* Auto re-arm latch if trigger absent for N ms */

    /* Execution state tracking */
    bool triggered_latched;  /* Latched state flag for one-shot mode */
    uint8_t last_payload[8]; /* Previous payload for ON_CHANGE mode */
    float last_eval_val;     /* Previous evaluated expression result */
    uint32_t cooldown_ms;    /* Minimum time (ms) between triggers */
    int64_t last_triggered_us; /* Timestamp of last execution */
} cando_trigger_t;

typedef struct {
    uint8_t target_bus;     /* Target bus to play CAN frame (CAN_BUS_0 or CAN_BUS_1) */
    uint32_t tx_can_id;     /* Response CAN ID */
    bool is_ext;            /* Extended 29-bit CAN ID flag */
    uint8_t tx_data[8];     /* Payload bytes to play */
    uint8_t tx_len;         /* Payload byte length (0-8) */
    uint32_t delay_ms;      /* Delay before transmitting frame */
} cando_sequence_step_t;

typedef struct {
    cando_sequence_step_t *steps;
    uint8_t step_count;
    char *mqtt_topic;       /* Optional MQTT topic for notification alert */
    char *webhook_url;      /* Optional Webhook URL for POST alert */
} cando_action_t;

typedef struct {
    char *name;             /* Rule descriptive name */
    bool enabled;           /* Rule active flag */
    cando_trigger_t trigger;/* Trigger condition ("IF THIS") */
    cando_action_t action;  /* Response action ("THEN THAT") */
} cando_rule_t;

typedef struct {
    cando_rule_t *rules;
    uint32_t rule_count;
    bool reverse_engineering_mode; /* Disables rule processing during high-throughput sniffing */
    SemaphoreHandle_t mutex;
} cando_rule_set_t;

void cando_process_rx_frame(const twai_message_t *msg, uint8_t bus);
void cando_process_timer_tick(void);
bool cando_evaluate_rule(cando_rule_t *rule, const twai_message_t *msg, uint8_t bus);
esp_err_t cando_save_config(const char *json_str);
char *cando_get_config(void);

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
