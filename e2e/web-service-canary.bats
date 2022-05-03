#!/usr/bin/env bats
load "lib/utils"
load "lib/detik"
load "lib/test_helper"

setup_file() {
  cd "$(dirname "$BATS_TEST_FILENAME")" || exit 1
  set_detik_client
  PODINFO_VERSION=6.1.2 STAGE=base cdk8s_synth web-service-canary.e2e.ts dist-web-service-stage-base
  PODINFO_VERSION=6.1.3 STAGE=canary cdk8s_synth web-service-canary.e2e.ts dist-web-service-stage-canary
  run_kubectl apply -f dist-web-service-stage-base/
}

teardown_file() {
  cd "$(dirname "$BATS_TEST_FILENAME")" || exit 1
  run_kubectl delete -f dist-web-service-stage-base/ --now=true --wait=false
}

@test "web-service-canary: verify WebService deployment" {
  # DETIK matches resource names with grep, so it will see two deployments
  verify "there are 2 deployments named 'web-svc'"
  verify "there is 1 service named 'web-svc-service'"
  verify "there is 1 ingress named 'web-svc-ingress'"
  verify "there is 1 deployment named 'web-svc-canary'"
  verify "there is 1 service named 'web-svc-canary-service'"
  verify "there is 1 ingress named 'web-svc-canary-ingress'"
  try "at most 20 times every 10s to find 3 pods named 'web-svc' with 'status' being 'running'"
  try "at most 20 times every 10s to find 1 pod named 'web-svc-canary' with 'status' being 'running'"
}

@test "web-service-canary: verify WebService canary stage" {
  run_kubectl apply -f dist-web-service-stage-canary/
  run_kubectl rollout status deployment web-svc-canary --watch

  attempts=10 delay=10 run get_property ".status.loadBalancer.ingress[0].hostname" "ingress" "web-svc-ingress"
  alb_hostname="$output"
  assert_contains "$alb_hostname" ".elb.amazonaws.com"

  attempts=10 delay=10 run get_property ".status.loadBalancer.ingress[0].hostname" "ingress" "web-svc-canary-ingress"
  alb_canary_hostname="$output"
  assert_contains "$alb_canary_hostname" ".elb.amazonaws.com"

  assert_not_equal "$alb_hostname" "$alb_canary_hostname"

  run http_get "http://${alb_hostname}/version"
  assert_contains "$output" "6.1.2"

  run http_get "http://${alb_canary_hostname}/version"
  assert_contains "$output" "6.1.3"
}
