import assert from "node:assert/strict";
import { Buffer } from "buffer";
import test from "node:test";
import { Keypair } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import { ChainLicenseProvider } from "../src/license-providers.js";
import { componentId, DEFAULT_PROGRAM_ID, pda } from "../src/solana-codec.js";

const owner = Keypair.generate().publicKey;
const id = Buffer.from(componentId("tools/add"));
const codeHash = "0x" + "ab".repeat(32);
const disc = name => Buffer.from(sha256(new TextEncoder().encode("account:" + name)).slice(0, 8));

function connection(expiresAt) {
  const component = Buffer.alloc(117);
  disc("Component").copy(component);
  id.copy(component, 8);
  Buffer.from(codeHash.slice(2), "hex").copy(component, 72);
  component[112] = 1;
  const license = Buffer.alloc(81);
  disc("License").copy(license);
  id.copy(license, 8);
  owner.toBuffer().copy(license, 40);
  license.writeBigInt64LE(BigInt(expiresAt), 72);
  return {
    async getAccountInfo(address) {
      if (address.equals(pda("component", "tools/add"))) {
        return { owner: DEFAULT_PROGRAM_ID, data: component };
      }
      if (address.equals(pda("license", "tools/add", DEFAULT_PROGRAM_ID, owner))) {
        return { owner: DEFAULT_PROGRAM_ID, data: license };
      }
      return null;
    }
  };
}

test("accepts active Solana license only for the registered code hash", async () => {
  const provider = new ChainLicenseProvider({ connection: connection(Math.floor(Date.now()/1000)+3600) });
  assert.equal(await provider.hasAccess(owner, "tools/add", codeHash), true);
  assert.equal(await provider.hasAccess(owner, "tools/add", "0x"+"cd".repeat(32)), false);
});

test("rejects expired Solana licenses", async () => {
  const provider = new ChainLicenseProvider({ connection: connection(1) });
  assert.equal(await provider.hasAccess(owner, "tools/add", codeHash), false);
});
