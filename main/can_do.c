//
// This file is part of the WiCAN project.
// "CAN Do" Reactive Vehicle Automation Engine Implementation
//

#include "can_do.h"
#include "comm_server.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <time.h>

#include "can.h"
#include "config_server.h"
#include "hw_config.h"
#include "mqtt.h"
#include "persistent_settings.h"
#include "precondition.h"
#include "sleep_mode.h"
#include "track_popup.h"

#define TAG "CAN_DO"
#define DEFAULT_CAN_DO_JSON                                                    \
  "{\"enabled\":true,\"reverse_engineering_mode\":false,\"rules\":[{\"name\":" \
  "\"E-GMP Battery "                                                           \
  "Preconditioning\",\"enabled\":true,\"trigger\":{\"id\":\"sw_star\","        \
  "\"source\":\"can_message\",\"can_id\":\"0x448\",\"bus\":0,\"exec_mode\":"   \
  "\"one_shot\",\"cooldown_ms\":500,\"from\":\"* * * * * 0*\",\"to\":\"* * * " \
  "* * "                                                                       \
  "1*\"},\"action\":{\"type\":\"precondition\",\"trigger_id\":\"sw_star\","    \
  "\"precon_mode\":\"persistent\",\"precon_press\":\"short\"}}]}"

static can_do_rule_set_t g_can_do_rules = {0};
static char g_device_id[32] = {0};

// Cache for E-GMP live cabin temperatures and seatbelt occupant status
static uint8_t g_climate_driver_raw = 0;    // 0x380 byte 3
static uint8_t g_climate_passenger_raw = 0; // 0x380 byte 4
static bool g_climate_has_reading = false;
static bool g_passenger_seatbelt_buckled =
    false; // 0x320 occupant sensor tracking

// Forward declarations
static void can_do_init_default_precondition_rule(void);
static void can_do_free_rules(void);

void can_do_init(const char *device_id_str) {
  if (device_id_str && strlen(device_id_str) > 0) {
    strncpy(g_device_id, device_id_str, sizeof(g_device_id) - 1);
  } else {
    hw_config_get_device_id(g_device_id);
  }

  if (g_can_do_rules.mutex == NULL) {
    g_can_do_rules.mutex = xSemaphoreCreateMutex();
  }

  can_do_load_config();
  ESP_LOGI(TAG, "CAN Do Engine initialized (%lu rules loaded)",
           (unsigned long)g_can_do_rules.rule_count);
}

static inline int parse_hex_nibble(char c) {
  if (c >= '0' && c <= '9')
    return c - '0';
  if (c >= 'A' && c <= 'F')
    return c - 'A' + 10;
  if (c >= 'a' && c <= 'f')
    return c - 'a' + 10;
  return -1;
}

static bool can_do_parse_payload_pattern(const char *str, uint8_t *data,
                                         uint8_t *mask, uint8_t *len,
                                         bool *has_filter) {
  if (!str || !data || !mask || !len || !has_filter)
    return false;
  memset(data, 0, 8);
  memset(mask, 0, 8);
  *len = 0;
  *has_filter = false;

  const char *p = str;
  uint8_t byte_idx = 0;

  while (*p && byte_idx < 8) {
    while (*p == ' ' || *p == '\t' || *p == ',')
      p++;
    if (!*p)
      break;

    char high_ch = *p++;
    char low_ch = (*p && *p != ' ' && *p != '\t' && *p != ',') ? *p++ : '*';

    uint8_t d_val = 0;
    uint8_t m_val = 0;

    int h = parse_hex_nibble(high_ch);
    if (h >= 0) {
      d_val |= (uint8_t)(h << 4);
      m_val |= 0xF0;
    }

    int l = parse_hex_nibble(low_ch);
    if (l >= 0) {
      d_val |= (uint8_t)(l & 0x0F);
      m_val |= 0x0F;
    }

    data[byte_idx] = d_val;
    mask[byte_idx] = m_val;
    if (m_val != 0) {
      *has_filter = true;
    }
    byte_idx++;
  }

  *len = byte_idx;
  return true;
}

static bool can_do_evaluate_trigger(can_do_trigger_t *trig,
                                    const twai_message_t *msg, uint8_t bus) {
  if (!trig)
    return false;

  if (trig->source == CAN_DO_TRIG_CAN_MESSAGE) {
    if (!msg)
      return false;
    if (trig->bus != bus)
      return false;
    if (trig->can_id != msg->identifier)
      return false;
    if (trig->is_ext != (msg->extd != 0))
      return false;

    if (trig->has_from && trig->has_last_payload) {
      for (uint8_t i = 0; i < trig->from_len; i++) {
        if (trig->from_mask[i] != 0) {
          if (i >= sizeof(trig->last_payload) ||
              (trig->last_payload[i] & trig->from_mask[i]) !=
                  (trig->from_data[i] & trig->from_mask[i])) {
            return false;
          }
        }
      }
    }

    if (trig->has_to) {
      for (uint8_t i = 0; i < trig->data_len; i++) {
        if (trig->match_mask[i] != 0) {
          if (i >= msg->data_length_code)
            return false;
          if ((msg->data[i] & trig->match_mask[i]) !=
              (trig->match_data[i] & trig->match_mask[i])) {
            return false;
          }
        }
      }
    }

    if (trig->any_change || (!trig->has_from && !trig->has_to)) {
      if (trig->has_last_payload) {
        if (memcmp(trig->last_payload, msg->data, msg->data_length_code) == 0) {
          return false;
        }
      }
    }

    return true;
  }
  return false;
}

static void can_do_format_popup_message(const char *template_str, char *out_buf,
                                        size_t out_len) {
  if (!template_str || !out_buf || out_len == 0)
    return;

  if (strchr(template_str, '{') == NULL) {
    strncpy(out_buf, template_str, out_len - 1);
    out_buf[out_len - 1] = '\0';
    return;
  }

  precondition_temperature_t temp = {0};
  bool has_temp = precondition_get_battery_temperature(&temp);
  float volt = 0.0f;
  bool has_volt = (sleep_mode_get_voltage(&volt) == 1 || volt > 0.0f);
  bool precon_active = precondition_is_active();

  time_t now = time(NULL);
  struct tm tm_info;
  bool has_time =
      (localtime_r(&now, &tm_info) != NULL && tm_info.tm_year > 120);

  const char *p = template_str;
  size_t out_idx = 0;
  out_buf[0] = '\0';

  while (*p != '\0' && out_idx < (out_len - 1)) {
    if (*p == '{') {
      const char *end = strchr(p, '}');
      if (end != NULL) {
        size_t token_len = end - p - 1;
        char token[32] = {0};
        if (token_len < sizeof(token)) {
          strncpy(token, p + 1, token_len);
          token[token_len] = '\0';

          char replacement[32] = {0};
          bool matched = false;

          if (strcasecmp(token, "battery_temp") == 0 ||
              strcasecmp(token, "battery_temp_c") == 0 ||
              strcasecmp(token, "temp") == 0) {
            matched = true;
            if (has_temp)
              snprintf(replacement, sizeof(replacement), "%d",
                       (temp.min_c + temp.max_c) / 2);
            else
              strncpy(replacement, "--", sizeof(replacement) - 1);
          } else if (strcasecmp(token, "battery_temp_f") == 0 ||
                     strcasecmp(token, "temp_f") == 0) {
            matched = true;
            if (has_temp)
              snprintf(
                  replacement, sizeof(replacement), "%d",
                  (int)roundf(((temp.min_c + temp.max_c) / 2.0f * 9.0f / 5.0f) +
                              32.0f));
            else
              strncpy(replacement, "--", sizeof(replacement) - 1);
          } else if (strcasecmp(token, "voltage") == 0 ||
                     strcasecmp(token, "battery_voltage") == 0 ||
                     strcasecmp(token, "vbatt") == 0) {
            matched = true;
            if (has_volt)
              snprintf(replacement, sizeof(replacement), "%.1f", volt);
            else
              strncpy(replacement, "--", sizeof(replacement) - 1);
          } else if (strcasecmp(token, "status") == 0 ||
                     strcasecmp(token, "precon_status") == 0) {
            matched = true;
            strncpy(replacement, precon_active ? "ON" : "OFF",
                    sizeof(replacement) - 1);
          } else if (strcasecmp(token, "time") == 0) {
            matched = true;
            if (has_time)
              snprintf(replacement, sizeof(replacement), "%02d:%02d",
                       tm_info.tm_hour, tm_info.tm_min);
            else
              strncpy(replacement, "--:--", sizeof(replacement) - 1);
          }

          if (matched) {
            size_t r_len = strlen(replacement);
            if (out_idx + r_len < out_len) {
              strcpy(&out_buf[out_idx], replacement);
              out_idx += r_len;
            }
            p = end + 1;
            continue;
          }
        }
      }
    }
    out_buf[out_idx++] = *p++;
  }
  out_buf[out_idx] = '\0';
}

