#!/usr/bin/env bash
# End-to-end check against a running server. Local: Postgres in Docker. Live: BASE=https://YOUR-SERVER.example HMAC_KEY=$(security find-generic-password -s email-tracker-hmac-key -w) ./test.sh
#   docker run -d --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:17
#   DATABASE_URL='postgres://postgres:dev@localhost:5432/postgres?sslmode=disable' HMAC_KEY=dev-key go run .
#   ./test.sh
set -euo pipefail
KEY=${HMAC_KEY:-dev-key}
BASE=${BASE:-http://localhost:8080}
ID="test-$(date +%s)"

# Same as sign() in sign.go: base64url(HMAC-SHA256(key, purpose:id)), no padding.
sig() { printf '%s:%s' "$1" "$ID" | openssl dgst -sha256 -hmac "$KEY" -binary | base64 | tr '+/' '-_' | tr -d '='; }
W=$(sig write); T=$(sig track)
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
check() { [ "$2" = "$3" ] && echo "ok   $1" || { echo "FAIL $1: got $2, want $3"; exit 1; }; }

check "register"          "$(code -X POST "$BASE/mails" -d "{\"id\":\"$ID\",\"sig\":\"$W\",\"subject\":\"Hi\",\"recipients\":[\"a@x.com\",\"b@x.com\"],\"links\":[\"https://example.com\"]}")" 201
check "register forged"   "$(code -X POST "$BASE/mails" -d "{\"id\":\"other\",\"sig\":\"$W\",\"subject\":\"x\",\"recipients\":[],\"links\":[]}")" 401
check "register w/ track sig" "$(code -X POST "$BASE/mails" -d "{\"id\":\"$ID-2\",\"sig\":\"$T\",\"subject\":\"x\",\"recipients\":[],\"links\":[]}")" 401
check "gmail id"          "$(code -X PATCH "$BASE/mails/$ID" -d "{\"sig\":\"$W\",\"gmail_id\":\"g123\"}")" 204
check "open 1"            "$(code "$BASE/o/$ID/$T")" 200
check "open 2"            "$(code "$BASE/o/$ID/$T")" 200
check "open forged"       "$(code "$BASE/o/$ID/nope")" 200   # still returns the pixel, but isn't logged
check "click 1"           "$(code "$BASE/c/$ID/$T/1")" 302
check "click redirect"    "$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/c/$ID/$T/1")" "https://example.com/"
check "click forged"      "$(code "$BASE/c/$ID/nope/1")" 404
check "click no link"     "$(code "$BASE/c/$ID/$T/9")" 404

Q="SELECT (SELECT count(*) FROM opens WHERE mail_id='$ID'), (SELECT count(*) FROM clicks WHERE mail_id='$ID'), (SELECT gmail_id FROM mails WHERE id='$ID')"
if [[ $BASE == http://localhost* ]]; then
  check "db opens,clicks,gmail_id" "$(docker exec pg psql -U postgres -tA -F, -c "$Q")" "2,2,g123"
else
  echo "Remote DB: run this in the Supabase SQL editor, expect 2 | 2 | g123:"
  echo "  $Q;"
fi
