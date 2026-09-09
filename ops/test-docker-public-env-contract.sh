#!/bin/sh

set -eu

contract_key='NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY'
contract_sentinel='koala-web-111-public-build-sentinel'
contract_suffix="$$"
contract_builder_image="koala-web-docker-contract:builder-${contract_suffix}"
contract_final_image="koala-web-docker-contract:final-${contract_suffix}"
contract_no_map_image="koala-web-docker-contract:no-map-${contract_suffix}"
contract_container="koala-web-docker-contract-${contract_suffix}"

cleanup() {
  docker rm --force "$contract_container" >/dev/null 2>&1 || true
  docker image rm \
    "$contract_builder_image" \
    "$contract_final_image" \
    "$contract_no_map_image" >/dev/null 2>&1 || true
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

assert_absent() {
  contract_value="$1"
  contract_location="$2"

  case "$contract_value" in
    *"$contract_key"*|*"$contract_sentinel"*)
      fail "Maps build girdisi ${contract_location} içinde kaldı."
      ;;
  esac
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

docker info >/dev/null 2>&1 || fail 'Docker daemon çalışmıyor.'

docker build --quiet \
  --target builder \
  --build-arg NEXT_PUBLIC_SITE_URL=https://docker-contract.invalid \
  --build-arg NEXT_PUBLIC_APP_URL_SCHEME=koala-dev \
  --build-arg NEXT_PUBLIC_ANDROID_PACKAGE_ID=com.iskoala.koala.dev \
  --build-arg "${contract_key}=${contract_sentinel}" \
  --build-arg NEXT_PUBLIC_SENTRY_ENVIRONMENT=docker-contract \
  --tag "$contract_builder_image" \
  . >/dev/null

contract_builder_env="$(
  docker image inspect "$contract_builder_image" \
    --format '{{range .Config.Env}}{{println .}}{{end}}'
)"
printf '%s\n' "$contract_builder_env" |
  grep -Fx "${contract_key}=${contract_sentinel}" >/dev/null ||
  fail 'Maps build arg builder ENV alanına ulaşmadı.'
docker run --rm --entrypoint sh "$contract_builder_image" \
  -c 'grep -R -F "$1" /app/.next/static >/dev/null' \
  sh "$contract_sentinel" ||
  fail 'Maps build arg değeri derlenmiş client çıktısına ulaşmadı.'

docker build --quiet \
  --build-arg NEXT_PUBLIC_SITE_URL=https://docker-contract.invalid \
  --build-arg NEXT_PUBLIC_APP_URL_SCHEME=koala-dev \
  --build-arg NEXT_PUBLIC_ANDROID_PACKAGE_ID=com.iskoala.koala.dev \
  --build-arg "${contract_key}=${contract_sentinel}" \
  --build-arg NEXT_PUBLIC_SENTRY_ENVIRONMENT=docker-contract \
  --tag "$contract_final_image" \
  . >/dev/null

contract_final_env="$(
  docker image inspect "$contract_final_image" \
    --format '{{range .Config.Env}}{{println .}}{{end}}'
)"
assert_absent "$contract_final_env" 'final image Config.Env alanı'

contract_final_labels="$(
  docker image inspect "$contract_final_image" --format '{{json .Config.Labels}}'
)"
assert_absent "$contract_final_labels" 'final image label metadata alanı'

contract_final_metadata="$(docker image inspect "$contract_final_image")"
assert_absent "$contract_final_metadata" 'final image metadata alanı'

contract_final_history="$(docker history --no-trunc "$contract_final_image")"
assert_absent "$contract_final_history" 'final image geçmişi'

contract_runtime_env="$(
  docker run --rm --entrypoint env "$contract_final_image"
)"
assert_absent "$contract_runtime_env" 'çalışan container env alanı'

docker build --quiet \
  --build-arg NEXT_PUBLIC_SITE_URL=https://docker-contract.invalid \
  --build-arg NEXT_PUBLIC_APP_URL_SCHEME=koala-dev \
  --build-arg NEXT_PUBLIC_ANDROID_PACKAGE_ID=com.iskoala.koala.dev \
  --build-arg NEXT_PUBLIC_SENTRY_ENVIRONMENT=docker-contract \
  --tag "$contract_no_map_image" \
  . >/dev/null

docker run --detach --rm \
  --name "$contract_container" \
  --env API_URL=https://api.docker-contract.invalid \
  --env APP_VERSION=0.1.0 \
  --env GIT_SHA=docker-contract \
  "$contract_no_map_image" >/dev/null

contract_health=''
contract_attempt=0
while [ "$contract_attempt" -lt 30 ]; do
  if contract_health="$(
    docker exec "$contract_container" \
      wget -qO- http://127.0.0.1:3000/api/health 2>/dev/null
  )"; then
    break
  fi
  contract_attempt=$((contract_attempt + 1))
  sleep 1
done

[ -n "$contract_health" ] || {
  docker logs "$contract_container" >&2 || true
  fail 'Maps anahtarı olmadan başlayan container sağlık yanıtı vermedi.'
}

node -e '
  const health = JSON.parse(process.argv[1]);
  if (
    health.status !== "ok" ||
    health.version !== "0.1.0" ||
    health.commitSha !== "docker-contract"
  ) {
    process.exit(1);
  }
' "$contract_health" || fail 'Container sağlık yanıtı beklenen sözleşmeyle uyuşmuyor.'

printf '%s\n' 'Docker public env sözleşmesi doğrulandı.'
