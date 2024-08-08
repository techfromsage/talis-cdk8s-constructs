#!/usr/bin/env bats

@test "addition" {
  result="$((3 + 3))"
  [ "$result" -eq 6 ]
}
