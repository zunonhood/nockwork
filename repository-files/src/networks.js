import { Connection } from "@solana/web3.js";

export const solanaDevnet = Object.freeze({
  name: "Solana Devnet",
  rpcUrl: "https://api.devnet.solana.com",
  explorer: "https://explorer.solana.com",
  cluster: "devnet"
});

export const solanaMainnet = Object.freeze({
  name: "Solana Mainnet",
  rpcUrl: "https://api.mainnet.solana.com",
  explorer: "https://explorer.solana.com",
  cluster: "mainnet-beta"
});

export function createConnection(network = solanaDevnet, rpcUrl = network.rpcUrl) {
  return new Connection(rpcUrl, "confirmed");
}
