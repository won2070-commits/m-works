#!/bin/zsh
# 말씀공방 AI 연결 — 더블클릭하면 바로 로그인 화면이 열립니다. (최초 1회만)
CLAUDE_BIN="$(command -v claude)"
[ -z "$CLAUDE_BIN" ] && [ -x /opt/homebrew/bin/claude ] && CLAUDE_BIN=/opt/homebrew/bin/claude
if [ -z "$CLAUDE_BIN" ]; then
  echo "claude 명령을 찾을 수 없습니다. 먼저 설치해 주세요:"
  echo "  npm install -g @anthropic-ai/claude-code"
  read "?창을 닫으려면 Enter..."
  exit 1
fi
clear
echo "─────────────────────────────────────────────"
echo "  말씀공방 AI 연결"
echo "─────────────────────────────────────────────"
echo ""
echo "  잠시 후 로그인 화면이 나타나면:"
echo "   1) 'Claude account with subscription' 선택 (Enter)"
echo "   2) 브라우저가 열리면 → 로그인 → [허용/Authorize] 클릭"
echo "   3) 이 창에 '로그인 완료(Logged in)'가 보이면 끝!"
echo "      창을 닫고 '말씀공방 실행.command' 를 더블클릭하세요"
echo ""
echo "─────────────────────────────────────────────"
exec "$CLAUDE_BIN" /login