static void can_do_execute_climate_target(float target_c, const char *zone,
                                          bool sync_on, bool driver_only,
                                          bool passenger_aware) {
  if (passenger_aware && !g_passenger_seatbelt_buckled) {
    driver_only = true;
  }

  if (target_c < 14.0f)
    target_c = 14.0f;
  if (target_c > 32.0f)
    target_c = 32.0f;

  bool is_passenger = (zone && strcasecmp(zone, "passenger") == 0);
  uint8_t target_raw = (uint8_t)((int)roundf((target_c - 14.0f) * 2.0f));

  if (!g_climate_has_reading) {
    vTaskDelay(pdMS_TO_TICKS(150));
  }

  uint8_t cur_raw = 14;
  if (g_climate_has_reading) {
    uint8_t cached =
        is_passenger ? g_climate_passenger_raw : g_climate_driver_raw;
    if (cached > 0 && cached <= 36)
      cur_raw = cached;
  }

  int delta = (int)target_raw - (int)cur_raw;
  if (delta != 0) {
    uint8_t cmd_byte = (delta > 0) ? (is_passenger ? 0xD0 : 0x70)
                                   : (is_passenger ? 0xE0 : 0xB0);
    int steps = (delta > 0) ? delta : -delta;
    if (steps > 28)
      steps = 28;

    for (int i = 0; i < steps; i++) {
      twai_message_t tx_msg = {
          .identifier = 0x49F,
          .extd = 0,
          .data_length_code = 8,
          .data = {cmd_byte, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}};
      can_send(CAN_BUS_0, &tx_msg, 0);
      vTaskDelay(pdMS_TO_TICKS(20));

      twai_message_t idle_msg = {
          .identifier = 0x49F,
          .extd = 0,
          .data_length_code = 8,
          .data = {0xF0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}};
      can_send(CAN_BUS_0, &idle_msg, 0);
      vTaskDelay(pdMS_TO_TICKS(60));
    }
  }

  if (sync_on && !driver_only) {
    twai_message_t sync_msg = {
        .identifier = 0x4A0,
        .extd = 0,
        .data_length_code = 8,
        .data = {0x00, 0x00, 0x00, 0x0B, 0x00, 0x00, 0x00, 0x00}};
    can_send(CAN_BUS_0, &sync_msg, 0);
    vTaskDelay(pdMS_TO_TICKS(20));

    twai_message_t sync_idle = {
        .identifier = 0x4A0,
        .extd = 0,
        .data_length_code = 8,
        .data = {0x00, 0x00, 0x00, 0x0F, 0x00, 0x00, 0x00, 0x00}};
    can_send(CAN_BUS_0, &sync_idle, 0);
  }

  if (driver_only) {
    twai_message_t drv_msg = {
        .identifier = 0x41D,
        .extd = 0,
        .data_length_code = 8,
        .data = {0x00, 0x00, 0x00, 0x00, 0x0D, 0x00, 0x00, 0x00}};
    can_send(CAN_BUS_0, &drv_msg, 0);
    vTaskDelay(pdMS_TO_TICKS(20));

    twai_message_t drv_idle = {
        .identifier = 0x41D,
        .extd = 0,
        .data_length_code = 8,
        .data = {0x00, 0x00, 0x00, 0x00, 0x0F, 0x00, 0x00, 0x00}};
    can_send(CAN_BUS_0, &drv_idle, 0);
  }
}

static void can_do_execute_action(can_do_action_t *act,
                                  const char *matched_trig_id) {
  if (!act)
    return;

  if (act->trigger_id[0] != '\0' && strcmp(act->trigger_id, "any") != 0) {
    if (!matched_trig_id || strcmp(act->trigger_id, matched_trig_id) != 0) {
      return;
    }
  }

  if (act->popup_message && act->popup_message[0] != '\0') {
    char formatted_msg[128] = {0};
    can_do_format_popup_message(act->popup_message, formatted_msg,
                                sizeof(formatted_msg));
    track_popup_show(formatted_msg);
  }

  if (act->type == CAN_DO_ACT_PRECONDITION) {
    precondition_action_execute(act->precon_mode, act->precon_press);
  }

  if (act->type == CAN_DO_ACT_CLIMATE_TARGET) {
    can_do_execute_climate_target(
        act->target_temp_c, act->climate_zone, act->climate_sync_on,
        act->climate_driver_only, act->climate_passenger_aware);
  }

  if (act->type == CAN_DO_ACT_DELAY) {
    uint32_t ms = (act->delay_ms > 0) ? act->delay_ms : 500;
    ESP_LOGI(TAG, "Executing Delay Action: pausing %lu ms", (unsigned long)ms);
    vTaskDelay(pdMS_TO_TICKS(ms));
    return;
  }

  if (act->type == CAN_DO_ACT_CAN_TX || act->type == 0) {
    for (uint8_t s = 0; s < act->step_count; s++) {
      can_do_sequence_step_t *step = &act->steps[s];
      uint8_t payload[8] = {0};
      if (step->tx_len > 0) {
        memcpy(payload, step->tx_data, step->tx_len <= 8 ? step->tx_len : 8);
      }
      if (step->roll_byte_idx >= 0 && step->roll_byte_idx < step->tx_len) {
        if (step->roll_mode == CAN_DO_ROLL_SEQ3) {
          payload[step->roll_byte_idx] =
              (uint8_t)(((step->roll_counter % 3) << 4) | 0x0F);
          step->roll_counter = (step->roll_counter + 1) % 3;
        } else if (step->roll_mode == CAN_DO_ROLL_BYTE_INC) {
          payload[step->roll_byte_idx] = step->roll_counter++;
        } else if (step->roll_mode == CAN_DO_ROLL_NIBBLE_INC) {
          payload[step->roll_byte_idx] =
              (uint8_t)((payload[step->roll_byte_idx] & 0xF0) |
                        (step->roll_counter & 0x0F));
          step->roll_counter = (step->roll_counter + 1) & 0x0F;
        }
      }
      twai_message_t tx_msg = {.identifier = step->tx_can_id,
                               .extd = step->is_ext ? 1 : 0,
                               .data_length_code = step->tx_len};
      memcpy(tx_msg.data, payload, step->tx_len <= 8 ? step->tx_len : 8);
      can_send((can_bus_t)step->target_bus, &tx_msg, 0);

      if (step->delay_ms > 0 && s < (act->step_count - 1)) {
        vTaskDelay(pdMS_TO_TICKS(step->delay_ms));
      }
    }
  }
}

static void can_do_execute_rule_actions(can_do_rule_t *rule,
                                        const char *matched_id,
                                        int64_t now_us) {
  if (!rule)
    return;

  if (rule->exec_mode == CAN_DO_EXEC_TOGGLE) {
    if (!rule->is_active_state) {
      rule->is_active_state = true;
      rule->active_since_us = now_us;
      ESP_LOGI(TAG, "Rule '%s' TOGGLED ON",
               rule->name ? rule->name : "Unnamed");

      if (rule->actions && rule->action_count > 0) {
        for (uint8_t a = 0; a < rule->action_count; a++) {
          can_do_execute_action(&rule->actions[a], matched_id);
        }
      }
    } else {
      rule->is_active_state = false;
      rule->active_since_us = 0;
      ESP_LOGI(TAG, "Rule '%s' TOGGLED OFF / CANCELLED",
               rule->name ? rule->name : "Unnamed");

      if (rule->off_actions && rule->off_action_count > 0) {
        for (uint8_t a = 0; a < rule->off_action_count; a++) {
          can_do_execute_action(&rule->off_actions[a], matched_id);
        }
      } else {
        bool has_precon = false;
        if (rule->actions && rule->action_count > 0) {
          for (uint8_t a = 0; a < rule->action_count; a++) {
            if (rule->actions[a].type == CAN_DO_ACT_PRECONDITION) {
              has_precon = true;
              break;
            }
          }
        }
        if (has_precon && precondition_is_active()) {
          precondition_action_execute("cancel", "short");
        }
      }
    }
  } else {
    if (rule->actions && rule->action_count > 0) {
      for (uint8_t a = 0; a < rule->action_count; a++) {
        can_do_execute_action(&rule->actions[a], matched_id);
      }
    }
  }
}

bool can_do_evaluate_rule(can_do_rule_t *rule, const twai_message_t *msg,
                          uint8_t bus) {
  if (!rule || !rule->enabled)
    return false;
  if (g_can_do_rules.capture_mode == CAN_DO_CAPTURE_ALWAYS_PAUSED)
    return false;

  if (rule->triggers && rule->trigger_count > 0) {
    for (uint8_t i = 0; i < rule->trigger_count; i++) {
      if (can_do_evaluate_trigger(&rule->triggers[i], msg, bus))
        return true;
    }
  }
  return false;
}

