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
export APP_DIR="apps/www"
export DOCKER_BUILD_CONTEXT="."
export DOCKER_REGISTRY="europe-west6-docker.pkg.dev"
export DOCKER_IMAGE="europe-west6-docker.pkg.dev/maw-evermore/catladder-deploy/pan-evermore/review/www/$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")"
export DOCKER_CACHE_IMAGE="europe-west6-docker.pkg.dev/maw-evermore/catladder-deploy/pan-evermore/caches/www"
export DOCKER_IMAGE_TAG="$GITHUB_SHA"
export DOCKER_COPY_AND_INSTALL_APP="COPY --chown=node:node $APP_DIR .
RUN command -v pnpm >/dev/null 2>&1 || npm install -g pnpm@11.28.2
RUN pnpm install --prod --frozen-lockfile --store-dir /tmp/pnpm-store --filter @evermore/www... && rm -rf /tmp/pnpm-store"
export DOCKER_COPY_WORKSPACE_FILES="ADD .catladder-workspace-files.tar /app/
RUN chown -R node:node /app || true"
export DOCKER_SETUP_PACKAGE_MANAGER="RUN npm install -g pnpm@11.28.2"
collapseable_section_end "injectvars"
tar -cf .catladder-workspace-files.tar apps/www/package.json package.json pnpm-lock.yaml pnpm-workspace.yaml apps/dev-index/package.json apps/local-development/package.json packages/core/package.json packages/eslint-config/package.json packages/tsconfig/package.json packages/world/package.json packages/tsconfig packages/eslint-config packages/core packages/world
ensureNodeDockerfile
collapseable_section_start "docker-login" "Docker Login"
gcloud auth activate-service-account --key-file=<(echo "$CL_review_www_GCLOUD_DEPLOY_credentialsKey")
gcloud auth configure-docker europe-west6-docker.pkg.dev
collapseable_section_end "docker-login"
collapseable_section_start "docker-build" "Docker build"
docker build --network host --cache-from $DOCKER_CACHE_IMAGE --tag $DOCKER_IMAGE:$DOCKER_IMAGE_TAG -f $APP_DIR/Dockerfile $DOCKER_BUILD_CONTEXT --build-arg BUILDKIT_INLINE_CACHE=1
collapseable_section_end "docker-build"
collapseable_section_start "docker-push" "Docker push and tag"
docker push $DOCKER_IMAGE:$DOCKER_IMAGE_TAG
docker tag $DOCKER_IMAGE:$DOCKER_IMAGE_TAG $DOCKER_CACHE_IMAGE
docker push $DOCKER_CACHE_IMAGE
collapseable_section_end "docker-push"
