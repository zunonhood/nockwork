# Shellwork

Version 1.1 is a working reference implementation of a local-first computer
runtime whose component ownership and licensing can be settled on Robinhood
Chain.

This is an independent open-source experiment. It is not an official Robinhood
product.

## What V1 does

- Registers versioned software components and their code hashes onchain.
- Lets a publisher create fixed-price, time-limited license offers.
- Lets a user acquire or transfer an eligible component license.
- Uses pull payments so publishers withdraw revenue safely.
- Validates manifests, permission declarations and component bytes locally.
- Loads verified WebAssembly components inside a deliberately small host API.
- Supports an in-memory development provider and a real EVM read provider.
- Includes contract compilation, runtime tests and an end-to-end local demo.
- Includes a browser system interface with a component market, installed
  components, activity history, wallet connection and chain configuration.

## Architecture

The local runtime executes software and protects private data. Robinhood Chain
stores shared facts: who published a component, its current code hash, who has
access, when that access expires, and how payments should be distributed.

Large binaries and private files do not belong onchain. A component artifact can
live on ordinary hosting or content-addressed storage. Its SHA-256 digest is
recorded in the manifest and registry so the runtime can reject modified bytes.

## Quick start

Requires Node.js 22 or newer.

    npm install
    npm run verify
    npm run demo

After building, open /system/ from the repository interface. The browser starts
in clearly labeled Local Demo mode. Add deployed registry and market addresses
under Chain Settings to enable wallet-backed testnet or mainnet purchases.

The demo builds a tiny WebAssembly component, registers a development license,
verifies its hash and manifest, and executes it through the capability kernel.

## Robinhood Chain

Mainnet uses chain ID 4663. Testnet uses chain ID 46630. V1 defaults to testnet
for deployment scripts. Set RPC_URL, PRIVATE_KEY and REGISTRY_ADDRESS in your
environment; never place a private key in this repository.

## Security boundary

V1 only loads WebAssembly and gives it explicitly constructed imports. License
ownership does not grant access to personal files, identity secrets or wallet
signing. Production use still requires independent contract audits, runtime
sandbox review and a complete recovery design.
