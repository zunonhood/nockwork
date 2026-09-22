import assert from "node:assert/strict";
import test from "node:test";
import { MarketClient } from "../src/market-client.js";

const registryAddress = "0x0000000000000000000000000000000000000010";
const marketAddress = "0x0000000000000000000000000000000000000020";
const transactionHash = "0x" + "ab".repeat(32);

function harness(listingActive = true) {
  const writes = [];
  const walletClient = {
    async writeContract(request) {
      writes.push(request);
      return transactionHash;
    }
  };
  const publicClient = {
    async readContract() {
      return [
        registryAddress,
        "0x" + "11".repeat(32),
        25n,
        3600n,
        true,
        listingActive
      ];
    },
    async waitForTransactionReceipt({ hash }) {
      return { status: "success", transactionHash: hash };
    }
  };
  return {
    writes,
    client: new MarketClient({
      walletClient,
      publicClient,
      registryAddress,
      marketAddress
    })
  };
}

test("creates a fixed-duration component listing", async () => {
  const { client, writes } = harness();
  const receipt = await client.createListing({
    componentName: "tools/add",
    price: 25n,
    duration: 3600,
    transferable: true
  });
  assert.equal(receipt.status, "success");
  assert.equal(writes[0].functionName, "createListing");
  assert.equal(writes[0].args[1], 25n);
  assert.equal(writes[0].args[2], 3600n);
});

test("reads the listing price before purchasing", async () => {
  const { client, writes } = harness();
  await client.purchase(7);
  assert.equal(writes[0].functionName, "purchase");
  assert.equal(writes[0].value, 25n);
  assert.deepEqual(writes[0].args, [7n]);
});

test("will not submit a purchase for an inactive listing", async () => {
  const { client, writes } = harness(false);
  await assert.rejects(client.purchase(7), /not active/);
  assert.equal(writes.length, 0);
});
