import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  stringToHex
} from "viem";
import { robinhoodTestnet } from "./networks.js";

const marketAbi = [{
  type: "function",
  name: "hasAccess",
  stateMutability: "view",
  inputs: [
    { name: "componentId", type: "bytes32" },
    { name: "user", type: "address" }
  ],
  outputs: [{ name: "", type: "bool" }]
}];

export function componentId(name) {
  return keccak256(stringToHex(name));
}

export class ChainLicenseProvider {
  constructor({ marketAddress, chain = robinhoodTestnet, rpcUrl } = {}) {
    if (!marketAddress) throw new Error("marketAddress is required");
    this.marketAddress = getAddress(marketAddress);
    this.client = createPublicClient({
      chain,
      transport: http(rpcUrl ?? chain.rpcUrls.default.http[0])
    });
  }

  async hasAccess(owner, componentName) {
    return this.client.readContract({
      address: this.marketAddress,
      abi: marketAbi,
      functionName: "hasAccess",
      args: [componentId(componentName), getAddress(owner)]
    });
  }
}

export class MemoryLicenseProvider {
  #licenses = new Map();

  grant(owner, componentName, expiresAt = Number.MAX_SAFE_INTEGER) {
    this.#licenses.set(owner.toLowerCase() + ":" + componentName, expiresAt);
  }

  revoke(owner, componentName) {
    this.#licenses.delete(owner.toLowerCase() + ":" + componentName);
  }

  async hasAccess(owner, componentName) {
    const expiry = this.#licenses.get(owner.toLowerCase() + ":" + componentName);
    return typeof expiry === "number" && expiry > Date.now();
  }
}
