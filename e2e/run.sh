#!/usr/bin/env bash
# 真实浏览器端到端：建批 / 资源冲突 / 盲测越权 / 异常隔离 / 失败回滚 / 双页合并 / 导入导出
set -e
cd "$(dirname "$0")/.."
BASE_URL="${BASE_URL:-http://127.0.0.1:4173}"
# 本机无 root，Chromium 依赖库被解到该前缀（其他环境可留空）
[ -f /home/node/pwlibs/libpath.txt ] && export LD_LIBRARY_PATH="$(cat /home/node/pwlibs/libpath.txt)${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
BASE_URL="$BASE_URL" node e2e/spec.mjs
