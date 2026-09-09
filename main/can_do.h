// "CAN Do" Reactive Vehicle Automation Engine Header

#ifndef CAN_DO_H
#define CAN_DO_H

#include "cJSON.h"
#include "driver/twai.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// --------------------------------------------------------------------------
// CAN Do Engine Enumerations & Types
// --------------------------------------------------------------------------

typedef enum {
  CAN_DO_TRIG_CAN_MESSAGE = 0,  // Triggered by incoming CAN frame
  CAN_DO_TRIG_CLOCK = 1,        // Triggered by clock time (HH:MM:SS)
  CAN_DO_TRIG_INTERVAL = 2,     // Triggered by repeating timer interval
  CAN_DO_TRIG_VOLTAGE = 3,      // Triggered by battery voltage threshold
  CAN_DO_TRIG_MQTT_COMMAND = 4, // Triggered by incoming MQTT/HA command
} can_do_trigger_source_t;

typedef enum {
  CAN_DO_MATCH_EXACT = 0, // Match exact payload bytes
  CAN_DO_MATCH_MASK = 1,  // Match using data bitmask and expected byte values
  CAN_DO_MATCH_EXPRESSION = 2, // Evaluate math expression on payload
} can_do_match_type_t;

typedef enum {
  CAN_DO_EXEC_CONTINUOUS = 0, // Fire every time trigger condition is true
  CAN_DO_EXEC_ONE_SHOT = 1,   // Fire once when true; latch until explicit reset
  CAN_DO_EXEC_ON_CHANGE = 2,  // Fire only when payload/evaluated value changes
  CAN_DO_EXEC_POLL_VERIFY =
      3, // Fire action and wait for confirmation status CAN message
  CAN_DO_EXEC_TOGGLE = 4, // Flip-flop toggle mode
} can_do_exec_mode_t;

typedef struct {
  char id[32]; // Optional Trigger ID
  can_do_trigger_source_t source;
  uint8_t bus;     // CAN_BUS_0 or CAN_BUS_1
  uint32_t can_id; // CAN ID (11-bit standard or 29-bit extended)
  bool is_ext;     // true if 29-bit extended ID
  can_do_match_type_t match_type;
  can_do_exec_mode_t exec_mode;
  uint8_t match_data[8]; // Expected byte pattern (To payload)
  uint8_t match_mask[8]; // Bitmask for matching
  uint8_t data_len;      // Length of expected match payload
  uint8_t from_data[8];  // Expected previous byte pattern (From payload)
  uint8_t from_mask[8];  // Bitmask for From payload
  uint8_t from_len;      // Length of From payload
  bool has_from;         // true if From payload filter is active
  bool has_to;           // true if To payload filter is active
  bool any_change;       // true if any payload change triggers
  bool has_last_payload; // true once first frame has been tracked

  // Hold Duration & Continuous Assertion
  uint32_t for_ms;           // Must remain continuously active before firing
  int64_t asserted_since_us; // Timestamp when condition was first asserted
  bool hold_fired;           // Flag indicating hold threshold has fired

  // MQTT / Home Assistant Command Fields
  char mqtt_topic[64];
  char mqtt_payload[64];

  // Verification & Polling Confirmation
  uint32_t verify_can_id; // Expected status CAN ID after action
  uint8_t verify_data[8]; // Expected confirmation payload
  uint8_t verify_mask[8]; // Mask for confirmation payload
  uint8_t verify_len;     // Length of verification payload pattern
  bool has_verify;        // true if verification payload pattern active
  bool pending_verify; // true when action sent and waiting for verification CAN
                       // frame

  // Reset conditions
  uint32_t reset_can_id;     // Reset CAN ID to re-arm one-shot latch
  uint32_t timeout_reset_ms; // Auto re-arm latch if trigger absent for N ms

  // Multi-press / Double-press Tracking
  uint8_t click_count_target; // Number of clicks required to trigger
  uint32_t click_window_ms;   // Max time gap between clicks
  uint8_t current_clicks;     // Number of clicks registered in current window
  int64_t last_click_us;      // Timestamp of last click release
  bool was_pressed;           // Tracks leading press edge before release

  // Combo / Held State Tracking
  bool is_held; // Active asserted state on CAN bus

  // Execution state tracking
  bool triggered_latched;    // Latched state flag for one-shot mode
  uint8_t last_payload[8];   // Previous payload for ON_CHANGE mode
  uint32_t cooldown_ms;      // Minimum time (ms) between triggers
  int64_t last_triggered_us; // Timestamp of last execution

} can_do_trigger_t;

typedef enum {
  CAN_DO_ROLL_NONE = 0,
  CAN_DO_ROLL_SEQ3,      // Cycles 0x0F -> 0x1F -> 0x2F
  CAN_DO_ROLL_BYTE_INC,  // Cycles 0x00 -> 0xFF
  CAN_DO_ROLL_NIBBLE_INC // Cycles low nibble 0x0 -> 0xF
} can_do_roll_mode_t;

