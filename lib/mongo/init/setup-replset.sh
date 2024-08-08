#!/bin/bash

set -eo pipefail

help() {
  cat <<EOS
Script to initiate a MongoDB replica set.

Usage:
setup-replset.sh [OPTION]... [RS_NAME] [MEMBERS] <mongo CLI arguments>

Options:
  -h, --help            Display this message and exit.
      --no-init         Don't initialize the replica set, only wait for it.

Arguments:
- RS_NAME - name of the replica set.
- MEMBERS - hostnames/ip addresses (and optional :port)
            of replica set members, comma-separated.

Example:
$0 rs0 mongo-1.domain:27017,mongo-2.domain:27017
EOS
}

DO_INIT=true
RS_NAME=
MEMBERS=
MONGO_OPTS=()
END_OF_OPTIONS=false

arg_num=0
while [ "$#" -gt 0 ]; do
  if [[ "$END_OF_OPTIONS" == "true" ]]; then
    MONGO_OPTS+=("$1")
  else
    case "$1" in
    -h | --help)
      help
      exit 0
      ;;
    --no-init) DO_INIT=false ;;
    *)
      arg_num=$((arg_num + 1))
      case "$arg_num" in
      1) RS_NAME="$1" ;;
      2)
        MEMBERS="$1"
        END_OF_OPTIONS=true
        ;;
      esac
      ;;
    esac
  fi
  shift
done

if [[ -z "$RS_NAME" || -z "$MEMBERS" ]]; then
  help
  exit 1
fi

IFS=',' read -r -a MEMBERS_ARR <<<"$MEMBERS"
INITIATOR=${MEMBERS_ARR[0]}
MEMBERS_JS=''
for i in "${!MEMBERS_ARR[@]}"; do
  MEMBERS_JS="${MEMBERS_JS}$(printf '{ _id: %d, host: "%s" },' "$i" "${MEMBERS_ARR[$i]}")"
done

MONGO_CLI="$(command -v mongo mongosh | head -n1)"
_mongo() {
  "$MONGO_CLI" --quiet "${MONGO_OPTS[@]}" --host "$@"
}

for member in "${MEMBERS_ARR[@]}"; do
  echo >&2 "Waiting for $member"
  timeout=300
  until _mongo "$member" <<<'db.adminCommand("ping")' | grep 'ok'; do
    sleep 1
    ((timeout = timeout - 1))
    if [[ "$timeout" -eq 0 ]]; then
      echo >&2 "Could not connect to $member"
      exit 1
    fi
  done
done

if [[ "$DO_INIT" == "true" ]]; then
  echo >&2 "Initiating replica set $RS_NAME..."
  _mongo "$INITIATOR" <<<"$(printf 'rs.initiate({ _id: "%s", members: [%s] })' "$RS_NAME" "$MEMBERS_JS")" |
    tee /dev/stderr | grep -q -E 'ok|already initialized'
fi

echo >&2 'Waiting for primary...'
_mongo "$INITIATOR" <<<'while (true) { if (rs.status().members.some(({ state }) => state === 1)) { break; } sleep(1000); }'

echo >&2 'Waiting for secondaries...'
_mongo "$INITIATOR" <<<'while (true) { if (rs.status().members.every(({state}) => state === 1 || state === 2)) { break; } sleep(1000); }'

echo >&2 'Checking status...'
_mongo "$INITIATOR" <<<'rs.status();' | tee /dev/stderr | grep -q "$RS_NAME"

echo >&2 "Replica set $RS_NAME configured!"
