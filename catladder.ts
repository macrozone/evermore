import type { Config } from "@catladder/cli";
import { LOCAL_BASE_PORT, WWW_PORT, DB_PORT, TASK_QUEUE_PORT, DEV_INDEX_PORT, COMPOSE_PROJECT_NAME } from "./catladder/localPorts";

// CI/CD and deployment config (ADR 0004). After every change run
// `pnpm catenv` and commit the regenerated files – never edit
// .github/workflows/ or .catladder-generated/ by hand.
//
// The GCP resources are provisioned by a human with
// `pnpm catladder project setup` (agents have no GCP access); until then
// the deploy jobs fail.

const GCP_PROJECT_ID = "maw-evermore";
const GCP_REGION = "europe-west6";

const config = {
  customerName: "pan",
  appName: "evermore",
  pipelines: { github: true },
  components: {
    "local-development": {
      dir: "apps/local-development",
      build: false,
      deploy: false,
      env: {
        local: {
          port: false,
          vars: { public: { DB_PORT, TASK_QUEUE_PORT, DEV_INDEX_PORT, COMPOSE_PROJECT_NAME } },
        },
      },
    },
    "dev-index": {
      dir: "apps/dev-index",
      build: false,
      deploy: false,
      env: { local: { port: DEV_INDEX_PORT } },
    },
    www: {
      dir: "apps/www",
      build: { type: "node" },
      deploy: {
        type: "google-cloudrun",
        projectId: GCP_PROJECT_ID,
        region: GCP_REGION,
      },
      env: {
        local: {
          port: WWW_PORT,
          vars: { public: { BASE_PORT: LOCAL_BASE_PORT, DATABASE_URL: `postgresql://evermore:evermore@localhost:${DB_PORT}/evermore`, TASK_QUEUE_PORT } },
        },
        review: {},
        dev: {},
        stage: {},
        prod: {},
      },
    },
  },
} satisfies Config;

export default config;