void can_do_process_rx_frame(const twai_message_t *msg, uint8_t bus) {
  if (!msg)
    return;
  if (g_can_do_rules.mutex &&
      xSemaphoreTake(g_can_do_rules.mutex, pdMS_TO_TICKS(10)) != pdTRUE) {
    return;
  }

  if (!g_can_do_rules.rules || g_can_do_rules.rule_count == 0) {
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return;
  }
  if (can_do_is_capture_active()) {
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return;
  }

  // Cache E-GMP 0x380 live cabin temperatures
  if (msg->identifier == 0x380 && msg->data_length_code >= 4) {
    g_climate_driver_raw = msg->data[3];
    if (msg->data_length_code >= 5) {
      g_climate_passenger_raw = msg->data[4];
    }
    g_climate_has_reading = true;
  }

  // Cache E-GMP 0x320 passenger seatbelt / occupant status
  if (msg->identifier == 0x320 && msg->data_length_code >= 2) {
    g_passenger_seatbelt_buckled = ((msg->data[1] & 0x04) != 0);
  }

  int64_t now_us = esp_timer_get_time();

  for (uint32_t i = 0; i < g_can_do_rules.rule_count; i++) {
    can_do_rule_t *rule = &g_can_do_rules.rules[i];
    if (!rule->enabled)
      continue;

    uint8_t t_count = rule->trigger_count;
    can_do_trigger_t *trig_list = rule->triggers;
    if (!trig_list || t_count == 0)
      continue;

    for (uint8_t t_idx = 0; t_idx < t_count; t_idx++) {
      can_do_trigger_t *trig = &trig_list[t_idx];
      if (trig->source != CAN_DO_TRIG_CAN_MESSAGE)
        continue;
      if (trig->bus != bus || trig->can_id != msg->identifier)
        continue;
      if (trig->is_ext != (msg->extd != 0))
        continue;

      if (can_do_evaluate_trigger(trig, msg, bus)) {
        trig->is_held = true;
        trig->was_pressed = true;
      } else {
        bool is_rel = false;
        if (trig->has_from) {
          bool from_matches = true;
          for (uint8_t f = 0; f < trig->from_len; f++) {
            if (trig->from_mask[f] != 0) {
              if (f >= msg->data_length_code ||
                  (msg->data[f] & trig->from_mask[f]) !=
                      (trig->from_data[f] & trig->from_mask[f])) {
                from_matches = false;
                break;
              }
            }
          }
          if (from_matches)
            is_rel = true;
        } else if (trig->has_to) {
          bool still_to = true;
          for (uint8_t t = 0; t < trig->data_len; t++) {
            if (trig->match_mask[t] != 0) {
              if (t >= msg->data_length_code ||
                  (msg->data[t] & trig->match_mask[t]) !=
                      (trig->match_data[t] & trig->match_mask[t])) {
                still_to = false;
                break;
              }
            }
          }
          if (!still_to)
            is_rel = true;
        }
        if (is_rel)
          trig->is_held = false;
      }
    }

    for (uint8_t t_idx = 0; t_idx < t_count; t_idx++) {
      can_do_trigger_t *trig = &trig_list[t_idx];
      if (trig->source != CAN_DO_TRIG_CAN_MESSAGE)
        continue;
      if (trig->bus != bus || trig->can_id != msg->identifier)
        continue;
      if (trig->is_ext != (msg->extd != 0))
        continue;

      if (trig->reset_can_id > 0 && msg->identifier == trig->reset_can_id) {
        trig->triggered_latched = false;
        trig->pending_verify = false;
        continue;
      }

      if (trig->exec_mode == CAN_DO_EXEC_POLL_VERIFY && trig->pending_verify) {
        if (trig->verify_can_id > 0 && msg->identifier == trig->verify_can_id) {
          bool verify_ok = true;
          if (trig->has_verify) {
            for (uint8_t v = 0; v < trig->verify_len; v++) {
              if (trig->verify_mask[v] != 0) {
                if (v >= msg->data_length_code ||
                    (msg->data[v] & trig->verify_mask[v]) !=
                        (trig->verify_data[v] & trig->verify_mask[v])) {
                  verify_ok = false;
                  break;
                }
              }
            }
          }
          if (verify_ok) {
            trig->pending_verify = false;
            trig->triggered_latched = true;
            trig->last_triggered_us = now_us;
          }
        }
      }

      bool payload_changed =
          !trig->has_last_payload ||
          (memcmp(trig->last_payload, msg->data, msg->data_length_code) != 0);
      bool eval_passed = can_do_evaluate_trigger(trig, msg, bus);

      if (!eval_passed) {
        bool is_release_state = false;
        if (trig->has_from) {
          bool from_matches = true;
          for (uint8_t f = 0; f < trig->from_len; f++) {
            if (trig->from_mask[f] != 0) {
              if (f >= msg->data_length_code ||
                  (msg->data[f] & trig->from_mask[f]) !=
                      (trig->from_data[f] & trig->from_mask[f])) {
                from_matches = false;
                break;
              }
            }
          }
          if (from_matches)
            is_release_state = true;
        } else if (trig->has_to) {
          bool still_to = true;
          for (uint8_t t = 0; t < trig->data_len; t++) {
            if (trig->match_mask[t] != 0) {
              if (t >= msg->data_length_code ||
                  (msg->data[t] & trig->match_mask[t]) !=
                      (trig->match_data[t] & trig->match_mask[t])) {
                still_to = false;
                break;
              }
            }
          }
          if (!still_to)
            is_release_state = true;
        }

        if (is_release_state) {
          trig->triggered_latched = false;
          trig->asserted_since_us = 0;
          trig->hold_fired = false;
          trig->is_held = false;

          if (trig->click_count_target > 1 && trig->was_pressed) {
            trig->was_pressed = false;
            uint32_t window_ms =
                (trig->click_window_ms > 0) ? trig->click_window_ms : 450;
            if (trig->current_clicks > 0 && ((now_us - trig->last_click_us) <=
                                             ((int64_t)window_ms * 1000))) {
              trig->current_clicks++;
            } else {
              trig->current_clicks = 1;
            }
            trig->last_click_us = now_us;

            if (trig->current_clicks >= trig->click_count_target) {
              trig->current_clicks = 0;

              if (rule->trigger_combine_all && t_count > 1) {
                bool others_held = true;
                for (uint8_t k = 0; k < t_count; k++) {
                  if (k == t_idx)
                    continue;
                  if (!trig_list[k].is_held) {
                    others_held = false;
                    break;
                  }
                }
                if (!others_held)
                  continue;
              }

              uint32_t cd_ms = (trig->cooldown_ms > 0) ? trig->cooldown_ms : 50;
              if (trig->last_triggered_us == 0 ||
                  ((now_us - trig->last_triggered_us) >=
                   ((int64_t)cd_ms * 1000))) {
                trig->last_triggered_us = now_us;
                rule->exec_count++;
                rule->last_exec_us = now_us;
                const char *matched_id = (trig->id[0] != '\0') ? trig->id : "";
                can_do_execute_rule_actions(rule, matched_id, now_us);
              }
            }
          }
        }
      }

      memcpy(trig->last_payload, msg->data, msg->data_length_code);
      trig->has_last_payload = true;

      if (eval_passed) {
        trig->is_held = true;
        trig->was_pressed = true;

        if (trig->click_count_target > 1)
          continue;

        if (trig->for_ms > 0) {
          if (trig->asserted_since_us == 0) {
            trig->asserted_since_us = now_us;
            continue;
          }
          int64_t elapsed_ms = (now_us - trig->asserted_since_us) / 1000;
          if (elapsed_ms < trig->for_ms)
            continue;
          if (trig->hold_fired)
            continue;
          trig->hold_fired = true;
        }

        if (rule->trigger_combine_all && t_count > 1) {
          bool all_held = true;
          for (uint8_t k = 0; k < t_count; k++) {
            if (!trig_list[k].is_held) {
              all_held = false;
              break;
            }
          }
          if (!all_held)
            continue;
        }

        uint32_t cd_ms = (trig->cooldown_ms > 0) ? trig->cooldown_ms : 50;
        if (trig->last_triggered_us > 0 &&
            ((now_us - trig->last_triggered_us) < ((int64_t)cd_ms * 1000))) {
          continue;
        }

        if (trig->exec_mode == CAN_DO_EXEC_ONE_SHOT) {
          if (trig->triggered_latched)
            continue;
          trig->triggered_latched = true;
        }

        if (trig->exec_mode == CAN_DO_EXEC_POLL_VERIFY) {
          if (trig->triggered_latched || trig->pending_verify)
            continue;
          trig->pending_verify = true;
        }

        if (trig->exec_mode == CAN_DO_EXEC_ON_CHANGE && !payload_changed) {
          continue;
        }

        trig->last_triggered_us = now_us;
        rule->exec_count++;
        rule->last_exec_us = now_us;

        if (rule->trigger_combine_all && t_count > 1) {
          for (uint8_t k = 0; k < t_count; k++) {
            trig_list[k].last_triggered_us = now_us;
            if (trig_list[k].exec_mode == CAN_DO_EXEC_ONE_SHOT)
              trig_list[k].triggered_latched = true;
          }
        }

        const char *matched_id = (trig->id[0] != '\0') ? trig->id : "";
        can_do_execute_rule_actions(rule, matched_id, now_us);

        if (rule->trigger_combine_all && t_count > 1)
          break;
      }
    }
  }

  if (g_can_do_rules.mutex)
    xSemaphoreGive(g_can_do_rules.mutex);
}

