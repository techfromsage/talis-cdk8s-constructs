#!/bin/bash
### Script to initiate a MongoDB replica set.
###
### Usage:
### setup-replset.sh [RS_NAME] [MEMBERS] <mongo CLI arguments>
###
### Arguments:
### - RS_NAME - name of the replica set.
### - MEMBERS - hostnames/ip addresses (and optional :port)
###             of replica set members, comma-separated.
###
### Example:
### setup-replset.sh rs0 mongo-1.domain:27017,mongo-2.domain:27017
###

set -Eeuo pipefail

help() {
  awk -F'### ' '/^###/ { print $2 }' "$0"
}

RS_NAME=$1
MEMBERS=$2
shift 2

if [[ -z "$RS_NAME" || -z "$MEMBERS" ]]; then
  help
  exit 1
fi

IFS=',' read -r -a MEMBERS_ARR <<<"$MEMBERS"
if [[ "${#MEMBERS_ARR[@]}" -lt 1 ]]; then
  echo >&2 "MEMBERS must contain replica set member hostnames"
  exit 1
fi

FIRST_MEMBER=${MEMBERS_ARR[0]}

MONGO_CLI=$(command -v mongosh mongo | head -n1)
MONGO_OPTS=(--host "$FIRST_MEMBER" "$@")

# Check if we can connect
for _ in $(seq 300); do
  if "$MONGO_CLI" "${MONGO_OPTS[@]}" --eval 'db.adminCommand("ping")' >/dev/null 2>&1; then
    break
  else
    printf '.'
    sleep 1
  fi
done

# Is it already a replica set?
if "$MONGO_CLI" "${MONGO_OPTS[@]}" --eval 'rs.secondaryOk(); rs.conf();' 2>/dev/null; then
  echo "Already a replica set"
  exit
fi

MEMBERS_JS=$(
  jq --null-input --arg 'str' "$MEMBERS" "$(
    cat <<'EOS'
$str | split(",") | [range(length) as $i | .[$i] | {
  _id: $i,
  host: (. | if contains(":") then . else "\(.):27017" end),
}]
EOS
  )"
)

"$MONGO_CLI" "${MONGO_OPTS[@]}" <<EOS
  rs.initiate({
    _id: "$RS_NAME",
    members: $MEMBERS_JS,
    settings: { chainingAllowed: true },
  });
  for (let s = 0; s < 300; s++) {
    sleep(1);
    if (rs.status().members.every(({state}) => state == 1 || state == 2)) {
      break;
    }
  }
  rs.status();
EOS
