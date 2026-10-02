import type { Config } from "@catladder/cli";

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
    www: {
      dir: "apps/www",
      build: { type: "node" },
      deploy: {
        type: "google-cloudrun",
        projectId: GCP_PROJECT_ID,
        region: GCP_REGION,
      },
      env: {
        review: {},
        dev: {},
        stage: {},
        prod: {},
      },
    },
  },
} satisfies Config;

export default config;
