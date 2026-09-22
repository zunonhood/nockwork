import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../src/networks.js";

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) throw new Error("Set PRIVATE_KEY in the environment");
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error("PRIVATE_KEY must be a 32-byte 0x-prefixed value");
}

const root = new URL("../", import.meta.url);
const loadArtifact = async name => JSON.parse(await readFile(
  new URL("dist/contracts/" + name + ".json", root),
  "utf8"
));

const chain = {
  ...robinhoodTestnet,
  rpcUrls: {
    default: {
      http: [process.env.RPC_URL ?? robinhoodTestnet.rpcUrls.default.http[0]]
    }
  }
};
const account = privateKeyToAccount(privateKey);
const transport = http(chain.rpcUrls.default.http[0]);
const wallet = createWalletClient({ account, chain, transport });
const client = createPublicClient({ chain, transport });

async function deploy(artifact, args = []) {
  const hash = await wallet.deployContract({
    account,
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("Deployment returned no address");
  return receipt.contractAddress;
}

const registryArtifact = await loadArtifact("ComponentRegistry");
const marketArtifact = await loadArtifact("LicenseMarket");
const registry = await deploy(registryArtifact);
const treasury = process.env.TREASURY_ADDRESS ?? account.address;
const feeBps = Number(process.env.PROTOCOL_FEE_BPS ?? 250);
const market = await deploy(marketArtifact, [registry, treasury, feeBps]);

console.log(JSON.stringify({
  chainId: chain.id,
  deployer: account.address,
  componentRegistry: registry,
  licenseMarket: market
}, null, 2));
