import assert from "node:assert/strict";
import test from "node:test";
import { solanaDevnet, solanaMainnet } from "../src/networks.js";
import { componentId, pda, DEFAULT_PROGRAM_ID } from "../src/solana-codec.js";

test("uses Solana devnet and mainnet endpoints", () => {
  assert.equal(solanaDevnet.rpcUrl, "https://api.devnet.solana.com");
  assert.equal(solanaMainnet.rpcUrl, "https://api.mainnet.solana.com");
  assert.equal(solanaDevnet.cluster, "devnet");
});

test("derives stable component and license accounts", () => {
  assert.equal(componentId("tools/add").length, 32);
  assert.ok(pda("component", "tools/add").toBase58() !==
    pda("listing", "tools/add").toBase58());
  assert.ok(pda("license", "tools/add", DEFAULT_PROGRAM_ID, DEFAULT_PROGRAM_ID).toBase58());
});
