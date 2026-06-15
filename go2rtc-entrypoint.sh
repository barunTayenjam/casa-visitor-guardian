#!/bin/sh
CONFIG_FILE="${GO2RTC_CONFIG:-/config/go2rtc.yaml}"

# Pass through to go2rtc with config
exec /sbin/tini -- go2rtc -config "$CONFIG_FILE"
