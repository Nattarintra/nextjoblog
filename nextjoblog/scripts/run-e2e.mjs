import { execFileSync, spawnSync } from "node:child_process";

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
  },
  stdio: "inherit",
});

if (playwright.error) {
  throw playwright.error;
}

process.exitCode = playwright.status ?? 1;
