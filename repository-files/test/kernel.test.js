import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../src/hash.js";
import { CapabilityKernel } from "../src/kernel.js";
import { MemoryLicenseProvider } from "../src/license-providers.js";
import { validateManifest } from "../src/manifest.js";

const owner = "0x0000000000000000000000000000000000000001";
const addModule = Uint8Array.from([
  0,97,115,109,1,0,0,0,1,7,1,96,2,127,127,1,127,
  3,2,1,0,7,7,1,3,114,117,110,0,0,
  10,9,1,7,0,32,0,32,1,106,11
]);

function manifest(overrides = {}) {
  return {
    id: "tools/add",
    name: "Add",
    version: "1.0.0",
    codeHash: sha256(addModule),
    artifact: "ipfs://example/add.wasm",
    entrypoint: "run",
    permissions: [],
    ...overrides
  };
}

test("validates and freezes a component manifest", () => {
  const result = validateManifest(manifest());
  assert.equal(result.schema, 1);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.permissions), true);
});

test("rejects unknown permissions", () => {
  assert.throws(
    () => validateManifest(manifest({ permissions: ["wallet:sign"] })),
    /Unknown permission/
  );
});

test("mounts licensed, verified wasm and executes its entrypoint", async () => {
  const licenses = new MemoryLicenseProvider();
  licenses.grant(owner, "tools/add");
  const kernel = new CapabilityKernel({ owner, licenseProvider: licenses });
  await kernel.mount(manifest(), addModule);
  assert.equal(kernel.execute("tools/add", 20, 22), 42);
  assert.equal(kernel.list().length, 1);
});

test("rejects a component without a license", async () => {
  const kernel = new CapabilityKernel({
    owner,
    licenseProvider: new MemoryLicenseProvider()
  });
  await assert.rejects(kernel.mount(manifest(), addModule), /No active license/);
});

test("rejects modified component bytes", async () => {
  const licenses = new MemoryLicenseProvider();
  licenses.grant(owner, "tools/add");
  const kernel = new CapabilityKernel({ owner, licenseProvider: licenses });
  const modified = Uint8Array.from(addModule);
  modified[modified.length - 2] = 107;
  await assert.rejects(kernel.mount(manifest(), modified), /integrity check/);
});