void can_do_process_mqtt_trigger(const char *topic, const char *payload) {
  if (!topic)
    return;

  if (g_can_do_rules.mutex &&
      xSemaphoreTake(g_can_do_rules.mutex, pdMS_TO_TICKS(10)) != pdTRUE) {
    return;
  }

  if (!g_can_do_rules.rules || g_can_do_rules.rule_count == 0) {
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return;
  }
  if (can_do_is_capture_active()) {
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return;
  }

  int64_t now_us = esp_timer_get_time();

  for (uint32_t i = 0; i < g_can_do_rules.rule_count; i++) {
    can_do_rule_t *rule = &g_can_do_rules.rules[i];
    if (!rule->enabled)
      continue;

    uint8_t t_count = rule->trigger_count;
    can_do_trigger_t *trig_list = rule->triggers;
    if (!trig_list || t_count == 0)
      continue;

    for (uint8_t t_idx = 0; t_idx < t_count; t_idx++) {
      can_do_trigger_t *trig = &trig_list[t_idx];
      if (trig->source != CAN_DO_TRIG_MQTT_COMMAND)
        continue;

      if (trig->mqtt_topic[0] != '\0' && strcmp(trig->mqtt_topic, "#") != 0 &&
          strcmp(trig->mqtt_topic, "*") != 0) {
        if (strstr(topic, trig->mqtt_topic) == NULL &&
            strcmp(topic, trig->mqtt_topic) != 0)
          continue;
      }

      if (trig->mqtt_payload[0] != '\0' &&
          strcmp(trig->mqtt_payload, "*") != 0) {
        if (!payload || (strstr(payload, trig->mqtt_payload) == NULL &&
                         strcmp(payload, trig->mqtt_payload) != 0))
          continue;
      }

      uint32_t cd_ms = (trig->cooldown_ms > 0) ? trig->cooldown_ms : 50;
      if (trig->last_triggered_us > 0 &&
          (now_us - trig->last_triggered_us) < ((int64_t)cd_ms * 1000))
        continue;

      trig->last_triggered_us = now_us;
      rule->exec_count++;
      rule->last_exec_us = now_us;

      const char *matched_id = (trig->id[0] != '\0') ? trig->id : "";
      can_do_execute_rule_actions(rule, matched_id, now_us);
    }
  }

  if (g_can_do_rules.mutex)
    xSemaphoreGive(g_can_do_rules.mutex);
}

void can_do_process_timer_tick(void) {
  if (g_can_do_rules.capture_mode == CAN_DO_CAPTURE_ALWAYS_PAUSED)
    return;

  if (g_can_do_rules.mutex &&
      xSemaphoreTake(g_can_do_rules.mutex, pdMS_TO_TICKS(10)) != pdTRUE) {
    return;
  }

  if (!g_can_do_rules.rules) {
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return;
  }

  int64_t now_us = esp_timer_get_time();

  for (uint32_t i = 0; i < g_can_do_rules.rule_count; i++) {
    can_do_rule_t *rule = &g_can_do_rules.rules[i];
    if (!rule->enabled)
      continue;

    uint8_t t_count = rule->trigger_count;
    can_do_trigger_t *trig_list = rule->triggers;
    if (!trig_list || t_count == 0)
      continue;

    for (uint8_t t_idx = 0; t_idx < t_count; t_idx++) {
      can_do_trigger_t *trig = &trig_list[t_idx];

      if (trig->current_clicks > 0) {
        uint32_t w_ms =
            (trig->click_window_ms > 0) ? trig->click_window_ms : 450;
        if ((now_us - trig->last_click_us) > ((int64_t)w_ms * 1000)) {
          trig->current_clicks = 0;
        }
      }

      if (trig->triggered_latched && trig->timeout_reset_ms > 0) {
        if ((now_us - trig->last_triggered_us) >
            ((int64_t)trig->timeout_reset_ms * 1000)) {
          trig->triggered_latched = false;
        }
      }

      if (trig->exec_mode == CAN_DO_EXEC_POLL_VERIFY && trig->pending_verify) {
        uint32_t v_timeout =
            (trig->timeout_reset_ms > 0) ? trig->timeout_reset_ms : 3000;
        if ((now_us - trig->last_triggered_us) > ((int64_t)v_timeout * 1000)) {
          trig->pending_verify = false;
        }
      }
    }

    if (rule->exec_mode == CAN_DO_EXEC_TOGGLE && rule->is_active_state &&
        rule->auto_revert_sec > 0) {
      if (rule->active_since_us > 0 &&
          (now_us - rule->active_since_us) >=
              ((int64_t)rule->auto_revert_sec * 1000000LL)) {
        can_do_execute_rule_actions(rule, "auto_revert", now_us);
      }
    }
  }

  if (g_can_do_rules.mutex)
    xSemaphoreGive(g_can_do_rules.mutex);
}

static void can_do_parse_single_trigger(cJSON *r, cJSON *trig_obj,
                                        can_do_trigger_t *trig) {
  memset(trig, 0, sizeof(can_do_trigger_t));
  trig->source = CAN_DO_TRIG_CAN_MESSAGE;
  trig->exec_mode = CAN_DO_EXEC_ON_CHANGE;
  trig->cooldown_ms = 500;
  trig->timeout_reset_ms = 2000;
  trig->click_count_target = 1;
  trig->click_window_ms = 450;

  cJSON *cc = trig_obj ? cJSON_GetObjectItem(trig_obj, "click_count")
                       : cJSON_GetObjectItem(r, "click_count");
  if (!cc)
    cc = trig_obj ? cJSON_GetObjectItem(trig_obj, "press_count")
                  : cJSON_GetObjectItem(r, "press_count");
  if (cc && cJSON_IsNumber(cc) && cc->valueint >= 1)
    trig->click_count_target = (uint8_t)cc->valueint;

  cJSON *cw = trig_obj ? cJSON_GetObjectItem(trig_obj, "click_window_ms")
                       : cJSON_GetObjectItem(r, "click_window_ms");
  if (cw && cJSON_IsNumber(cw) && cw->valueint > 0)
    trig->click_window_ms = (uint32_t)cw->valueint;

  cJSON *tid = trig_obj ? cJSON_GetObjectItem(trig_obj, "id") : NULL;
  if (tid && tid->valuestring)
    strncpy(trig->id, tid->valuestring, sizeof(trig->id) - 1);

  cJSON *em = trig_obj ? cJSON_GetObjectItem(trig_obj, "exec_mode")
                       : cJSON_GetObjectItem(r, "exec_mode");
  if (em && em->valuestring) {
    if (strcmp(em->valuestring, "one_shot") == 0)
      trig->exec_mode = CAN_DO_EXEC_ONE_SHOT;
    else if (strcmp(em->valuestring, "on_change") == 0)
      trig->exec_mode = CAN_DO_EXEC_ON_CHANGE;
    else if (strcmp(em->valuestring, "poll_verify") == 0)
      trig->exec_mode = CAN_DO_EXEC_POLL_VERIFY;
    else if (strcmp(em->valuestring, "continuous") == 0)
      trig->exec_mode = CAN_DO_EXEC_CONTINUOUS;
    else if (strcmp(em->valuestring, "toggle") == 0)
      trig->exec_mode = CAN_DO_EXEC_TOGGLE;
  }

  cJSON *f_ms = trig_obj ? cJSON_GetObjectItem(trig_obj, "for_ms") : NULL;
  cJSON *f_sec = trig_obj ? cJSON_GetObjectItem(trig_obj, "for_sec") : NULL;
  if (f_ms && cJSON_IsNumber(f_ms))
    trig->for_ms = (uint32_t)f_ms->valueint;
  else if (f_sec && cJSON_IsNumber(f_sec))
    trig->for_ms = (uint32_t)roundf(f_sec->valuedouble * 1000.0f);

  cJSON *cd = trig_obj ? cJSON_GetObjectItem(trig_obj, "cooldown_ms")
                       : cJSON_GetObjectItem(r, "cooldown_ms");
  if (cd && cJSON_IsNumber(cd))
    trig->cooldown_ms = (uint32_t)cd->valueint;

  cJSON *t_reset = trig_obj ? cJSON_GetObjectItem(trig_obj, "timeout_reset_ms")
                            : cJSON_GetObjectItem(r, "timeout_reset_ms");
  if (t_reset && cJSON_IsNumber(t_reset))
    trig->timeout_reset_ms = (uint32_t)t_reset->valueint;

  cJSON *rcid = trig_obj ? cJSON_GetObjectItem(trig_obj, "reset_can_id")
                         : cJSON_GetObjectItem(r, "reset_can_id");
  if (rcid && rcid->valuestring && strlen(rcid->valuestring) > 0)
    trig->reset_can_id = strtoul(rcid->valuestring, NULL, 0);

  cJSON *vcid = trig_obj ? cJSON_GetObjectItem(trig_obj, "verify_can_id")
                         : cJSON_GetObjectItem(r, "verify_can_id");
  if (vcid && vcid->valuestring && strlen(vcid->valuestring) > 0)
    trig->verify_can_id = strtoul(vcid->valuestring, NULL, 0);

  cJSON *vp = trig_obj ? cJSON_GetObjectItem(trig_obj, "verify_payload")
                       : cJSON_GetObjectItem(r, "verify_payload");
  if (vp && vp->valuestring && strlen(vp->valuestring) > 0) {
    can_do_parse_payload_pattern(vp->valuestring, trig->verify_data,
                                 trig->verify_mask, &trig->verify_len,
                                 &trig->has_verify);
  }

  cJSON *cid = trig_obj ? cJSON_GetObjectItem(trig_obj, "can_id")
                        : cJSON_GetObjectItem(r, "can_id");
  cJSON *bus_item = trig_obj ? cJSON_GetObjectItem(trig_obj, "bus")
                             : cJSON_GetObjectItem(r, "bus");
  cJSON *from_p = trig_obj ? cJSON_GetObjectItem(trig_obj, "from_payload")
                           : cJSON_GetObjectItem(r, "from_payload");
  cJSON *to_p = trig_obj ? cJSON_GetObjectItem(trig_obj, "to_payload") : NULL;
  if (!to_p && trig_obj)
    to_p = cJSON_GetObjectItem(trig_obj, "match_payload");
  if (!to_p)
    to_p = cJSON_GetObjectItem(r, "match_payload");

  if (cid && cid->valuestring && strlen(cid->valuestring) > 0) {
    trig->can_id = strtoul(cid->valuestring, NULL, 0);
    trig->is_ext = (trig->can_id > 0x7FF);
  }
  if (bus_item && cJSON_IsNumber(bus_item))
    trig->bus = (uint8_t)bus_item->valueint;

  if (from_p && from_p->valuestring && strlen(from_p->valuestring) > 0) {
    can_do_parse_payload_pattern(from_p->valuestring, trig->from_data,
                                 trig->from_mask, &trig->from_len,
                                 &trig->has_from);
  }

  if (to_p && to_p->valuestring && strlen(to_p->valuestring) > 0) {
    trig->match_type = CAN_DO_MATCH_MASK;
    can_do_parse_payload_pattern(to_p->valuestring, trig->match_data,
                                 trig->match_mask, &trig->data_len,
                                 &trig->has_to);
  }

  cJSON *src = trig_obj ? cJSON_GetObjectItem(trig_obj, "source")
                        : cJSON_GetObjectItem(r, "source");
  if (src && src->valuestring) {
    if (strcmp(src->valuestring, "ha_mqtt") == 0 ||
        strcmp(src->valuestring, "mqtt_cmd") == 0 ||
        strcmp(src->valuestring, "mqtt") == 0) {
      trig->source = CAN_DO_TRIG_MQTT_COMMAND;
    } else {
      trig->source = CAN_DO_TRIG_CAN_MESSAGE;
    }
  }

  cJSON *m_topic = trig_obj ? cJSON_GetObjectItem(trig_obj, "mqtt_topic")
                            : cJSON_GetObjectItem(r, "mqtt_topic");
  if (m_topic && m_topic->valuestring)
    strncpy(trig->mqtt_topic, m_topic->valuestring,
            sizeof(trig->mqtt_topic) - 1);

  cJSON *m_payload = trig_obj ? cJSON_GetObjectItem(trig_obj, "mqtt_payload")
                              : cJSON_GetObjectItem(r, "mqtt_payload");
  if (m_payload && m_payload->valuestring)
    strncpy(trig->mqtt_payload, m_payload->valuestring,
            sizeof(trig->mqtt_payload) - 1);

  if (!trig->has_from && !trig->has_to)
    trig->any_change = true;
}

