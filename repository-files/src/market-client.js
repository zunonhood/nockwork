import { Buffer } from "buffer";
import { PublicKey, Transaction } from "@solana/web3.js";
import { arg, componentId, decodeComponent, decodeListing, instruction, pda, publicKey, DEFAULT_PROGRAM_ID, SystemProgram } from "./solana-codec.js";
import { validateManifest } from "./manifest.js";

export class MarketClient {
  constructor({ wallet, connection, programId = DEFAULT_PROGRAM_ID }) {
    if (!wallet?.publicKey || !wallet?.signTransaction) throw new Error("Solana wallet with signTransaction is required");
    if (!connection?.getAccountInfo || !connection?.getLatestBlockhash) throw new Error("Solana connection is required");
    this.wallet = wallet;
    this.connection = connection;
    this.programId = publicKey(programId);
  }

  async initializeConfig(treasury, feeBps = 250) {
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 1000) throw new Error("feeBps must be 0 to 1000");
    return this.#send("initialize_config", [arg.key(treasury), arg.u16(feeBps)], [
      [pda("config", null, this.programId), false, true],
      [this.wallet.publicKey, true, true],
      [SystemProgram.programId]
    ]);
  }

  async publish(untrustedManifest, metadataURI) {
    const manifest = validateManifest(untrustedManifest);
    if (!metadataURI || new TextEncoder().encode(metadataURI).length > 200) {
      throw new Error("metadataURI must be 1 to 200 bytes");
    }
    return this.#send("publish", [
      arg.id(componentId(manifest.id)), arg.id(manifest.codeHash), arg.string(metadataURI)
    ], [
      [pda("component", manifest.id, this.programId), false, true],
      [this.wallet.publicKey, true, true],
      [SystemProgram.programId]
    ]);
  }

  async updateConfig(treasury, feeBps = 250) {
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 1000) throw new Error("feeBps must be 0 to 1000");
    return this.#send("update_config", [arg.key(treasury), arg.u16(feeBps)], [
      [pda("config", null, this.programId), false, true],
      [this.wallet.publicKey, true]
    ]);
  }

  async updateComponent(componentName, codeHash, metadataURI) {
    if (!metadataURI || new TextEncoder().encode(metadataURI).length > 200) {
      throw new Error("metadataURI must be 1 to 200 bytes");
    }
    return this.#send("update_component", [arg.id(codeHash), arg.string(metadataURI)], [
      [pda("component", componentName, this.programId), false, true],
      [this.wallet.publicKey, true]
    ]);
  }

  async setComponentActive(componentName, active) {
    return this.#send("set_component_active", [arg.bool(active)], [
      [pda("component", componentName, this.programId), false, true],
      [this.wallet.publicKey, true]
    ]);
  }

  async setListingActive(componentName, active) {
    return this.#send("set_listing_active", [arg.bool(active)], [
      [pda("listing", componentName, this.programId), false, true],
      [this.wallet.publicKey, true]
    ]);
  }

  async createListing({ componentName, price, duration, transferable = false }) {
    if (typeof price !== "bigint" || price <= 0n) throw new Error("price must be positive lamports");
    if (!Number.isSafeInteger(duration) || duration < 3600 || duration > 315360000) {
      throw new Error("duration must be between one hour and ten years");
    }
    return this.#send("create_listing", [
      arg.id(componentId(componentName)), arg.u64(price), arg.u64(duration), arg.bool(transferable)
    ], [
      [pda("component", componentName, this.programId)],
      [pda("listing", componentName, this.programId), false, true],
      [this.wallet.publicKey, true, true],
      [SystemProgram.programId]
    ]);
  }

  async getListing(componentName) {
    const account = await this.connection.getAccountInfo(pda("listing", componentName, this.programId));
    if (!account || !account.owner.equals(this.programId)) throw new Error("Listing does not exist");
    const listing = decodeListing(account.data);
    if (!listing.componentId.equals(Buffer.from(componentId(componentName)))) {
      throw new Error("Listing component mismatch");
    }
    return listing;
  }

  async purchase(componentName, expectedPrice) {
    const listing = await this.getListing(componentName);
    if (!listing.active) throw new Error("Listing is not active");
    if (expectedPrice !== undefined && listing.price !== expectedPrice) throw new Error("Onchain price differs from displayed price");
    const componentInfo = await this.connection.getAccountInfo(pda("component", componentName, this.programId));
    if (!componentInfo || !componentInfo.owner.equals(this.programId)) throw new Error("Component does not exist");
    const component = decodeComponent(componentInfo.data);
    if (!component.active || !component.publisher.equals(listing.publisher)) {
      throw new Error("Component is not active");
    }
    const configInfo = await this.connection.getAccountInfo(pda("config", null, this.programId));
    if (!configInfo || !configInfo.owner.equals(this.programId)) throw new Error("Market is not initialized");
    const treasury = new PublicKey(configInfo.data.subarray(40, 72));
    return this.#send("purchase", [], [
      [pda("config", null, this.programId)],
      [pda("listing", componentName, this.programId)],
      [pda("component", componentName, this.programId)],
      [pda("license", componentName, this.programId, this.wallet.publicKey), false, true],
      [this.wallet.publicKey, true, true],
      [listing.publisher, false, true],
      [treasury, false, true],
      [SystemProgram.programId]
    ]);
  }

  async transfer(componentName, recipient) {
    const recipientKey = publicKey(recipient);
    return this.#send("transfer_license", [arg.id(componentId(componentName))], [
      [pda("license", componentName, this.programId, this.wallet.publicKey), false, true],
      [pda("license", componentName, this.programId, recipientKey), false, true],
      [this.wallet.publicKey, true, true],
      [recipientKey],
      [SystemProgram.programId]
    ]);
  }

  async #send(name, args, accounts) {
    const ix = instruction(name, args, accounts, this.programId);
    const latest = await this.connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction({ feePayer: publicKey(this.wallet.publicKey), recentBlockhash: latest.blockhash }).add(ix);
    const signed = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signed.serialize());
    const result = await this.connection.confirmTransaction({ signature, ...latest }, "confirmed");
    if (result.value.err) throw new Error("Solana transaction failed: " + JSON.stringify(result.value.err));
    return { status: "success", signature };
  }
}
