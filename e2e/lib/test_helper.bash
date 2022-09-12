if ! type build_k8s_request &>/dev/null; then
  echo >&2 -e "\e[91mPlease load test_helper after detik.\e[0m"
  exit 1
fi

# Set the client details for DETIK functions.
set_detik_client() {
  DETIK_CLIENT_NAME="kubectl --context staging-eu"
  export DETIK_CLIENT_NAME
}

# Run kubectl with given options.
run_kubectl() {
  client_with_options=$(build_k8s_client_with_options)
  # shellcheck disable=SC2086,SC2294
  eval $client_with_options "$@"
}

# Run cdk8s synth.
# @param {string} CDK8s app's file path
# @param {string} Output directory where the synth will be stored
# @env SKIP_CDK8S_SYNTH {string} If set, skip doing synth if output directory exists
cdk8s_synth() {
  local file="$1"
  local folder="$2"
  if [ -z "$SKIP_CDK8S_SYNTH" ] || [ ! -d "$folder" ]; then
    npm exec -- cdk8s synth --check-upgrade=false --app "ts-node $file" --output "$folder"
  fi
  DETIK_CLIENT_NAMESPACE=$(grep -m1 -E -o 'namespace: \S+' "$folder"/*.yaml | awk '{print $2}')
  export DETIK_CLIENT_NAMESPACE
}

# Perform a HTTP GET request with a retry.
# @param {string} URL to get
http_get() {
  curl --silent --show-error --fail \
    --retry 20 --retry-delay 10 --retry-max-time 150 --retry-connrefused "$1"
}

# Gets the value of a column.
# @param {string} A K8s column or one of the supported aliases.
# @param {string} The resouce type (e.g. pod).
# @param {string} The resource name
# @env attempts {integer} Number of attempts to get the value (optional)
# @env delay {integer} Delay between attempts (optional)
get_property() {
  property="$1"
  resource="$2"
  name="$3"
  : "${attempts:=1}"
  : "${delay:=1}"

  query=$(build_k8s_request "$property")
  client_with_options=$(build_k8s_client_with_options)

  for ((i = 1; i <= attempts; i++)); do
    # shellcheck disable=SC2086
    result=$(run_kubectl get $resource $name $query --no-headers)
    value=$(echo "$result" | awk '{ print $2 }')

    if [ "$value" != "<none>" ]; then
      echo "$value"
      return
    fi

    sleep "$delay"
  done

  return 1
}

# Assert that two values are equal, and print a diff if they are not.
# @param {string} Actual value
# @param {string} Expected value
assert_equal() {
  local actual=$1
  local expected=$2
  [ "$actual" == "$expected" ] || {
    diff -u --label "actual" <(echo "$actual") --label "expected" <(echo "$expected")
    return 1
  }
}

# Assert that two values are not equal.
# @param {string} Actual value
# @param {string} Expected value
assert_not_equal() {
  local actual=$1
  local expected=$2
  [ "$actual" != "$expected" ] || {
    return 1
  }
}

# Assert that a string contains a substring, and print a diff if it does not.
# @param {string} Haystack
# @param {string} Needle
assert_contains() {
  local haystack=$1
  local needle=$2
  [[ "$haystack" == *"$needle"* ]] || {
    printf "expected '%s' to contain '%s'\n" "$haystack" "$needle"
    return 1
  }
}
