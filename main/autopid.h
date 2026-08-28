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
 * Proposed IFTTT ("If This, Then That") Engine Data Structures
 * -------------------------------------------------------------------------- */

typedef enum {
    IFTTT_MATCH_EXACT,      /* Match exact payload bytes */
    IFTTT_MATCH_MASK,       /* Match using data bitmask and expected byte values */
    IFTTT_MATCH_EXPRESSION, /* Evaluate math expression on payload (e.g. [B0:B1] > 3000) */
} ifttt_match_type_t;

typedef struct {
    uint8_t bus;            /* CAN_BUS_0 or CAN_BUS_1 */
    uint32_t can_id;        /* CAN ID (11-bit standard or 29-bit extended) */
    bool is_ext;            /* true if 29-bit extended ID */
    ifttt_match_type_t match_type;
    uint8_t match_data[8];  /* Expected byte pattern */
    uint8_t match_mask[8];  /* Bitmask for matching */
    uint8_t data_len;       /* Length of expected match payload */
    char *expression;       /* Optional trigger math expression string */
    uint32_t cooldown_ms;   /* Minimum time (ms) between triggers */
    int64_t last_triggered_us; /* Timestamp of last execution */
} ifttt_trigger_t;

typedef struct {
    uint8_t target_bus;     /* Target bus to play CAN frame (CAN_BUS_0 or CAN_BUS_1) */
    uint32_t tx_can_id;     /* Response CAN ID */
    bool is_ext;            /* Extended 29-bit CAN ID flag */
    uint8_t tx_data[8];     /* Payload bytes to play */
    uint8_t tx_len;         /* Payload byte length (0-8) */
    uint32_t delay_ms;      /* Delay before transmitting frame */
    uint8_t repeat_count;   /* Number of frame retransmissions */
    uint32_t repeat_interval_ms; /* Interval between repeat transmissions */
    char *mqtt_topic;       /* Optional MQTT topic for notification alert */
} ifttt_action_t;

typedef struct {
    char *name;             /* Rule descriptive name */
    bool enabled;           /* Rule active flag */
    ifttt_trigger_t trigger;/* Trigger condition ("IF THIS") */
    ifttt_action_t action;  /* Response action ("THEN THAT") */
} ifttt_rule_t;

typedef struct {
    ifttt_rule_t *rules;
    uint32_t rule_count;
    SemaphoreHandle_t mutex;
} ifttt_rule_set_t;

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
