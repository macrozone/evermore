#!/usr/bin/env bash
set -eo pipefail

function escapeForDotEnv () {
input="${1:-$(cat)}"
 input="${input//$'\n'/\\n}"
  if [[ "$input" == *\\n* ]]; then
    if [[ "$input" == *\"* && "$input" == *\'* && "$input" == *\`* ]]; then
      printf "\"%s\"\n" "$input" 
    elif [[ "$input" == *\"* && "$input" == *\'* ]]; then
      printf "`%s`\n" "$input"
    elif [[ "$input" == *\"* ]]; then
      printf "'%s'\n" "$input"
    else
      printf "\"%s\"\n" "$input"
    fi
  else
    printf "%s\n" "$input"
  fi
}
function collapseable_section_start () {
local section_title="${1}"
  local section_description="${2:-$section_title}"
  echo "::group::${section_description}"
}
function collapseable_section_end () {
echo "::endgroup::"
}
collapseable_section_start "injectvars" "Injecting variables"
export ENV_SHORT="review"
export APP_DIR="apps/www"
export ENV_TYPE="review"
export BUILD_INFO_BUILD_ID="$(git describe --tags 2>/dev/null || git rev-parse HEAD)"
export BUILD_INFO_BUILD_TIME="unknown-build-time"
export BUILD_INFO_CURRENT_VERSION="$(tag=$(git ls-remote origin "refs/tags/v*[0-9]" 2>/dev/null | cut -f 2- | sort -V | tail -1 | sed 's/refs\/tags\/v//'); [ -z "$tag" ] && echo "0.0.0" || echo "$tag")"
export HOSTNAME="$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')"
export ROOT_URL="https://$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')"
export HOSTNAME_INTERNAL="$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')"
export ROOT_URL_INTERNAL="https://$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')"
export DEPLOY_CLOUD_RUN_SERVICE_NAME="$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www" | awk '{print tolower($0)}')"
export DEPLOY_CLOUD_RUN_PROJECT_ID="maw-evermore"
export DEPLOY_CLOUD_RUN_REGION="europe-west6"
export GCLOUD_DEPLOY_credentialsKey="$CL_review_www_GCLOUD_DEPLOY_credentialsKey"
export _ALL_ENV_VAR_KEYS="[\"ENV_SHORT\",\"APP_DIR\",\"ENV_TYPE\",\"BUILD_INFO_BUILD_ID\",\"BUILD_INFO_BUILD_TIME\",\"BUILD_INFO_CURRENT_VERSION\",\"HOSTNAME\",\"ROOT_URL\",\"HOSTNAME_INTERNAL\",\"ROOT_URL_INTERNAL\",\"DEPLOY_CLOUD_RUN_SERVICE_NAME\",\"DEPLOY_CLOUD_RUN_PROJECT_ID\",\"DEPLOY_CLOUD_RUN_REGION\",\"GCLOUD_DEPLOY_credentialsKey\"]"
export DOCKER_REGISTRY="europe-west6-docker.pkg.dev"
export DOCKER_IMAGE="europe-west6-docker.pkg.dev/maw-evermore/catladder-deploy/pan-evermore/review/www/$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")"
export DOCKER_CACHE_IMAGE="europe-west6-docker.pkg.dev/maw-evermore/catladder-deploy/pan-evermore/caches/www"
export DOCKER_IMAGE_TAG="$GITHUB_SHA"
export CLOUDSDK_CORE_DISABLE_PROMPTS="1"
collapseable_section_end "injectvars"
collapseable_section_start "prepare" "Prepare..."
gcloud auth activate-service-account --key-file=<(echo "$CL_review_www_GCLOUD_DEPLOY_credentialsKey")
collapseable_section_end "prepare"
collapseable_section_start "writeenvvars" "Write env vars to file"
cat > ____envvars.yaml <<EOF
ENV_SHORT: |-
  review
APP_DIR: |-
  apps/www
ENV_TYPE: |-
  review
BUILD_INFO_BUILD_ID: |-
  $(printf %s "$(git describe --tags 2>/dev/null || git rev-parse HEAD)" | sed '1!s/^/  /')
BUILD_INFO_BUILD_TIME: |-
  unknown-build-time
BUILD_INFO_CURRENT_VERSION: |-
  $(printf %s "$(tag=$(git ls-remote origin "refs/tags/v*[0-9]" 2>/dev/null | cut -f 2- | sort -V | tail -1 | sed 's/refs\/tags\/v//'); [ -z "$tag" ] && echo "0.0.0" || echo "$tag")" | sed '1!s/^/  /')
HOSTNAME: |-
  $(printf %s "$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')" | sed '1!s/^/  /')
ROOT_URL: |-
  $(printf %s "https://$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')" | sed '1!s/^/  /')
HOSTNAME_INTERNAL: |-
  $(printf %s "$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')" | sed '1!s/^/  /')
ROOT_URL_INTERNAL: |-
  $(printf %s "https://$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')" | sed '1!s/^/  /')
DEPLOY_CLOUD_RUN_SERVICE_NAME: |-
  $(printf %s "$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www" | awk '{print tolower($0)}')" | sed '1!s/^/  /')
DEPLOY_CLOUD_RUN_PROJECT_ID: |-
  maw-evermore
DEPLOY_CLOUD_RUN_REGION: |-
  europe-west6
_ALL_ENV_VAR_KEYS: |-
  ["ENV_SHORT","APP_DIR","ENV_TYPE","BUILD_INFO_BUILD_ID","BUILD_INFO_BUILD_TIME","BUILD_INFO_CURRENT_VERSION","HOSTNAME","ROOT_URL","HOSTNAME_INTERNAL","ROOT_URL_INTERNAL","DEPLOY_CLOUD_RUN_SERVICE_NAME","DEPLOY_CLOUD_RUN_PROJECT_ID","DEPLOY_CLOUD_RUN_REGION","GCLOUD_DEPLOY_credentialsKey"]

EOF

collapseable_section_end "writeenvvars"
collapseable_section_start "deploy" "Deploy to cloud run"
gcloud run deploy $(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www" | awk '{print tolower($0)}') --command="pnpm,start" --image=europe-west6-docker.pkg.dev/maw-evermore/catladder-deploy/pan-evermore/review/www/$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown"):$DOCKER_IMAGE_TAG --project=maw-evermore --region=europe-west6 --labels=customer-name=pan,component-name=www,app-name=evermore,env-type=review,env-name=review,build-type=node,cloud-run-service-name=$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www" | awk '{print tolower($0)}') --env-vars-file=____envvars.yaml --min-instances=0 --max-instances=100 --cpu-throttling --allow-unauthenticated --ingress=all --cpu-boost
collapseable_section_end "deploy"
collapseable_section_start "cleanup" "Cleanup"
set +e
gcloud run revisions list --project=maw-evermore --region=europe-west6 --service=$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www" | awk '{print tolower($0)}') --limit=unlimited --sort-by=metadata.creationTimestamp --format="value(name)" --filter='(status.conditions.status=False OR status.conditions.status=Unknown)' | while read -r revisionname; do gcloud run revisions delete --project=maw-evermore --region=europe-west6 --quiet $revisionname ; done
gcloud artifacts docker images list europe-west6-docker.pkg.dev/maw-evermore/catladder-deploy/pan-evermore/review/www/$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown") --sort-by=~CREATE_TIME --format="value(version)" | tail -n +2 | while read -r version; do gcloud artifacts docker images delete europe-west6-docker.pkg.dev/maw-evermore/catladder-deploy/pan-evermore/review/www/$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")@$version --quiet --delete-tags; done
gcloud artifacts docker images list europe-west6-docker.pkg.dev/maw-evermore/catladder-deploy/pan-evermore/caches/www --sort-by=~CREATE_TIME --format="value(version)" | tail -n +2 | while read -r version; do gcloud artifacts docker images delete europe-west6-docker.pkg.dev/maw-evermore/catladder-deploy/pan-evermore/caches/www@$version --quiet --delete-tags; done
set +e
gcloud artifacts docker images delete europe-west6-docker.pkg.dev/maw-evermore/catladder-deploy/pan-evermore/review/www --quiet --delete-tags
set -e
set -e
collapseable_section_end "cleanup"
echo "url=$ROOT_URL" >> "$GITHUB_OUTPUT"