static void can_do_parse_step_payload(const char *payload_str,
                                      can_do_sequence_step_t *step) {
  if (!step)
    return;
  step->roll_byte_idx = -1;
  step->roll_mode = CAN_DO_ROLL_NONE;
  step->roll_counter = 0;
  step->tx_len = 0;
  memset(step->tx_data, 0, sizeof(step->tx_data));

  if (!payload_str || payload_str[0] == '\0')
    return;

  char buf[128];
  strncpy(buf, payload_str, sizeof(buf) - 1);
  buf[sizeof(buf) - 1] = '\0';

  char *token = strtok(buf, " \t\r\n");
  uint8_t idx = 0;
  while (token != NULL && idx < 8) {
    if (strcasecmp(token, "SEQ3") == 0 || strcasecmp(token, "~3") == 0 ||
        strcasecmp(token, "SQ") == 0) {
      step->roll_byte_idx = idx;
      step->roll_mode = CAN_DO_ROLL_SEQ3;
      step->roll_counter = 0;
      step->tx_data[idx] = 0x0F;
    } else if (strcasecmp(token, "INC") == 0 ||
               strcasecmp(token, "ROLL") == 0 || strcmp(token, "++") == 0) {
      step->roll_byte_idx = idx;
      step->roll_mode = CAN_DO_ROLL_BYTE_INC;
      step->roll_counter = 0;
      step->tx_data[idx] = 0x00;
    } else if (strcasecmp(token, "*R") == 0 || strcasecmp(token, "R*") == 0) {
      step->roll_byte_idx = idx;
      step->roll_mode = CAN_DO_ROLL_NIBBLE_INC;
      step->roll_counter = 0;
      step->tx_data[idx] = 0x00;
    } else {
      unsigned int byte_val = 0;
      if (sscanf(token, "%2x", &byte_val) == 1) {
        step->tx_data[idx] = (uint8_t)byte_val;
      } else {
        step->tx_data[idx] = 0x00;
      }
    }
    idx++;
    token = strtok(NULL, " \t\r\n");
  }
  step->tx_len = idx;
}

