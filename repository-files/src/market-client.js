import { getAddress } from "viem";
import { componentId } from "./license-providers.js";
import { validateManifest } from "./manifest.js";

const registryAbi = [{
  type: "function", name: "publish", stateMutability: "nonpayable",
  inputs: [
    { name: "componentId", type: "bytes32" },
    { name: "codeHash", type: "bytes32" },
    { name: "metadataURI", type: "string" }
  ], outputs: []
}];

const marketAbi = [
  {
    type: "function", name: "createListing", stateMutability: "nonpayable",
    inputs: [
      { name: "componentId", type: "bytes32" },
      { name: "price", type: "uint128" },
      { name: "duration", type: "uint64" },
      { name: "transferable", type: "bool" }
    ], outputs: [{ name: "listingId", type: "uint256" }]
  },
  {
    type: "function", name: "listings", stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      { name: "publisher", type: "address" },
      { name: "componentId", type: "bytes32" },
      { name: "price", type: "uint128" },
      { name: "duration", type: "uint64" },
      { name: "transferable", type: "bool" },
      { name: "active", type: "bool" }
    ]
  },
  {
    type: "function", name: "purchase", stateMutability: "payable",
    inputs: [{ name: "listingId", type: "uint256" }], outputs: []
  },
  {
    type: "function", name: "transferLicense", stateMutability: "nonpayable",
    inputs: [
      { name: "componentId", type: "bytes32" },
      { name: "recipient", type: "address" }
    ], outputs: []
  }
];

export class MarketClient {
  constructor({ walletClient, publicClient, registryAddress, marketAddress }) {
    if (!walletClient?.writeContract) throw new Error("walletClient is required");
    if (!publicClient?.waitForTransactionReceipt) {
      throw new Error("publicClient is required");
    }
    this.wallet = walletClient;
    this.public = publicClient;
    this.registryAddress = getAddress(registryAddress);
    this.marketAddress = getAddress(marketAddress);
  }

  async publish(untrustedManifest, metadataURI) {
    const manifest = validateManifest(untrustedManifest);
    if (!metadataURI) throw new Error("metadataURI is required");
    return this.#write({
      address: this.registryAddress,
      abi: registryAbi,
      functionName: "publish",
      args: [componentId(manifest.id), manifest.codeHash, metadataURI]
    });
  }

  async createListing({ componentName, price, duration, transferable = false }) {
    if (typeof price !== "bigint" || price <= 0n) {
      throw new Error("price must be a positive bigint in wei");
    }
    if (!Number.isSafeInteger(duration) || duration < 3600) {
      throw new Error("duration must be at least one hour");
    }
    return this.#write({
      address: this.marketAddress,
      abi: marketAbi,
      functionName: "createListing",
      args: [componentId(componentName), price, BigInt(duration), transferable]
    });
  }

  async purchase(listingId) {
    const listing = await this.public.readContract({
      address: this.marketAddress,
      abi: marketAbi,
      functionName: "listings",
      args: [BigInt(listingId)]
    });
    if (!listing[5]) throw new Error("Listing is not active");
    return this.#write({
      address: this.marketAddress,
      abi: marketAbi,
      functionName: "purchase",
      args: [BigInt(listingId)],
      value: listing[2]
    });
  }

  async transfer(componentName, recipient) {
    return this.#write({
      address: this.marketAddress,
      abi: marketAbi,
      functionName: "transferLicense",
      args: [componentId(componentName), getAddress(recipient)]
    });
  }

  async #write(request) {
    const hash = await this.wallet.writeContract(request);
    return this.public.waitForTransactionReceipt({ hash });
  }
}
