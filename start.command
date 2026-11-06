#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "🚀 Đang khởi động Social Lens tại http://localhost:3888 ..."
(sleep 1 && open "http://localhost:3888") &
node server.js

