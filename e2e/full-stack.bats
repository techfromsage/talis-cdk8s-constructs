#!/usr/bin/env bats
load "lib/utils"
load "lib/detik"
load "lib/test_helper"

: "${CIRCLE_BUILD_NUM:=local}"

setup_file() {
  cd "$(dirname "$BATS_TEST_FILENAME")" || exit 1
  set_detik_client
  cdk8s_synth full-stack.e2e.ts dist-full-stack
  run_kubectl apply -f dist-full-stack/*.yaml
}

teardown_file() {
  cd "$(dirname "$BATS_TEST_FILENAME")" || exit 1
  run_kubectl delete -f dist-full-stack/*.yaml --now=true --wait=false
}

@test "full-stack: verify BackgroundWorker deployment" {
  verify "there is 1 deployment named 'bg-worker'"
  try "at most 20 times every 10s to find 2 pods named 'bg-worker' with 'status' being 'running'"
}

@test "full-stack: verify CronJob deployment" {
  verify "there is 1 cronjob named 'cron-job'"
  try "at most 20 times every 30s to get pods named 'cron-job' and verify that 'status' is 'succeeded'"
}

@test "full-stack: verify Job deployment" {
  verify "there is 1 job named 'single-job'"
  try "at most 20 times every 30s to get pods named 'single-job' and verify that 'status' is 'succeeded'"
}

@test "full-stack: verify ResqueWeb deployment" {
  verify "there is 1 deployment named 'resque-web'"
  verify "there is 1 service named 'resque-web-service'"
  verify "there is 1 ingress named 'resque-web-ingress'"
  try "at most 20 times every 10s to find 1 pod named 'resque-web' with 'status' being 'running'"
}

@test "full-stack: verify ResqueWeb load balancer" {
  attempts=20 delay=10 run get_property ".status.loadBalancer.ingress[0].hostname" "ingress" "resque-web-ingress"
  alb_hostname="$output"
  assert_contains "$alb_hostname" "internal-"
  assert_contains "$alb_hostname" ".elb.amazonaws.com"
}

@test "full-stack: verify WebService deployment" {
  verify "there is 1 deployment named 'web-svc'"
  verify "there is 1 service named 'web-svc-service'"
  verify "there is 1 ingress named 'web-svc-ingress'"
  try "at most 20 times every 10s to find 2 pods named 'web-svc' with 'status' being 'running'"
}

@test "full-stack: verify WebService load balancer" {
  attempts=20 delay=10 run get_property ".status.loadBalancer.ingress[0].hostname" "ingress" "web-svc-ingress"
  alb_hostname="$output"
  assert_contains "$alb_hostname" ".elb.amazonaws.com"

  run http_get "http://${alb_hostname}/env"
  assert_contains "$output" "WATERMARK=${CIRCLE_BUILD_NUM}"
}

@test "full-stack: verify WebService external DNS" {
  run http_get "https://cdk8s-e2e-${CIRCLE_BUILD_NUM}-web-service.talis.io/env"
  assert_contains "$output" "WATERMARK=${CIRCLE_BUILD_NUM}"

  # Additional external DNS
  run http_get "https://cdk8s-e2e-${CIRCLE_BUILD_NUM}-extra.talis.io/env"
  assert_contains "$output" "WATERMARK=${CIRCLE_BUILD_NUM}"
}