static void can_do_parse_single_action(cJSON *r, cJSON *act_obj,
                                       can_do_action_t *act) {
  if (!act)
    return;
  memset(act, 0, sizeof(can_do_action_t));

  cJSON *trig_id = act_obj ? cJSON_GetObjectItem(act_obj, "trigger_id")
                           : cJSON_GetObjectItem(r, "trigger_id");
  if (trig_id && trig_id->valuestring) {
    strncpy(act->trigger_id, trig_id->valuestring, sizeof(act->trigger_id) - 1);
  } else {
    strcpy(act->trigger_id, "any");
  }

  cJSON *act_type_obj = act_obj ? cJSON_GetObjectItem(act_obj, "type")
                                : cJSON_GetObjectItem(r, "action_type");
  if (act_type_obj && act_type_obj->valuestring) {
    if (strcmp(act_type_obj->valuestring, "can_tx") == 0)
      act->type = CAN_DO_ACT_CAN_TX;
    else if (strcmp(act_type_obj->valuestring, "popup") == 0)
      act->type = CAN_DO_ACT_POPUP;
    else if (strcmp(act_type_obj->valuestring, "precondition") == 0)
      act->type = CAN_DO_ACT_PRECONDITION;
    else if (strcmp(act_type_obj->valuestring, "climate_target") == 0)
      act->type = CAN_DO_ACT_CLIMATE_TARGET;
    else if (strcmp(act_type_obj->valuestring, "delay") == 0)
      act->type = CAN_DO_ACT_DELAY;
    else
      act->type = CAN_DO_ACT_CAN_TX;
  } else {
    act->type = CAN_DO_ACT_CAN_TX;
  }

  cJSON *tt = act_obj ? cJSON_GetObjectItem(act_obj, "target_temp_c")
                      : cJSON_GetObjectItem(r, "target_temp_c");
  act->target_temp_c =
      (tt && cJSON_IsNumber(tt)) ? (float)tt->valuedouble : 21.0f;

  cJSON *cz = act_obj ? cJSON_GetObjectItem(act_obj, "climate_zone")
                      : cJSON_GetObjectItem(r, "climate_zone");
  if (cz && cz->valuestring)
    strncpy(act->climate_zone, cz->valuestring, sizeof(act->climate_zone) - 1);
  else
    strcpy(act->climate_zone, "driver");

  cJSON *sync_on_obj = act_obj ? cJSON_GetObjectItem(act_obj, "climate_sync_on")
                               : cJSON_GetObjectItem(r, "climate_sync_on");
  act->climate_sync_on = (sync_on_obj && cJSON_IsTrue(sync_on_obj));

  cJSON *drv_only_obj =
      act_obj ? cJSON_GetObjectItem(act_obj, "climate_driver_only")
              : cJSON_GetObjectItem(r, "climate_driver_only");
  act->climate_driver_only = (drv_only_obj && cJSON_IsTrue(drv_only_obj));

  cJSON *pass_aware_obj =
      act_obj ? cJSON_GetObjectItem(act_obj, "climate_passenger_aware")
              : cJSON_GetObjectItem(r, "climate_passenger_aware");
  act->climate_passenger_aware =
      (pass_aware_obj && cJSON_IsTrue(pass_aware_obj));

  cJSON *pop = act_obj ? cJSON_GetObjectItem(act_obj, "popup_message")
                       : cJSON_GetObjectItem(r, "popup_message");
  if (!pop && act_obj)
    pop = cJSON_GetObjectItem(act_obj, "track_popup");
  if (!pop)
    pop = cJSON_GetObjectItem(r, "track_popup");
  if (pop && pop->valuestring && strlen(pop->valuestring) > 0)
    act->popup_message = strdup(pop->valuestring);

  cJSON *pm = act_obj ? cJSON_GetObjectItem(act_obj, "precon_mode")
                      : cJSON_GetObjectItem(r, "precon_mode");
  if (pm && pm->valuestring)
    strncpy(act->precon_mode, pm->valuestring, sizeof(act->precon_mode) - 1);

  cJSON *pp = act_obj ? cJSON_GetObjectItem(act_obj, "precon_press")
                      : cJSON_GetObjectItem(r, "precon_press");
  if (pp && pp->valuestring)
    strncpy(act->precon_press, pp->valuestring, sizeof(act->precon_press) - 1);

  cJSON *txid = act_obj ? cJSON_GetObjectItem(act_obj, "can_id")
                        : cJSON_GetObjectItem(r, "tx_can_id");
  cJSON *act_bus = act_obj ? cJSON_GetObjectItem(act_obj, "bus") : NULL;
  cJSON *act_delay = act_obj ? cJSON_GetObjectItem(act_obj, "delay_ms") : NULL;
  cJSON *steps_arr = act_obj ? cJSON_GetObjectItem(act_obj, "steps") : NULL;
  cJSON *txp = act_obj ? cJSON_GetObjectItem(act_obj, "payload")
                       : cJSON_GetObjectItem(r, "tx_payload");

  uint32_t can_id_val = 0;
  bool is_ext = false;
  uint8_t target_bus = 0;
  uint32_t delay_val = 10;

  if (txid && txid->valuestring && strlen(txid->valuestring) > 0) {
    can_id_val = strtoul(txid->valuestring, NULL, 0);
    is_ext = (can_id_val > 0x7FF);
  }
  if (act_bus && cJSON_IsNumber(act_bus))
    target_bus = (uint8_t)act_bus->valueint;
  if (act_delay && cJSON_IsNumber(act_delay))
    delay_val = (uint32_t)act_delay->valueint;

  cJSON *w_ms = act_obj ? cJSON_GetObjectItem(act_obj, "wait_ms") : NULL;
  if (!w_ms && act_obj)
    w_ms = cJSON_GetObjectItem(act_obj, "delay_ms");
  if (!w_ms)
    w_ms = cJSON_GetObjectItem(r, "wait_ms");
  if (!w_ms)
    w_ms = cJSON_GetObjectItem(r, "delay_ms");
  if (w_ms && cJSON_IsNumber(w_ms)) {
    act->delay_ms = (uint32_t)w_ms->valueint;
  } else {
    act->delay_ms = delay_val;
  }

  uint32_t total_steps = 0;
  if (steps_arr && cJSON_IsArray(steps_arr)) {
    int num_items = cJSON_GetArraySize(steps_arr);
    for (int k = 0; k < num_items; k++) {
      cJSON *st = cJSON_GetArrayItem(steps_arr, k);
      cJSON *rep = cJSON_GetObjectItem(st, "repeat");
      int r_cnt =
          (rep && cJSON_IsNumber(rep) && rep->valueint > 0) ? rep->valueint : 1;
      total_steps += r_cnt;
    }
  }

  if (total_steps > 0 && total_steps <= 128) {
    act->steps = calloc(total_steps, sizeof(can_do_sequence_step_t));
    if (act->steps) {
      uint8_t s_idx = 0;
      int num_items = cJSON_GetArraySize(steps_arr);
      for (int k = 0; k < num_items && s_idx < total_steps; k++) {
        cJSON *st = cJSON_GetArrayItem(steps_arr, k);
        cJSON *sp = cJSON_GetObjectItem(st, "payload");
        cJSON *rep = cJSON_GetObjectItem(st, "repeat");
        cJSON *st_delay = cJSON_GetObjectItem(st, "delay_ms");
        uint32_t step_delay =
            (st_delay && cJSON_IsNumber(st_delay) && st_delay->valueint >= 0)
                ? (uint32_t)st_delay->valueint
                : delay_val;
        int r_cnt = (rep && cJSON_IsNumber(rep) && rep->valueint > 0)
                        ? rep->valueint
                        : 1;

        can_do_sequence_step_t parsed_step = {0};
        can_do_parse_step_payload(sp ? sp->valuestring : "", &parsed_step);

        for (int r_i = 0; r_i < r_cnt && s_idx < total_steps; r_i++) {
          can_do_sequence_step_t *step = &act->steps[s_idx++];
          step->tx_can_id = can_id_val;
          step->is_ext = is_ext;
          step->target_bus = target_bus;
          step->delay_ms = step_delay;
          step->tx_len = parsed_step.tx_len;
          step->roll_byte_idx = parsed_step.roll_byte_idx;
          step->roll_mode = parsed_step.roll_mode;
          step->roll_counter = 0;
          memcpy(step->tx_data, parsed_step.tx_data, parsed_step.tx_len);
        }
      }
      act->step_count = s_idx;
    }
  } else if (txp && txp->valuestring && can_id_val > 0) {
    act->step_count = 1;
    act->steps = calloc(1, sizeof(can_do_sequence_step_t));
    if (act->steps) {
      can_do_sequence_step_t *step = &act->steps[0];
      step->tx_can_id = can_id_val;
      step->is_ext = is_ext;
      step->target_bus = target_bus;
      step->delay_ms = delay_val;
      can_do_parse_step_payload(txp->valuestring, step);
    }
  }
}

static void can_do_init_default_precondition_rule(void) {
  if (g_can_do_rules.rule_count > 0 && g_can_do_rules.rules)
    return;

  g_can_do_rules.rules = calloc(1, sizeof(can_do_rule_t));
  if (!g_can_do_rules.rules)
    return;

  can_do_rule_t *rule = &g_can_do_rules.rules[0];
  rule->name = strdup("E-GMP Battery Preconditioning");
  rule->enabled = true;
  rule->trigger_count = 1;
  rule->triggers = calloc(1, sizeof(can_do_trigger_t));
  if (rule->triggers) {
    can_do_trigger_t *trig = &rule->triggers[0];
    strncpy(trig->id, "sw_star", sizeof(trig->id) - 1);
    trig->source = CAN_DO_TRIG_CAN_MESSAGE;
    trig->can_id = 0x448;
    trig->bus = 0;
    trig->exec_mode = CAN_DO_EXEC_ONE_SHOT;
    trig->cooldown_ms = 500;
    trig->timeout_reset_ms = 2000;
    trig->has_to = true;
    trig->data_len = 6;
    trig->match_data[5] = 0x10;
    trig->match_mask[5] = 0xF0;
    trig->has_from = true;
    trig->from_len = 6;
    trig->from_data[5] = 0x00;
    trig->from_mask[5] = 0xF0;
  }

  rule->action_count = 1;
  rule->actions = calloc(1, sizeof(can_do_action_t));
  if (rule->actions) {
    can_do_action_t *act = &rule->actions[0];
    act->type = CAN_DO_ACT_PRECONDITION;
    strncpy(act->trigger_id, "sw_star", sizeof(act->trigger_id) - 1);
    act->popup_message = NULL;
    strncpy(act->precon_mode, "persistent", sizeof(act->precon_mode) - 1);
    strncpy(act->precon_press, "short", sizeof(act->precon_press) - 1);
  }

  g_can_do_rules.rule_count = 1;
}

static void can_do_free_rules(void) {
  if (!g_can_do_rules.rules)
    return;

  for (uint32_t i = 0; i < g_can_do_rules.rule_count; i++) {
    can_do_rule_t *rule = &g_can_do_rules.rules[i];
    if (rule->name)
      free(rule->name);
    if (rule->triggers)
      free(rule->triggers);
    if (rule->actions) {
      for (uint8_t a = 0; a < rule->action_count; a++) {
        if (rule->actions[a].popup_message)
          free(rule->actions[a].popup_message);
        if (rule->actions[a].steps)
          free(rule->actions[a].steps);
      }
      free(rule->actions);
    }
    if (rule->off_actions) {
      for (uint8_t a = 0; a < rule->off_action_count; a++) {
        if (rule->off_actions[a].popup_message)
          free(rule->off_actions[a].popup_message);
        if (rule->off_actions[a].steps)
          free(rule->off_actions[a].steps);
      }
      free(rule->off_actions);
    }
  }
  free(g_can_do_rules.rules);
  g_can_do_rules.rules = NULL;
  g_can_do_rules.rule_count = 0;
}

