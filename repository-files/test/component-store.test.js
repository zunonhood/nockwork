import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ComponentStore } from "../src/component-store.js";
import { sha256 } from "../src/hash.js";

const bytes = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0]);
const manifest = {
  id: "tools/empty",
  name: "Empty module",
  version: "1.0.0",
  codeHash: sha256(bytes),
  artifact: "https://example.invalid/empty.wasm",
  entrypoint: "run",
  permissions: []
};

test("stores and reloads a verified version without using ids as paths", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shellwork-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new ComponentStore(directory);
  await store.install(manifest, bytes);
  const loaded = await store.read(manifest.id, manifest.version);
  assert.deepEqual(loaded.bytes, bytes);
  assert.equal((await store.list())[0].id, manifest.id);
});

test("detects corruption in an installed artifact", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shellwork-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new ComponentStore(directory);
  await store.install(manifest, bytes);
  const [entry] = await store.list();
  const key = (await import("node:crypto")).createHash("sha256")
    .update(entry.id + "@" + entry.version).digest("hex");
  await writeFile(path.join(directory, key, "component.wasm"), new Uint8Array([1]));
  await assert.rejects(store.read(entry.id, entry.version), /integrity/);
});
