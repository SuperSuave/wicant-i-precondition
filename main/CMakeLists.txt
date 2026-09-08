# See the build system documentation in IDF programming guide
# for more information about component CMakeLists.txt files.
set(srcs 
    "main.c" "comm_server.c" "config_server.c" "realdash.c" "slcan.c" 
    "can.c" "ble.c" "wifi_network.c" "gvret.c" "elm327.c" "mqtt.c" 
    "sleep_mode.c" "expression_parser.c" "wc_mdns.c" "dev_status.c" 
    "hsm.c" "precondition.c" "persistent_settings.c" "time_sync.c" 
    "track_popup.c" "isotp_tx.c" "utf8_utf16_converter.c"
)

set(requires 
    esp_driver_twai esp_twai_mcp2515 esp_timer esp_wifi nvs_flash 
    fatfs vfs driver esp-tls esp_adc esp_eth log app_update 
    esp_http_server bt spiffs freertos mqtt json debug_logs 
    ha_webhooks filesystem
)

idf_component_register(
    SRCS "hw_config.c" "wc_timer.c" "autopid.c" "ftp.c" "cando.c" ${srcs}
    INCLUDE_DIRS "."
    REQUIRES ${requires}
    EMBED_FILES "homepage.html.gz" "cando_catalog.json.gz"
)