esp_err_t can_do_load_config(void) {
  if (g_can_do_rules.mutex &&
      xSemaphoreTake(g_can_do_rules.mutex, portMAX_DELAY) != pdTRUE) {
    return ESP_ERR_TIMEOUT;
  }

  FILE *f = fopen(FS_MOUNT_POINT "/can_do.json", "r");
  if (!f) {
    can_do_init_default_precondition_rule();
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return ESP_OK;
  }

  fseek(f, 0, SEEK_END);
  long sz = ftell(f);
  fseek(f, 0, SEEK_SET);

  if (sz <= 0) {
    fclose(f);
    can_do_init_default_precondition_rule();
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return ESP_OK;
  }

  char *buf = malloc(sz + 1);
  if (!buf) {
    fclose(f);
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return ESP_ERR_NO_MEM;
  }
  fread(buf, 1, sz, f);
  buf[sz] = '\0';
  fclose(f);

  cJSON *root = cJSON_Parse(buf);
  free(buf);
  if (!root) {
    can_do_init_default_precondition_rule();
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return ESP_FAIL;
  }

  cJSON *rules_arr = cJSON_GetObjectItem(root, "rules");
  if (rules_arr && cJSON_IsArray(rules_arr)) {
    int count = cJSON_GetArraySize(rules_arr);
    can_do_free_rules();

    if (count > 0) {
      g_can_do_rules.rules = calloc(count, sizeof(can_do_rule_t));
      if (g_can_do_rules.rules) {
        for (int i = 0; i < count; i++) {
          cJSON *r = cJSON_GetArrayItem(rules_arr, i);
          can_do_rule_t *rule = &g_can_do_rules.rules[i];
          rule->enabled = true;
          cJSON *en = cJSON_GetObjectItem(r, "enabled");
          if (en && cJSON_IsBool(en))
            rule->enabled = cJSON_IsTrue(en);

          cJSON *name = cJSON_GetObjectItem(r, "name");
          if (name && name->valuestring)
            rule->name = strdup(name->valuestring);

          cJSON *ha_exp = cJSON_GetObjectItem(r, "ha_expose");
          if (ha_exp && cJSON_IsBool(ha_exp))
            rule->ha_expose = cJSON_IsTrue(en);

          cJSON *ha_ic = cJSON_GetObjectItem(r, "ha_icon");
          if (ha_ic && ha_ic->valuestring)
            strncpy(rule->ha_icon, ha_ic->valuestring,
                    sizeof(rule->ha_icon) - 1);

          cJSON *rule_em = cJSON_GetObjectItem(r, "exec_mode");
          if (rule_em && rule_em->valuestring) {
            if (strcmp(rule_em->valuestring, "toggle") == 0)
              rule->exec_mode = CAN_DO_EXEC_TOGGLE;
            else if (strcmp(rule_em->valuestring, "one_shot") == 0)
              rule->exec_mode = CAN_DO_EXEC_ONE_SHOT;
            else if (strcmp(rule_em->valuestring, "poll_verify") == 0)
              rule->exec_mode = CAN_DO_EXEC_POLL_VERIFY;
            else if (strcmp(rule_em->valuestring, "continuous") == 0)
              rule->exec_mode = CAN_DO_EXEC_CONTINUOUS;
            else
              rule->exec_mode = CAN_DO_EXEC_ON_CHANGE;
          } else {
            rule->exec_mode = CAN_DO_EXEC_ON_CHANGE;
          }

          cJSON *rev_sec = cJSON_GetObjectItem(r, "auto_revert_sec");
          if (rev_sec && cJSON_IsNumber(rev_sec))
            rule->auto_revert_sec = (uint32_t)rev_sec->valueint;

          cJSON *trig_mode = cJSON_GetObjectItem(r, "trigger_mode");
          if (!trig_mode)
            trig_mode = cJSON_GetObjectItem(r, "triggers_mode");
          if (!trig_mode)
            trig_mode = cJSON_GetObjectItem(r, "trigger_combine");
          if (trig_mode && trig_mode->valuestring) {
            rule->trigger_combine_all =
                (strcmp(trig_mode->valuestring, "all") == 0 ||
                 strcmp(trig_mode->valuestring, "and") == 0 ||
                 strcmp(trig_mode->valuestring, "combo") == 0);
          }

          cJSON *trigs_arr = cJSON_GetObjectItem(r, "triggers");
          if (trigs_arr && cJSON_IsArray(trigs_arr) &&
              cJSON_GetArraySize(trigs_arr) > 0) {
            int num_trigs = cJSON_GetArraySize(trigs_arr);
            rule->triggers = calloc(num_trigs, sizeof(can_do_trigger_t));
            if (rule->triggers) {
              rule->trigger_count = num_trigs;
              for (int t = 0; t < num_trigs; t++) {
                cJSON *t_item = cJSON_GetArrayItem(trigs_arr, t);
                can_do_parse_single_trigger(r, t_item, &rule->triggers[t]);
              }
            }
          } else {
            cJSON *trig_obj = cJSON_GetObjectItem(r, "trigger");
            rule->triggers = calloc(1, sizeof(can_do_trigger_t));
            if (rule->triggers) {
              rule->trigger_count = 1;
              can_do_parse_single_trigger(r, trig_obj, &rule->triggers[0]);
            }
          }

          cJSON *acts_arr = cJSON_GetObjectItem(r, "actions");
          if (acts_arr && cJSON_IsArray(acts_arr) &&
              cJSON_GetArraySize(acts_arr) > 0) {
            int num_acts = cJSON_GetArraySize(acts_arr);
            rule->actions = calloc(num_acts, sizeof(can_do_action_t));
            if (rule->actions) {
              rule->action_count = num_acts;
              for (int a = 0; a < num_acts; a++) {
                cJSON *a_item = cJSON_GetArrayItem(acts_arr, a);
                can_do_parse_single_action(r, a_item, &rule->actions[a]);
              }
            }
          } else {
            cJSON *act_obj = cJSON_GetObjectItem(r, "action");
            rule->actions = calloc(1, sizeof(can_do_action_t));
            if (rule->actions) {
              rule->action_count = 1;
              can_do_parse_single_action(r, act_obj, &rule->actions[0]);
            }
          }

          cJSON *off_acts_arr = cJSON_GetObjectItem(r, "off_actions");
          if (off_acts_arr && cJSON_IsArray(off_acts_arr) &&
              cJSON_GetArraySize(off_acts_arr) > 0) {
            int num_off = cJSON_GetArraySize(off_acts_arr);
            rule->off_actions = calloc(num_off, sizeof(can_do_action_t));
            if (rule->off_actions) {
              rule->off_action_count = num_off;
              for (int a = 0; a < num_off; a++) {
                cJSON *off_item = cJSON_GetArrayItem(off_acts_arr, a);
                can_do_parse_single_action(r, off_item, &rule->off_actions[a]);
              }
            }
          } else {
            cJSON *off_act_obj = cJSON_GetObjectItem(r, "off_action");
            if (off_act_obj) {
              rule->off_actions = calloc(1, sizeof(can_do_action_t));
              if (rule->off_actions) {
                rule->off_action_count = 1;
                can_do_parse_single_action(r, off_act_obj,
                                           &rule->off_actions[0]);
              }
            }
          }

          g_can_do_rules.rule_count++;
        }
      }
    } else {
      can_do_init_default_precondition_rule();
    }
  } else {
    can_do_init_default_precondition_rule();
  }
  cJSON_Delete(root);

  if (g_can_do_rules.mutex)
    xSemaphoreGive(g_can_do_rules.mutex);

  can_do_publish_ha_discovery();
  return ESP_OK;
}

esp_err_t can_do_save_config(const char *json_str) {
  if (!json_str)
    return ESP_ERR_INVALID_ARG;
  FILE *f = fopen(FS_MOUNT_POINT "/can_do.json", "w");
  if (!f)
    return ESP_FAIL;
  fputs(json_str, f);
  fclose(f);
  can_do_load_config();
  can_do_publish_ha_discovery();
  return ESP_OK;
}

char *can_do_get_config(void) {
  if (g_can_do_rules.mutex &&
      xSemaphoreTake(g_can_do_rules.mutex, pdMS_TO_TICKS(50)) != pdTRUE) {
    return strdup(DEFAULT_CAN_DO_JSON);
  }

  FILE *f = fopen(FS_MOUNT_POINT "/can_do.json", "r");
  if (!f) {
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return strdup(DEFAULT_CAN_DO_JSON);
  }

  fseek(f, 0, SEEK_END);
  long sz = ftell(f);
  fseek(f, 0, SEEK_SET);

  if (sz <= 0) {
    fclose(f);
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return strdup(DEFAULT_CAN_DO_JSON);
  }

  char *buf = malloc(sz + 1);
  if (!buf) {
    fclose(f);
    if (g_can_do_rules.mutex)
      xSemaphoreGive(g_can_do_rules.mutex);
    return strdup(DEFAULT_CAN_DO_JSON);
  }
  size_t n = fread(buf, 1, sz, f);
  fclose(f);
  buf[n] = '\0';

  if (g_can_do_rules.mutex)
    xSemaphoreGive(g_can_do_rules.mutex);
  return buf;
}

