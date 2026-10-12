#!/usr/bin/env bash
# End-to-end check against a running server; deletes its test email afterwards.
# Local: Postgres in Docker.
#   docker run -d --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:17
#   DATABASE_URL='postgres://postgres:dev@localhost:5432/postgres?sslmode=disable' HMAC_KEY=dev-key GOOGLE_CLIENT_ID=x OWNER_EMAIL=a@test.dev,b@test.dev DASHBOARD_ORIGIN=http://localhost:5199 go run .
#   ./test.sh
# Live: BASE=https://YOUR-FLY-APP.fly.dev HMAC_KEY=... DATABASE_URL=... A=you@gmail.com B=your-other@gmail.com ./test.sh
# A and B must be two different accounts in the server's OWNER_EMAIL.
set -euo pipefail
KEY=${HMAC_KEY:-dev-key}
BASE=${BASE:-http://localhost:8080}
ID="test-$(date +%s)"
if [[ $BASE == http://localhost* ]]; then psql() { docker exec pg psql -U postgres -tA -F, -c "$1"; }
else psql() { command psql "$DATABASE_URL" -tA -F, -c "$1"; }; fi
trap 'psql "DELETE FROM clicks WHERE mail_id LIKE '"'$ID%'"'; DELETE FROM opens WHERE mail_id LIKE '"'$ID%'"'; DELETE FROM links WHERE mail_id LIKE '"'$ID%'"'; DELETE FROM mails WHERE id LIKE '"'$ID%'"'" >/dev/null' EXIT

# Same as sign() in sign.go: base64url(HMAC-SHA256(key, purpose:msg)), no padding.
sig() { printf '%s:%s' "$1" "$2" | openssl dgst -sha256 -hmac "$KEY" -binary | base64 | tr '+/' '-_' | tr -d '='; }
T=$(sig track "$ID")
A=${A:-a@test.dev}; B=${B:-b@test.dev}
FUT=$(( $(date +%s) + 3600 )); PAST=$(( $(date +%s) - 1 ))
session() { echo "$1.$2.$(sig session "$1.$2")"; } # as the server hands out after Google sign-in
S=$(session $FUT $A); SB=$(session $FUT $B)
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
check() { [ "$2" = "$3" ] && echo "ok   $1" || { echo "FAIL $1: got $2, want $3"; exit 1; }; }
mail() { echo "{\"id\":\"$1\",\"subject\":\"Hi\",\"recipients\":[\"a@x.com\",\"b@x.com\"],\"links\":[\"https://example.com\"]}"; }

check "register"          "$(curl -s -X POST -H "Authorization: Bearer $S" "$BASE/mails" -d "$(mail "$ID")")" "{\"track_sig\":\"$T\"}"
check "register signed out" "$(code -X POST "$BASE/mails" -d "$(mail "$ID-2")")" 401
check "register expired"  "$(code -X POST -H "Authorization: Bearer $(session $PAST $A)" "$BASE/mails" -d "$(mail "$ID-3")")" 401
check "register non-owner" "$(code -X POST -H "Authorization: Bearer $(session $FUT stranger@test.dev)" "$BASE/mails" -d "$(mail "$ID-5")")" 401
check "register track sig as session" "$(code -X POST -H "Authorization: Bearer $ID.$T" "$BASE/mails" -d "$(mail "$ID-4")")" 401
check "register bad id"   "$(code -X POST -H "Authorization: Bearer $S" "$BASE/mails" -d "$(mail "a/b")")" 400
check "open 1"            "$(code "$BASE/o/$ID/$T")" 200
check "open again at once" "$(code "$BASE/o/$ID/$T")" 200 # within a minute: not counted
check "open forged"       "$(code "$BASE/o/$ID/nope")" 200   # still returns the pixel, but isn't logged
check "open Gmail scan"   "$(code -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246 Mozilla/5.0' "$BASE/o/$ID/$T")" 200 # not logged
check "click 1"           "$(code "$BASE/c/$ID/$T/1")" 302
check "click redirect"    "$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/c/$ID/$T/1")" "https://example.com/"
check "click forged"      "$(code "$BASE/c/$ID/nope/1")" 404
check "click no link"     "$(code "$BASE/c/$ID/$T/9")" 404

check "stats no token"    "$(code "$BASE/stats")" 401
check "stats session"     "$(code -H "Authorization: Bearer $S" "$BASE/stats")" 200
check "stats renews session" "$(curl -s -D - -o /dev/null -H "Authorization: Bearer $S" "$BASE/stats" | grep -ci "^x-session: [0-9]*\.$A\.")" 1
check "stats: sender sees it" "$(curl -s -H "Authorization: Bearer $S" "$BASE/stats" | grep -c "\"$ID\"")" 1
check "stats: other account doesn't" "$(curl -s -H "Authorization: Bearer $SB" "$BASE/stats" | grep -c "\"$ID\"" || true)" 0
check "stats expired"     "$(code -H "Authorization: Bearer $(session $PAST $A)" "$BASE/stats")" 401
check "stats forged"      "$(code -H "Authorization: Bearer $FUT.$A.$(sig session "$PAST.$A")" "$BASE/stats")" 401
check "stats email swapped" "$(code -H "Authorization: Bearer $FUT.$B.$(sig session "$FUT.$A")" "$BASE/stats")" 401
check "stats track sig"   "$(code -H "Authorization: Bearer $ID.$T" "$BASE/stats")" 401

check "db sender,opens,clicks" "$(psql "SELECT (SELECT sender FROM mails WHERE id='$ID'), (SELECT count(*) FROM opens WHERE mail_id='$ID'), (SELECT count(*) FROM clicks WHERE mail_id='$ID')")" "$A,1,2"
