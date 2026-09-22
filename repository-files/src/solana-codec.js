import { Buffer } from "buffer";
import { sha256 } from "@noble/hashes/sha256";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

export const DEFAULT_PROGRAM_ID = new PublicKey("EgaRMf8t5gnqEXa37xW9BYxgEiSmTsF2FkNfxr2kbyuh");
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function publicKey(value) {
  return value instanceof PublicKey ? value : new PublicKey(value);
}

export function componentId(name) {
  if (typeof name !== "string" || !/^[a-z0-9][a-z0-9._/-]{2,127}$/.test(name)) {
    throw new Error("component name must be a namespaced identifier");
  }
  return sha256(encoder.encode(name));
}

export function pda(kind, nameOrId, programId = DEFAULT_PROGRAM_ID, owner) {
  const id = typeof nameOrId === "string" ? componentId(nameOrId) : nameOrId;
  const seeds = [encoder.encode(kind)];
  if (kind !== "config") seeds.push(id);
  if (kind === "license") seeds.push(publicKey(owner).toBuffer());
  return PublicKey.findProgramAddressSync(seeds, publicKey(programId))[0];
}

function discriminator(scope, name) {
  return sha256(encoder.encode(scope + ":" + name)).slice(0, 8);
}
function bytes32(value) {
  const bytes = typeof value === "string"
    ? Uint8Array.from(Buffer.from(value.replace(/^0x/, ""), "hex"))
    : value;
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) throw new Error("expected 32 bytes");
  return bytes;
}
function u64(value) {
  const n = BigInt(value);
  if (n < 0n || n > 0xffffffffffffffffn) throw new Error("value must fit in u64");
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(n);
  return out;
}
function string(value) {
  const data = encoder.encode(value);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length);
  return Buffer.concat([size, Buffer.from(data)]);
}
export function instruction(name, args, accounts, programId = DEFAULT_PROGRAM_ID) {
  return new TransactionInstruction({
    programId: publicKey(programId),
    keys: accounts.map(([key, isSigner = false, isWritable = false]) => ({
      pubkey: publicKey(key), isSigner, isWritable
    })),
    data: Buffer.concat([Buffer.from(discriminator("global", name)), ...args.map(Buffer.from)])
  });
}
export const arg = Object.freeze({
  id: bytes32,
  u64,
  bool: value => Buffer.from([value ? 1 : 0]),
  string,
  u16: value => {
    if (!Number.isInteger(value) || value < 0 || value > 65535) throw new Error("invalid u16");
    const out = Buffer.alloc(2);
    out.writeUInt16LE(value);
    return out;
  },
  key: value => publicKey(value).toBuffer()
});
export { SystemProgram };

function checked(data, name) {
  const bytes = Buffer.from(data);
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(Buffer.from(discriminator("account", name)))) {
    throw new Error("Invalid " + name + " account");
  }
  return bytes;
}
export function decodeListing(data) {
  const bytes = checked(data, "Listing");
  if (bytes.length < 90) throw new Error("Listing account is truncated");
  return {
    componentId: bytes.subarray(8, 40),
    publisher: new PublicKey(bytes.subarray(40, 72)),
    price: bytes.readBigUInt64LE(72),
    duration: Number(bytes.readBigUInt64LE(80)),
    transferable: bytes[88] === 1,
    active: bytes[89] === 1
  };
}
export function decodeComponent(data) {
  const bytes = checked(data, "Component");
  if (bytes.length < 117) throw new Error("Component account is truncated");
  const length = bytes.readUInt32LE(113);
  if (bytes.length < 117 + length) throw new Error("Component metadata is truncated");
  return {
    id: bytes.subarray(8, 40),
    publisher: new PublicKey(bytes.subarray(40, 72)),
    codeHash: bytes.subarray(72, 104),
    version: bytes.readBigUInt64LE(104),
    active: bytes[112] === 1,
    metadataURI: decoder.decode(bytes.subarray(117, 117 + length))
  };
}
export function decodeLicense(data) {
  const bytes = checked(data, "License");
  if (bytes.length < 81) throw new Error("License account is truncated");
  return {
    componentId: bytes.subarray(8, 40),
    owner: new PublicKey(bytes.subarray(40, 72)),
    expiresAt: Number(bytes.readBigInt64LE(72)),
    transferable: bytes[80] === 1
  };
}
