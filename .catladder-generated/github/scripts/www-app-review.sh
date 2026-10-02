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
collapseable_section_end "injectvars"
collapseable_section_start "write-dotenv-www" "write dot env for www"
cat <<EOF > apps/www/.env
ENV_SHORT=review
APP_DIR=apps/www
ENV_TYPE=review
HOSTNAME=$(printf %s "$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')" | escapeForDotEnv)
ROOT_URL=$(printf %s "https://$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')" | escapeForDotEnv)
HOSTNAME_INTERNAL=$(printf %s "$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')" | escapeForDotEnv)
ROOT_URL_INTERNAL=$(printf %s "https://$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www-209161739498.europe-west6.run.app" | awk '{print tolower($0)}')" | escapeForDotEnv)
DEPLOY_CLOUD_RUN_SERVICE_NAME=$(printf %s "$(printf %s "pan-evermore-review-$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")-www" | awk '{print tolower($0)}')" | escapeForDotEnv)
DEPLOY_CLOUD_RUN_PROJECT_ID=maw-evermore
DEPLOY_CLOUD_RUN_REGION=europe-west6
GCLOUD_DEPLOY_credentialsKey=$(printf %s "$CL_review_www_GCLOUD_DEPLOY_credentialsKey" | escapeForDotEnv)
_ALL_ENV_VAR_KEYS=["ENV_SHORT","APP_DIR","ENV_TYPE","BUILD_INFO_BUILD_ID","BUILD_INFO_BUILD_TIME","BUILD_INFO_CURRENT_VERSION","HOSTNAME","ROOT_URL","HOSTNAME_INTERNAL","ROOT_URL_INTERNAL","DEPLOY_CLOUD_RUN_SERVICE_NAME","DEPLOY_CLOUD_RUN_PROJECT_ID","DEPLOY_CLOUD_RUN_REGION","GCLOUD_DEPLOY_credentialsKey"]
EOF
collapseable_section_end "write-dotenv-www"
echo '{"id":"$(git describe --tags 2>/dev/null || git rev-parse HEAD)","time":"unknown-build-time"}' > apps/www/__build_info.json
collapseable_section_start "nodeinstall" "Ensure node version"
if [ -f "$HOME/.nvm/nvm.sh" ]; then source "$HOME/.nvm/nvm.sh"; elif [ -f /root/.nvm/nvm.sh ]; then export NVM_DIR=/root/.nvm; source /root/.nvm/nvm.sh; fi
if command -v nvm &> /dev/null && [ -f ./.nvmrc ]; then nvm install; fi
collapseable_section_end "nodeinstall"
cd apps/www
collapseable_section_start "nodeinstall" "Ensure node version"
if [ -f "$HOME/.nvm/nvm.sh" ]; then source "$HOME/.nvm/nvm.sh"; elif [ -f /root/.nvm/nvm.sh ]; then export NVM_DIR=/root/.nvm; source /root/.nvm/nvm.sh; fi
if command -v nvm &> /dev/null && [ -f ./.nvmrc ]; then nvm install; fi
collapseable_section_end "nodeinstall"
collapseable_section_start "pnpminstall" "pnpm install"
if ! command -v pnpm &> /dev/null; then corepack enable pnpm 2>/dev/null || npm install -g pnpm@11.28.2; fi
pnpm install --frozen-lockfile
collapseable_section_end "pnpminstall"
pnpm build
