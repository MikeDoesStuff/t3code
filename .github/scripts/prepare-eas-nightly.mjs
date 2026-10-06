import fs from "node:fs";
import { parseEnv } from "node:util";

const owner = "miccul";
const slug = "t3code-nightly";
const projectId = "7692959f-2dcf-43b1-9acd-33771a371a21";
const mobile = "apps/mobile";
const publicExample = parseEnv(fs.readFileSync(".env.example", "utf8"));
const publicEnv = {};
for (const key of [
  "T3CODE_CLERK_PUBLISHABLE_KEY",
  "T3CODE_CLERK_JWT_TEMPLATE",
  "T3CODE_CLERK_CLI_OAUTH_CLIENT_ID",
  "T3CODE_RELAY_URL",
]) {
  if (!publicExample[key]) throw new Error(`Missing upstream public config: ${key}`);
  publicEnv[key] = publicExample[key];
}

// Retain upstream's native plugins/assets while using the personal EAS project.
fs.renameSync(`${mobile}/app.config.ts`, `${mobile}/app.upstream.config.ts`);
fs.writeFileSync(`${mobile}/app.config.ts`, `
import upstream from "./app.upstream.config.ts";
export default {
  ...upstream,
  owner: ${JSON.stringify(owner)},
  slug: ${JSON.stringify(slug)},
  updates: { ...upstream.updates, enabled: false },
  extra: {
    ...upstream.extra,
    eas: { ...upstream.extra?.eas, projectId: ${JSON.stringify(projectId)} },
  },
};
`);

const easPath = `${mobile}/eas.json`;
const eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
eas.cli.appVersionSource = "local";
eas.build.nightly = {
  extends: "preview",
  corepack: true,
  node: "24.13.1",
  developmentClient: false,
  autoIncrement: false,
  env: {
    ...publicEnv,
    APP_VARIANT: "preview",
    MOBILE_VERSION_POLICY: "appVersion",
    T3CODE_MOBILE_UPDATES_ENABLED: "0",
    EAS_USE_CACHE: "1",
    NODE_OPTIONS: "--max-old-space-size=4096",
  },
  android: { buildType: "apk", resourceClass: "medium" },
};
fs.writeFileSync(easPath, JSON.stringify(eas, null, 2) + "\n");
fs.writeFileSync(".easignore", fs.readFileSync(".gitignore", "utf8") + "\n/.repos/\n");
console.log(`Configured standalone nightly APK for @${owner}/${slug}; upstream OTA disabled.`);
