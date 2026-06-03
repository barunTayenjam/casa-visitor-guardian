#!/bin/sh
CONFIG_FILE="${GO2RTC_CONFIG:-/config/go2rtc.yaml}"

if grep -q '__PUBLIC_IP__' "$CONFIG_FILE" 2>/dev/null; then
  PUBLIC_IP=$(wget -q -O- ifconfig.me/ip 2>/dev/null | tr -d '[:space:]' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || \
              wget -q -O- icanhazip.com 2>/dev/null | tr -d '[:space:]' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || \
              wget -q -O- ipinfo.io/ip 2>/dev/null | tr -d '[:space:]' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || \
              echo "")

  if [ -n "$PUBLIC_IP" ]; then
    sed "s/__PUBLIC_IP__/$PUBLIC_IP/g" "$CONFIG_FILE" > /tmp/go2rtc.yaml.tmp
    cat /tmp/go2rtc.yaml.tmp > "$CONFIG_FILE"
    rm -f /tmp/go2rtc.yaml.tmp
    echo "go2rtc-entrypoint: public IP detected as $PUBLIC_IP"
  else
    sed '/__PUBLIC_IP__/d' "$CONFIG_FILE" > /tmp/go2rtc.yaml.tmp
    cat /tmp/go2rtc.yaml.tmp > "$CONFIG_FILE"
    rm -f /tmp/go2rtc.yaml.tmp
    echo "go2rtc-entrypoint: WARNING - could not detect public IP, removing candidate"
  fi
fi

exec /sbin/tini -- go2rtc -config "$CONFIG_FILE"