typedef struct {
  uint8_t target_bus;   // Target bus to play CAN frame
  uint32_t tx_can_id;   // Response CAN ID
  bool is_ext;          // Extended 29-bit CAN ID flag
  uint8_t tx_data[8];   // Payload bytes to play
  uint8_t tx_len;       // Payload byte length (0-8)
  uint32_t delay_ms;    // Delay before transmitting next frame
  int8_t roll_byte_idx; // -1 if no rolling byte, or 0..7 index
  can_do_roll_mode_t roll_mode;
  uint8_t roll_counter; // Dynamic sequence counter state
} can_do_sequence_step_t;

typedef enum {
  CAN_DO_ACT_CAN_TX = 0,
  CAN_DO_ACT_POPUP,
  CAN_DO_ACT_PRECONDITION,
  CAN_DO_ACT_CLIMATE_TARGET,
  CAN_DO_ACT_DELAY,
  CAN_DO_ACT_MQTT,
  CAN_DO_ACT_WEBHOOK
} can_do_action_type_t;

typedef struct {
  can_do_action_type_t type;
  char trigger_id[32];          // Only execute if triggered by this trigger_id
  char *popup_message;          // Optional dashboard track popup text
  char precon_mode[16];         // "persistent", "continuous", "once", "cancel"
  char precon_press[16];        // "short", "long"
  float target_temp_c;          // Target temperature in Celsius
  char climate_zone[16];        // "driver" or "passenger"
  bool climate_sync_on;         // Optional: Enforce SYNC Mode ON
  bool climate_driver_only;     // Optional: Enforce Driver Only Mode
  bool climate_passenger_aware; // Optional: Auto-detect passenger seatbelt /
                                // occupant status
  can_do_sequence_step_t *steps;
  uint8_t step_count;
  uint32_t delay_ms; // Duration in ms for CAN_DO_ACT_DELAY step
} can_do_action_t;

typedef struct {
  char *name;                   // Rule descriptive name
  bool enabled;                 // Rule active flag
  bool ha_expose;               // Expose as Home Assistant Button entity
  char ha_icon[32];             // Optional MDI Icon
  uint32_t exec_count;          // Number of times this rule has fired
  int64_t last_exec_us;         // Timestamp of last execution
  can_do_exec_mode_t exec_mode; // Rule execution mode

  // Stateful Toggle & Cancellation Tracking
  bool is_active_state;     // Toggled ON (true) or OFF (false)
  uint32_t auto_revert_sec; // Auto revert to OFF after N seconds
  int64_t active_since_us;  // Timestamp when rule was toggled ON

  bool trigger_combine_all;   // false = ANY trigger (OR), true = ALL triggers
                              // (AND)
  can_do_trigger_t *triggers; // Array of trigger definitions
  uint8_t trigger_count;

  // Primary / ON Actions
  can_do_action_t *actions; // Array of action definitions
  uint8_t action_count;

  // OFF / Cancel Actions
  can_do_action_t *off_actions; // Array of OFF action definitions
  uint8_t off_action_count;

} can_do_rule_t;

typedef enum {
  CAN_DO_CAPTURE_AUTO = 0,
  CAN_DO_CAPTURE_ALWAYS_PAUSED = 1,
  CAN_DO_CAPTURE_DISABLED = 2
} can_do_capture_mode_t;

typedef struct {
  can_do_rule_t *rules;
  uint32_t rule_count;
  can_do_capture_mode_t capture_mode;
  bool reverse_engineering_mode;
  SemaphoreHandle_t mutex;
} can_do_rule_set_t;

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------
void can_do_init(const char *device_id_str);
void can_do_process_rx_frame(const twai_message_t *msg, uint8_t bus);
void can_do_process_timer_tick(void);
void can_do_process_mqtt_trigger(const char *topic, const char *payload);
void can_do_publish_ha_discovery(void);
void can_do_unpublish_ha_rule(const char *rule_name);
bool can_do_evaluate_rule(can_do_rule_t *rule, const twai_message_t *msg,
                          uint8_t bus);
esp_err_t can_do_load_config(void);
esp_err_t can_do_save_config(const char *json_str);
char *can_do_get_config(void);
bool can_do_test_single_action_json(const char *json_str);
void can_do_get_stats_json(cJSON *root);
void can_do_set_capture_mode(can_do_capture_mode_t mode);
can_do_capture_mode_t can_do_get_capture_mode(void);
bool can_do_is_capture_active(void);
void can_do_set_reverse_engineering_mode(bool enable);
bool can_do_get_reverse_engineering_mode(void);

#ifdef __cplusplus
}
#endif

#endif // CAN_DO_H