import { sha256 } from "../src/hash.js";
import { CapabilityKernel, MemoryLicenseProvider } from "../src/index.js";

const owner = "11111111111111111111111111111111";

// A valid WebAssembly module exporting run(a, b), which returns a + b.
const componentBytes = Uint8Array.from([
  0,97,115,109,1,0,0,0,1,7,1,96,2,127,127,1,127,
  3,2,1,0,7,7,1,3,114,117,110,0,0,
  10,9,1,7,0,32,0,32,1,106,11
]);

const manifest = {
  id: "tools/add",
  name: "Verified Add",
  version: "1.0.0",
  codeHash: sha256(componentBytes),
  artifact: "memory://tools/add.wasm",
  entrypoint: "run",
  permissions: []
};

const licenses = new MemoryLicenseProvider();
licenses.grant(owner, manifest.id, Date.now() + 60_000);

const kernel = new CapabilityKernel({ owner, licenseProvider: licenses });
await kernel.mount(manifest, componentBytes);
const result = kernel.execute(manifest.id, 20, 22);

console.log("Mounted:", kernel.list()[0].id);
console.log("Verified result: 20 + 22 =", result);
if (result !== 42) throw new Error("Demo execution failed");
