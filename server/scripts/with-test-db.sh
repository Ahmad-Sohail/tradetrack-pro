#!/bin/bash
# Starts FerretDB (Mongo wire compatible, SQLite) + the API, runs a command, then cleans up.
rm -rf /tmp/ferretdata && mkdir -p /tmp/ferretdata
/tmp/ferret --handler=sqlite --sqlite-url=file:/tmp/ferretdata/ --listen-addr=127.0.0.1:27017 --telemetry=disable > /tmp/ferret.log 2>&1 &
F=$!
sleep 3
cd "$(dirname "$0")/.."
node src/index.js > /tmp/api.log 2>&1 &
A=$!
for i in $(seq 1 20); do curl -s localhost:4000/health >/dev/null && break; sleep 1; done
"$@"; RC=$?
kill $A $F 2>/dev/null
exit $RC
