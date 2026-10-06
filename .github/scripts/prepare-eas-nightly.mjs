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

// Keep config evaluation in upstream's file: importing another TS config can
// introduce a second default-export layer in Expo's config loader.
const configPath = `${mobile}/app.config.ts`;
const source = fs.readFileSync(configPath, "utf8");
const exportLine = "export default config;";
if (!source.includes(exportLine)) throw new Error("Upstream Expo config export changed");
fs.writeFileSync(configPath, source.replace(exportLine, `
Object.assign(config, {
  owner: ${JSON.stringify(owner)},
  slug: ${JSON.stringify(slug)},
  updates: { ...config.updates, enabled: false },
  extra: {
    ...config.extra,
    eas: { ...config.extra?.eas, projectId: ${JSON.stringify(projectId)} },
  },
});
export default config;
`));

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
