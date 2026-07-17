#!/bin/zsh
# 말씀공방 실행 — 더블클릭하면 서버를 켜고 브라우저를 엽니다.
# (터미널에서 claude 로그인이 되어 있으면 API 키 없이 AI가 연결됩니다)
APP_DIR="/Users/dowonuk/Desktop/Cowork/말씀공방"
cd "$APP_DIR"
if ! lsof -i :5208 >/dev/null 2>&1; then
  nohup node "$APP_DIR/server.cjs" >/dev/null 2>&1 &
  sleep 1
fi
open "http://localhost:5208/"