bool can_do_test_single_action_json(const char *json_str) {
  if (!json_str || strlen(json_str) == 0)
    return false;

  cJSON *root = cJSON_Parse(json_str);
  if (!root)
    return false;

  can_do_action_t act;
  memset(&act, 0, sizeof(can_do_action_t));
  can_do_parse_single_action(root, root, &act);

  can_do_execute_action(&act, "test_action");

  if (act.steps)
    free(act.steps);
  if (act.popup_message)
    free(act.popup_message);

  cJSON_Delete(root);
  return true;
}

void can_do_get_stats_json(cJSON *root) {
  if (!root)
    return;

  if (g_can_do_rules.mutex &&
      xSemaphoreTake(g_can_do_rules.mutex, pdMS_TO_TICKS(20)) != pdTRUE) {
    return;
  }

  cJSON *can_do_stats = cJSON_CreateArray();
  int64_t now_us = esp_timer_get_time();
  for (uint32_t i = 0; i < g_can_do_rules.rule_count; i++) {
    cJSON *st = cJSON_CreateObject();
    cJSON_AddNumberToObject(st, "index", i);
    cJSON_AddStringToObject(
        st, "name",
        g_can_do_rules.rules[i].name ? g_can_do_rules.rules[i].name : "");
    cJSON_AddNumberToObject(st, "count", g_can_do_rules.rules[i].exec_count);
    cJSON_AddBoolToObject(st, "is_active",
                          g_can_do_rules.rules[i].is_active_state);
    int64_t age_ms =
        (g_can_do_rules.rules[i].last_exec_us > 0)
            ? (now_us - g_can_do_rules.rules[i].last_exec_us) / 1000
            : -1;
    cJSON_AddNumberToObject(st, "age_ms", age_ms);
    cJSON_AddItemToArray(can_do_stats, st);
  }
  cJSON_AddItemToObject(root, "can_do_stats", can_do_stats);
  cJSON_AddNumberToObject(root, "capture_mode",
                          (int)g_can_do_rules.capture_mode);
  cJSON_AddBoolToObject(root, "capture_active", can_do_is_capture_active());

  if (g_can_do_rules.mutex)
    xSemaphoreGive(g_can_do_rules.mutex);
}

void can_do_set_capture_mode(can_do_capture_mode_t mode) {
  g_can_do_rules.capture_mode = mode;
  g_can_do_rules.reverse_engineering_mode =
      (mode == CAN_DO_CAPTURE_ALWAYS_PAUSED);
}

can_do_capture_mode_t can_do_get_capture_mode(void) {
  return g_can_do_rules.capture_mode;
}

bool can_do_is_capture_active(void) {
  if (g_can_do_rules.capture_mode == CAN_DO_CAPTURE_ALWAYS_PAUSED) {
    return true;
  }
  if (g_can_do_rules.capture_mode == CAN_DO_CAPTURE_DISABLED) {
    return false;
  }
  int8_t proto = config_server_protocol();
  if (proto == SAVVYCAN && tcp_port_open()) {
    return true;
  }
  return false;
}

void can_do_set_reverse_engineering_mode(bool enable) {
  can_do_set_capture_mode(enable ? CAN_DO_CAPTURE_ALWAYS_PAUSED
                                 : CAN_DO_CAPTURE_AUTO);
}

bool can_do_get_reverse_engineering_mode(void) {
  return can_do_is_capture_active();
}

static void sanitize_ha_identifier(const char *in, char *out, size_t max_len) {
  if (!in || !out || max_len == 0)
    return;
  size_t j = 0;
  for (size_t i = 0; in[i] != '\0' && j < max_len - 1; i++) {
    char c = in[i];
    if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
      out[j++] = c;
    } else if (c >= 'A' && c <= 'Z') {
      out[j++] = c + ('a' - 'A');
    } else if (c == ' ' || c == '_' || c == '-' || c == '.') {
      if (j > 0 && out[j - 1] != '_') {
        out[j++] = '_';
      }
    }
  }
  while (j > 0 && out[j - 1] == '_')
    j--;
  out[j] = '\0';
  if (j == 0) {
    strncpy(out, "can_do_action", max_len - 1);
    out[max_len - 1] = '\0';
  }
}

void can_do_publish_ha_discovery(void) {
  if (!mqtt_connected() || !g_can_do_rules.rules ||
      g_can_do_rules.rule_count == 0)
    return;

  if (g_can_do_rules.mutex &&
      xSemaphoreTake(g_can_do_rules.mutex, pdMS_TO_TICKS(50)) != pdTRUE) {
    return;
  }

  char dev_id[32] = {0};
  if (g_device_id[0] != '\0') {
    strncpy(dev_id, g_device_id, sizeof(dev_id) - 1);
  } else {
    hw_config_get_device_id(dev_id);
  }
  if (strlen(dev_id) == 0)
    strcpy(dev_id, "default");

  for (uint32_t i = 0; i < g_can_do_rules.rule_count; i++) {
    can_do_rule_t *rule = &g_can_do_rules.rules[i];
    if (!rule->enabled || !rule->name)
      continue;

    bool should_expose = rule->ha_expose;
    const char *trigger_payload = rule->name;

    uint8_t t_count = rule->trigger_count;
    can_do_trigger_t *trig_list = rule->triggers;
    if (!trig_list || t_count == 0)
      continue;

    for (uint8_t t = 0; t < t_count; t++) {
      if (trig_list[t].source == CAN_DO_TRIG_MQTT_COMMAND) {
        should_expose = true;
        if (trig_list[t].mqtt_payload[0] != '\0')
          trigger_payload = trig_list[t].mqtt_payload;
        break;
      }
    }

    if (!should_expose)
      continue;

    char sanitized_name[64];
    sanitize_ha_identifier(rule->name, sanitized_name, sizeof(sanitized_name));

    char disc_topic[192];
    snprintf(disc_topic, sizeof(disc_topic),
             "homeassistant/button/wican_%s/can_do_%s/config", dev_id,
             sanitized_name);

    char cmd_topic[128];
    snprintf(cmd_topic, sizeof(cmd_topic), "wican/%s/can_do/trigger", dev_id);

    char uniq_id[160];
    snprintf(uniq_id, sizeof(uniq_id), "wican_%s_can_do_%s", dev_id,
             sanitized_name);

    const char *icon =
        (rule->ha_icon[0] != '\0') ? rule->ha_icon : "mdi:car-cog";

    cJSON *root = cJSON_CreateObject();
    if (!root)
      continue;

    cJSON_AddStringToObject(root, "name", rule->name);
    cJSON_AddStringToObject(root, "unique_id", uniq_id);
    cJSON_AddStringToObject(root, "command_topic", cmd_topic);
    cJSON_AddStringToObject(root, "payload_press", trigger_payload);
    cJSON_AddStringToObject(root, "icon", icon);

    cJSON *dev = cJSON_CreateObject();
    if (dev) {
      cJSON *ids = cJSON_CreateArray();
      char dev_identifier[64];
      snprintf(dev_identifier, sizeof(dev_identifier), "wican_%s", dev_id);
      cJSON_AddItemToArray(ids, cJSON_CreateString(dev_identifier));
      cJSON_AddItemToObject(dev, "identifiers", ids);

      char dev_name[64];
      snprintf(dev_name, sizeof(dev_name), "WiCAN %s", dev_id);
      cJSON_AddStringToObject(dev, "name", dev_name);
      cJSON_AddStringToObject(dev, "model", "WiCAN Vehicle Bridge");
      cJSON_AddStringToObject(dev, "manufacturer", "MeatPi");
      cJSON_AddItemToObject(root, "device", dev);
    }

    char *json_str = cJSON_PrintUnformatted(root);
    if (json_str) {
      mqtt_publish(disc_topic, json_str, strlen(json_str), 1, 1);
      ESP_LOGI(TAG, "Published HA Button discovery for '%s' to %s", rule->name,
               disc_topic);
      free(json_str);
    }
    cJSON_Delete(root);
    vTaskDelay(pdMS_TO_TICKS(50));
  }

  if (g_can_do_rules.mutex)
    xSemaphoreGive(g_can_do_rules.mutex);
}

void can_do_unpublish_ha_rule(const char *rule_name) {
  if (!rule_name || !mqtt_connected())
    return;

  char dev_id[32] = {0};
  if (g_device_id[0] != '\0') {
    strncpy(dev_id, g_device_id, sizeof(dev_id) - 1);
  } else {
    hw_config_get_device_id(dev_id);
  }
  if (strlen(dev_id) == 0)
    strcpy(dev_id, "default");

  char sanitized_name[64];
  sanitize_ha_identifier(rule_name, sanitized_name, sizeof(sanitized_name));

  char disc_topic[192];
  snprintf(disc_topic, sizeof(disc_topic),
           "homeassistant/button/wican_%s/can_do_%s/config", dev_id,
           sanitized_name);

  mqtt_publish(disc_topic, "", 0, 1, 1);
  ESP_LOGI(TAG, "Unpublished HA Button discovery for '%s' (%s)", rule_name,
           disc_topic);
}
