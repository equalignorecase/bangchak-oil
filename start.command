#!/bin/bash
# ดับเบิลคลิกไฟล์นี้เพื่อเปิดหน้าเว็บ (macOS)
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-3000}"
echo "กำลังเปิดเซิร์ฟเวอร์ที่ http://localhost:$PORT ..."
echo "ปิดหน้าต่างนี้เพื่อหยุดเซิร์ฟเวอร์"

( sleep 1; open "http://localhost:$PORT" ) &
PORT="$PORT" node server.js
