#include "time_sync.h"
#include "autopid.h"
#include "cJSON.h"
#include "esp_log.h"
#include "esp_sntp.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <time.h>


#define TAG "TIME_SYNC"
#include "hw_config.h"
#define TIME_CONFIG_PATH FS_MOUNT_POINT "/time_config.json"

static time_sync_config_t g_time_config = {
    .sntp_enabled = false, .sntp_server = "pool.ntp.org", .timezone = "UTC0"};

static bool s_sntp_running = false;

static void sntp_sync_notification_cb(struct timeval *tv) {
  ESP_LOGI(TAG, "SNTP time synchronized successfully");
}

void time_sync_init(void) {
  time_sync_load_config(&g_time_config);
  setenv("TZ", g_time_config.timezone, 1);
  tzset();
}

void time_sync_start_sntp(void) {
  if (s_sntp_running) {
    esp_sntp_stop();
    s_sntp_running = false;
  }

  if (!g_time_config.sntp_enabled) {
    return;
  }

  if (cando_get_reverse_engineering_mode()) {
    ESP_LOGI(TAG, "Reverse engineering mode active: SNTP skipped");
    return;
  }

  ESP_LOGI(TAG, "Initializing SNTP client with server: %s",
           g_time_config.sntp_server);
  esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
  esp_sntp_setservername(0, g_time_config.sntp_server);
  sntp_set_time_sync_notification_cb(sntp_sync_notification_cb);
  esp_sntp_init();
  s_sntp_running = true;
}

void time_sync_stop_sntp(void) {
  if (s_sntp_running) {
    ESP_LOGI(TAG, "Stopping SNTP client");
    esp_sntp_stop();
    s_sntp_running = false;
  }
}

void time_sync_on_sta_got_ip(void) {
  if (g_time_config.sntp_enabled) {
    time_sync_start_sntp();
  }
}

esp_err_t time_sync_set_time(int64_t epoch_sec, const char *tz) {
  if (epoch_sec > 0) {
    struct timeval tv = {.tv_sec = (time_t)epoch_sec, .tv_usec = 0};
    settimeofday(&tv, NULL);
  }
  if (tz && strlen(tz) > 0) {
    strncpy(g_time_config.timezone, tz, sizeof(g_time_config.timezone) - 1);
    g_time_config.timezone[sizeof(g_time_config.timezone) - 1] = '\0';
    setenv("TZ", g_time_config.timezone, 1);
    tzset();
  }
  return ESP_OK;
}

bool time_sync_is_synced(void) {
  time_t now = time(NULL);
  return (now > 1700000000);
}

void time_sync_get_formatted(char *buf, size_t max_len) {
  if (!buf || max_len == 0)
    return;
  time_t now = time(NULL);
  struct tm timeinfo;
  localtime_r(&now, &timeinfo);
  strftime(buf, max_len, "%Y-%m-%d %H:%M:%S", &timeinfo);
}

time_sync_config_t *time_sync_get_config(void) { return &g_time_config; }

esp_err_t time_sync_save_config(const time_sync_config_t *cfg) {
  if (!cfg)
    return ESP_ERR_INVALID_ARG;
  memcpy(&g_time_config, cfg, sizeof(time_sync_config_t));
  setenv("TZ", g_time_config.timezone, 1);
  tzset();

  cJSON *root = cJSON_CreateObject();
  if (!root)
    return ESP_ERR_NO_MEM;
  cJSON_AddBoolToObject(root, "sntp_enabled", g_time_config.sntp_enabled);
  cJSON_AddStringToObject(root, "sntp_server", g_time_config.sntp_server);
  cJSON_AddStringToObject(root, "timezone", g_time_config.timezone);

  char *str = cJSON_PrintUnformatted(root);
  cJSON_Delete(root);
  if (!str)
    return ESP_ERR_NO_MEM;

  FILE *f = fopen(TIME_CONFIG_PATH, "w");
  if (!f) {
    free(str);
    return ESP_FAIL;
  }
  fputs(str, f);
  fclose(f);
  free(str);
  return ESP_OK;
}

esp_err_t time_sync_load_config(time_sync_config_t *cfg) {
  if (!cfg)
    return ESP_ERR_INVALID_ARG;
  FILE *f = fopen(TIME_CONFIG_PATH, "r");
  if (!f)
    return ESP_OK;

  fseek(f, 0, SEEK_END);
  long sz = ftell(f);
  fseek(f, 0, SEEK_SET);

  if (sz <= 0) {
    fclose(f);
    return ESP_OK;
  }

  char *buf = malloc(sz + 1);
  if (!buf) {
    fclose(f);
    return ESP_ERR_NO_MEM;
  }
  fread(buf, 1, sz, f);
  buf[sz] = '\0';
  fclose(f);

  cJSON *root = cJSON_Parse(buf);
  free(buf);
  if (!root)
    return ESP_FAIL;

  cJSON *en = cJSON_GetObjectItem(root, "sntp_enabled");
  if (en && cJSON_IsBool(en))
    cfg->sntp_enabled = cJSON_IsTrue(en);

  cJSON *srv = cJSON_GetObjectItem(root, "sntp_server");
  if (srv && srv->valuestring && strlen(srv->valuestring) > 0) {
    strncpy(cfg->sntp_server, srv->valuestring, sizeof(cfg->sntp_server) - 1);
    cfg->sntp_server[sizeof(cfg->sntp_server) - 1] = '\0';
  }

  cJSON *tz = cJSON_GetObjectItem(root, "timezone");
  if (tz && tz->valuestring && strlen(tz->valuestring) > 0) {
    strncpy(cfg->timezone, tz->valuestring, sizeof(cfg->timezone) - 1);
    cfg->timezone[sizeof(cfg->timezone) - 1] = '\0';
  }

  cJSON_Delete(root);
  return ESP_OK;
}
