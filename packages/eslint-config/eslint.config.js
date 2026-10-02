import { defineConfig, globalIgnores } from "eslint/config";

import base from "./base.js";

export default defineConfig(base, globalIgnores(["test/fixtures/"]));
