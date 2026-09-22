import { spawnSync } from "node:child_process";

const tests = spawnSync(process.execPath, ["--test"], {
  cwd: new URL("../", import.meta.url),
  stdio: "inherit"
});
if (tests.status !== 0) process.exit(tests.status ?? 1);

const build = spawnSync(process.execPath, ["scripts/build.mjs"], {
  cwd: new URL("../", import.meta.url),
  stdio: "inherit"
});
if (build.status !== 0) process.exit(build.status ?? 1);

console.log("V2 verification passed.");
