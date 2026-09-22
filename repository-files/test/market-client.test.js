import assert from "node:assert/strict";
import { Buffer } from "buffer";
import test from "node:test";
import { Keypair, Transaction } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import { MarketClient } from "../src/market-client.js";
import { componentId, DEFAULT_PROGRAM_ID, pda } from "../src/solana-codec.js";

const buyer = Keypair.generate();
const publisher = Keypair.generate().publicKey;
const treasury = Keypair.generate().publicKey;
const id = Buffer.from(componentId("tools/add"));
const disc = name => Buffer.from(sha256(new TextEncoder().encode("account:" + name)).slice(0, 8));

function accounts(active = true) {
  const listing = Buffer.alloc(90);
  disc("Listing").copy(listing, 0);
  id.copy(listing, 8);
  publisher.toBuffer().copy(listing, 40);
  listing.writeBigUInt64LE(25n, 72);
  listing.writeBigUInt64LE(3600n, 80);
  listing[88] = 1;
  listing[89] = active ? 1 : 0;
  const component = Buffer.alloc(117);
  disc("Component").copy(component, 0);
  id.copy(component, 8);
  publisher.toBuffer().copy(component, 40);
  component.writeBigUInt64LE(1n, 104);
  component[112] = 1;
  const config = Buffer.alloc(74);
  disc("Config").copy(config, 0);
  treasury.toBuffer().copy(config, 40);
  return { listing, component, config };
}

function harness(active = true) {
  const data = accounts(active);
  const sent = [];
  const connection = {
    async getAccountInfo(address) {
      const kind = address.equals(pda("listing", "tools/add")) ? "listing"
        : address.equals(pda("component", "tools/add")) ? "component"
        : address.equals(pda("config", null)) ? "config" : null;
      return kind ? { owner: DEFAULT_PROGRAM_ID, data: data[kind] } : null;
    },
    async getLatestBlockhash() {
      return { blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 100 };
    },
    async sendRawTransaction(raw) {
      sent.push(Transaction.from(raw));
      return "test-signature";
    },
    async confirmTransaction() {
      return { value: { err: null } };
    }
  };
  const wallet = {
    publicKey: buyer.publicKey,
    async signTransaction(tx) {
      tx.partialSign(buyer);
      return tx;
    }
  };
  return { client: new MarketClient({ wallet, connection }), sent };
}

test("creates a listing using Solana lamports and derived accounts", async () => {
  const { client, sent } = harness();
  const receipt = await client.createListing({
    componentName: "tools/add", price: 25n, duration: 3600, transferable: true
  });
  assert.equal(receipt.status, "success");
  const ix = sent[0].instructions[0];
  assert.ok(ix.programId.equals(DEFAULT_PROGRAM_ID));
  assert.ok(ix.keys[0].pubkey.equals(pda("component", "tools/add")));
  assert.ok(ix.keys[1].pubkey.equals(pda("listing", "tools/add")));
  assert.equal(ix.data.readBigUInt64LE(40), 25n);
});

test("reads the onchain listing before buying and sends the correct accounts", async () => {
  const { client, sent } = harness();
  const receipt = await client.purchase("tools/add");
  assert.equal(receipt.signature, "test-signature");
  const keys = sent[0].instructions[0].keys;
  assert.ok(keys[4].pubkey.equals(buyer.publicKey));
  assert.ok(keys[5].pubkey.equals(publisher));
  assert.ok(keys[6].pubkey.equals(treasury));
});

test("rejects inactive listings before wallet signing", async () => {
  const { client, sent } = harness(false);
  await assert.rejects(client.purchase("tools/add"), /not active/);
  assert.equal(sent.length, 0);
});
