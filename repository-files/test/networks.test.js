import assert from "node:assert/strict";
import test from "node:test";
import { robinhoodMainnet, robinhoodTestnet } from "../src/networks.js";

test("uses official Robinhood Chain identifiers", () => {
  assert.equal(robinhoodMainnet.id, 4663);
  assert.equal(robinhoodTestnet.id, 46630);
  assert.equal(robinhoodMainnet.nativeCurrency.symbol, "ETH");
});
