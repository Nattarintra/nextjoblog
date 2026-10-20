import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const statusOutput = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });

function readStatusValue(name) {
  const match = statusOutput.match(new RegExp(`^${name}="?(.+?)"?$`, "m"));

  if (!match) {
    throw new Error(`supabase status did not return ${name}. Run \`supabase start\` before the E2E suite.`);
  }

  return match[1];
}

const playwright = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["playwright", "test"], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: readStatusValue("API_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: readStatusValue("ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: readStatusValue("SERVICE_ROLE_KEY"),
    PASSWORD_RESET_ENABLED: "1",
    RATE_LIMIT_HASH_SECRET: process.env.RATE_LIMIT_HASH_SECRET ?? randomBytes(32).toString("hex"),
    E2E_MAIL_API_URL: process.env.E2E_MAIL_API_URL ?? "http://127.0.0.1:54324/api/v1",
  },
  stdio: "inherit",
});

if (playwright.error) {
  throw playwright.error;
}

process.exitCode = playwright.status ?? 1;
