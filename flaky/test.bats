#!/usr/bin/env bats

@test "addition" {
  result="$((2 + 2))"
  [ "$result" -eq 4 ]
}

@test "flaky test" {
  ((RANDOM % 2))
}
