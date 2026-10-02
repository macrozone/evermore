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
export ENV_SHORT="prod"
export APP_DIR="apps/www"
export ENV_TYPE="prod"
export BUILD_INFO_BUILD_ID="$(git describe --tags 2>/dev/null || git rev-parse HEAD)"
export BUILD_INFO_BUILD_TIME="unknown-build-time"
export BUILD_INFO_CURRENT_VERSION="$(tag=$(git ls-remote origin "refs/tags/v*[0-9]" 2>/dev/null | cut -f 2- | sort -V | tail -1 | sed 's/refs\/tags\/v//'); [ -z "$tag" ] && echo "0.0.0" || echo "$tag")"
export HOSTNAME="pan-evermore-prod-www-209161739498.europe-west6.run.app"
export ROOT_URL="https://pan-evermore-prod-www-209161739498.europe-west6.run.app"
export HOSTNAME_INTERNAL="pan-evermore-prod-www-209161739498.europe-west6.run.app"
export ROOT_URL_INTERNAL="https://pan-evermore-prod-www-209161739498.europe-west6.run.app"
export DEPLOY_CLOUD_RUN_SERVICE_NAME="pan-evermore-prod-www"
export DEPLOY_CLOUD_RUN_PROJECT_ID="maw-evermore"
export DEPLOY_CLOUD_RUN_REGION="europe-west6"
export GCLOUD_DEPLOY_credentialsKey="$CL_prod_www_GCLOUD_DEPLOY_credentialsKey"
export _ALL_ENV_VAR_KEYS="[\"ENV_SHORT\",\"APP_DIR\",\"ENV_TYPE\",\"BUILD_INFO_BUILD_ID\",\"BUILD_INFO_BUILD_TIME\",\"BUILD_INFO_CURRENT_VERSION\",\"HOSTNAME\",\"ROOT_URL\",\"HOSTNAME_INTERNAL\",\"ROOT_URL_INTERNAL\",\"DEPLOY_CLOUD_RUN_SERVICE_NAME\",\"DEPLOY_CLOUD_RUN_PROJECT_ID\",\"DEPLOY_CLOUD_RUN_REGION\",\"GCLOUD_DEPLOY_credentialsKey\"]"
collapseable_section_end "injectvars"
collapseable_section_start "write-dotenv-www" "write dot env for www"
cat <<EOF > apps/www/.env
ENV_SHORT=prod
APP_DIR=apps/www
ENV_TYPE=prod
HOSTNAME=pan-evermore-prod-www-209161739498.europe-west6.run.app
ROOT_URL=https://pan-evermore-prod-www-209161739498.europe-west6.run.app
HOSTNAME_INTERNAL=pan-evermore-prod-www-209161739498.europe-west6.run.app
ROOT_URL_INTERNAL=https://pan-evermore-prod-www-209161739498.europe-west6.run.app
DEPLOY_CLOUD_RUN_SERVICE_NAME=pan-evermore-prod-www
DEPLOY_CLOUD_RUN_PROJECT_ID=maw-evermore
DEPLOY_CLOUD_RUN_REGION=europe-west6
GCLOUD_DEPLOY_credentialsKey=$(printf %s "$CL_prod_www_GCLOUD_DEPLOY_credentialsKey" | escapeForDotEnv)
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
