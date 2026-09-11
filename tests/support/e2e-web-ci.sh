#!/bin/sh
# CI e2e üretim sunucusu. `next dev` Pi'de abort ediyor; `next start`
# `output: standalone` ile uyumsuz. Docker ile aynı düzen: server.js'in
# yanında public ve .next/static.
set -e
root="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
cd "$root"
rm -rf .next/standalone/.next/static .next/standalone/public
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
cp -R public .next/standalone/public
cd .next/standalone
exec node server.js
