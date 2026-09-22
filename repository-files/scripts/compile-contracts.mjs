import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import solc from "solc";

const root = fileURLToPath(new URL("../", import.meta.url));
const contractNames = ["ComponentRegistry.sol", "LicenseMarket.sol"];

export async function compileContracts({ write = true } = {}) {
  const sources = {};
  for (const name of contractNames) {
    sources[name] = {
      content: await readFile(path.join(root, "contracts", name), "utf8")
    };
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] }
      }
    }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter(item => item.severity === "error");
  if (errors.length) {
    throw new Error(errors.map(item => item.formattedMessage).join("\n"));
  }

  const artifacts = {};
  for (const [sourceName, contracts] of Object.entries(output.contracts)) {
    for (const [contractName, artifact] of Object.entries(contracts)) {
      if (contractName.startsWith("I")) continue;
      artifacts[contractName] = {
        contractName,
        sourceName,
        abi: artifact.abi,
        bytecode: "0x" + artifact.evm.bytecode.object,
        deployedBytecode: "0x" + artifact.evm.deployedBytecode.object
      };
    }
  }

  if (write) {
    const directory = path.join(root, "dist", "contracts");
    await mkdir(directory, { recursive: true });
    await Promise.all(Object.entries(artifacts).map(([name, artifact]) =>
      writeFile(
        path.join(directory, name + ".json"),
        JSON.stringify(artifact, null, 2) + "\n"
      )
    ));
  }
  return artifacts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const artifacts = await compileContracts();
  console.log("Compiled:", Object.keys(artifacts).join(", "));
}
