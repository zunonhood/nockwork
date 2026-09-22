import { Buffer } from "buffer";
import { DEFAULT_PROGRAM_ID, componentId, decodeComponent, decodeLicense, pda, publicKey } from "./solana-codec.js";
import { createConnection, solanaDevnet } from "./networks.js";

export { componentId };

export class ChainLicenseProvider {
  constructor({ programId = DEFAULT_PROGRAM_ID, network = solanaDevnet, rpcUrl, connection } = {}) {
    this.programId = publicKey(programId);
    this.connection = connection ?? createConnection(network, rpcUrl);
  }

  async hasAccess(owner, componentName, codeHash) {
    const component = await this.connection.getAccountInfo(pda("component", componentName, this.programId));
    const license = await this.connection.getAccountInfo(pda("license", componentName, this.programId, owner));
    if (!component || !license ||
        !component.owner.equals(this.programId) || !license.owner.equals(this.programId)) return false;
    const id = componentId(componentName);
    const record = decodeComponent(component.data);
    const access = decodeLicense(license.data);
    return record.active && record.id.equals(Buffer.from(id)) &&
      (!codeHash || record.codeHash.equals(Buffer.from(codeHash.replace(/^0x/, ""), "hex"))) &&
      access.componentId.equals(Buffer.from(id)) &&
      access.owner.equals(publicKey(owner)) &&
      access.expiresAt > Math.floor(Date.now() / 1000);
  }
}

export class MemoryLicenseProvider {
  #licenses = new Map();

  grant(owner, componentName, expiresAt = Number.MAX_SAFE_INTEGER) {
    this.#licenses.set(String(owner) + ":" + componentName, expiresAt);
  }

  revoke(owner, componentName) {
    this.#licenses.delete(String(owner) + ":" + componentName);
  }

  async hasAccess(owner, componentName, codeHash) {
    const expiry = this.#licenses.get(String(owner) + ":" + componentName);
    return typeof expiry === "number" && expiry > Date.now();
  }
}
