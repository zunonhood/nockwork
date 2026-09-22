import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ChainLicenseProvider } from "../src/license-providers.js";
import { MarketClient } from "../src/market-client.js";
import { DEFAULT_PROGRAM_ID, pda } from "../src/solana-codec.js";

test("local validator: publish, list, purchase and transfer a license", {
  skip: process.env.SHELLWORK_LIVE !== "1"
}, async () => {
  const connection = new Connection(process.env.ANCHOR_PROVIDER_URL ?? "http://127.0.0.1:8899", "confirmed");
  const publisher = Keypair.generate();
  const buyer = Keypair.generate();
  const recipient = Keypair.generate();
  const treasury = Keypair.generate();
  const wallet = keypair => ({
    publicKey: keypair.publicKey,
    async signTransaction(tx) { tx.partialSign(keypair); return tx; }
  });
  for (const keypair of [publisher, buyer]) {
    const signature = await connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  }
  const publisherClient = new MarketClient({ wallet: wallet(publisher), connection });
  const buyerClient = new MarketClient({ wallet: wallet(buyer), connection });
  const name = "tools/live-" + Date.now();
  const hash = "0x" + "ab".repeat(32);
  if (!await connection.getAccountInfo(pda("config", null, DEFAULT_PROGRAM_ID))) {
    await publisherClient.initializeConfig(treasury.publicKey, 250);
  }
  await publisherClient.publish({
    id: name, name: "Live integration component", version: "1.0.0",
    codeHash: hash, artifact: "memory://live.wasm",
    entrypoint: "run", permissions: []
  }, "https://example.invalid/live.json");
  await publisherClient.createListing({
    componentName: name, price: 10_000n, duration: 3_600, transferable: true
  });
  await buyerClient.purchase(name, 10_000n);
  const provider = new ChainLicenseProvider({ connection });
  assert.equal(await provider.hasAccess(buyer.publicKey, name, hash), true);
  assert.ok(await connection.getBalance(treasury.publicKey) > 0);
  await buyerClient.transfer(name, recipient.publicKey);
  assert.equal(await provider.hasAccess(buyer.publicKey, name, hash), false);
  assert.equal(await provider.hasAccess(recipient.publicKey, name, hash), true);
});
