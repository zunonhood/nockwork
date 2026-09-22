import { compileContracts } from "./compile-contracts.mjs";
import { buildWeb } from "./build-web.mjs";

const artifacts = await compileContracts();
for (const [name, artifact] of Object.entries(artifacts)) {
  if (artifact.bytecode === "0x") throw new Error(name + " has empty bytecode");
  console.log(
    name.padEnd(20),
    ((artifact.bytecode.length - 2) / 2).toString().padStart(6),
    "bytes"
  );
}
await buildWeb();
console.log("V1 build complete.");
