import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ArtifactFetcher } from "../src/artifact-fetcher.js";
import { ChainComputer } from "../src/computer.js";
import { ComponentStore } from "../src/component-store.js";
import { sha256 } from "../src/hash.js";
import { CapabilityKernel } from "../src/kernel.js";
import { MemoryLicenseProvider } from "../src/license-providers.js";

const owner = "0x0000000000000000000000000000000000000001";
const wasm = Uint8Array.from([
  0,97,115,109,1,0,0,0,1,7,1,96,2,127,127,1,127,
  3,2,1,0,7,7,1,3,114,117,110,0,0,
  10,9,1,7,0,32,0,32,1,106,11
]);
const manifest = {
  id: "tools/integration-add",
  name: "Integration Add",
  version: "1.1.0",
  codeHash: sha256(wasm),
  artifact: "https://components.example/add.wasm",
  entrypoint: "run",
  permissions: []
};

test("downloads, installs, reloads, reauthorizes and launches a component", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shellwork-e2e-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const licenses = new MemoryLicenseProvider();
  licenses.grant(owner, manifest.id);
  const computer = new ChainComputer({
    kernel: new CapabilityKernel({ owner, licenseProvider: licenses }),
    store: new ComponentStore(directory),
    artifactFetcher: new ArtifactFetcher({
      fetcher: async () => new Response(wasm, { status: 200 })
    })
  });

  await computer.install(manifest);
  assert.equal((await computer.installed())[0].id, manifest.id);
  assert.equal(await computer.launch(manifest.id, manifest.version, 19, 23), 42);
});
