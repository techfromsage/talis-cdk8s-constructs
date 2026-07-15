#!/bin/bash
# Installs DETIK: DevOps e2e Testing in Kubernetes

set -e
cd "$(dirname "$0")"/lib

# https://github.com/bats-core/bats-detik#manual-setup
curl -sSLO https://raw.githubusercontent.com/bats-core/bats-detik/v1.4.0/lib/detik.bash
curl -sSLO https://raw.githubusercontent.com/bats-core/bats-detik/v1.4.0/lib/linter.bash
curl -sSLO https://raw.githubusercontent.com/bats-core/bats-detik/v1.4.0/lib/utils.bash
chmod +x ./*.bash
