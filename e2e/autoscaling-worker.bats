#!/usr/bin/env bats
load "lib/utils"
load "lib/detik"
load "lib/test_helper"

: "${CIRCLE_BUILD_NUM:=local}"

setup_file() {
  cd "$(dirname "$BATS_TEST_FILENAME")" || exit 1
  set_detik_client
  cdk8s_synth autoscaling-worker.e2e.ts dist-autoscaling-worker
  run_kubectl apply -f dist-autoscaling-worker/*.yaml
}

teardown_file() {
  cd "$(dirname "$BATS_TEST_FILENAME")" || exit 1
  run_kubectl delete -f dist-autoscaling-worker/*.yaml --now=true --wait=false
}

@test "autoscaling-worker: verify scaling from zero to max and back to zero" {
  verify "there is 1 deployment named 'worker'"

  # check that the deployment has no pods to start with
  try "at most 20 times every 10s to find 0 pods named 'worker' with 'status' being 'running'"

  # check that the deployment has 1 replica with 1 message on the list A
  run_kubectl create job --from=cronjob/append-to-list-a append-to-list-a-001
  try "at most 20 times every 10s to find 1 pod named 'worker' with 'status' being 'running'"

  # check that the deployment still has 1 replica with 5 messages on the list A
  run_kubectl create job --from=cronjob/append-to-list-a append-to-list-a-002
  run_kubectl create job --from=cronjob/append-to-list-a append-to-list-a-003
  run_kubectl create job --from=cronjob/append-to-list-a append-to-list-a-004
  run_kubectl create job --from=cronjob/append-to-list-a append-to-list-a-005
  try "at most 20 times every 10s to find 1 pod named 'worker' with 'status' being 'running'"

  # check that the deployment has scaled to 2 replicas with >5 messages on the list A
  run_kubectl create job --from=cronjob/append-to-list-a append-to-list-a-006
  try "at most 20 times every 10s to find 2 pods named 'worker' with 'status' being 'running'"

  # check that the deployment has scaled to 3 replicas with 3 messages on the list B
  run_kubectl create job --from=cronjob/append-to-list-b append-to-list-b-001
  run_kubectl create job --from=cronjob/append-to-list-b append-to-list-b-002
  run_kubectl create job --from=cronjob/append-to-list-b append-to-list-b-003
  try "at most 20 times every 10s to find 3 pods named 'worker' with 'status' being 'running'"

  # check that the deployment stays at 3 replicas with >3 messages on the list
  run_kubectl create job --from=cronjob/append-to-list-b append-to-list-b-004
  try "at most 20 times every 10s to find 3 pods named 'worker' with 'status' being 'running'"

  # check that the deployment scaled down to 0 replicas with 0 messages on the lists
  run_kubectl create job --from=cronjob/clear-lists clear-lists-001
  try "at most 20 times every 10s to find 0 pods named 'worker' with 'status' being 'running'"
}
