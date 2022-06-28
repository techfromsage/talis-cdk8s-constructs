#!/usr/bin/env bats
load "lib/utils"
load "lib/detik"
load "lib/test_helper"

: "${CIRCLE_BUILD_NUM:=local}"

setup_file() {
  cd "$(dirname "$BATS_TEST_FILENAME")" || exit 1
  set_detik_client
  cdk8s_synth rails-app.e2e.ts dist-rails-app
  run_kubectl apply -f dist-rails-app/
}

teardown_file() {
  cd "$(dirname "$BATS_TEST_FILENAME")" || exit 1
  run_kubectl delete -f dist-rails-app/ --now=true --wait=false
}

@test "rails-app: verify Postgres is running" {
  verify "there is 1 statefulSet named 'postgres-sts'"
  verify "there is 1 service named 'postgres'"
  try "at most 30 times every 10s to find 1 pod named 'postgres-sts-0' with 'status' being 'running'"
}

@test "rails-app: verify Memcached is running" {
  verify "there is 1 statefulSet named 'memcached-sts'"
  verify "there is 1 service named 'memcached'"
  try "at most 30 times every 10s to find 1 pod named 'memcached-sts-0' with 'status' being 'running'"
}

@test "rails-app: verify Redmine deployment" {
  verify "there is 1 deployment named 'redmine'"
  verify "there is 1 service named 'redmine-service'"
  try "at most 30 times every 10s to find 1 pod named 'redmine' with 'status' being 'running'"
}
