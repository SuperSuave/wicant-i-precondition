#ifndef TIME_SYNC_H
#define TIME_SYNC_H

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    bool sntp_enabled;
    char sntp_server[64];
    char timezone[64];
} time_sync_config_t;

void time_sync_init(void);
void time_sync_on_sta_got_ip(void);
void time_sync_start_sntp(void);
void time_sync_stop_sntp(void);
esp_err_t time_sync_set_time(int64_t epoch_sec, const char *tz);
bool time_sync_is_synced(void);
void time_sync_get_formatted(char *buf, size_t max_len);
time_sync_config_t *time_sync_get_config(void);
esp_err_t time_sync_save_config(const time_sync_config_t *cfg);
esp_err_t time_sync_load_config(time_sync_config_t *cfg);

#ifdef __cplusplus
}
#endif

#endif /* TIME_SYNC_H */
