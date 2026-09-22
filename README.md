# Shellwork

Shellwork is a local-first component runtime with a Solana program for publishing code hashes, listing software licenses, receiving SOL payments, and recording access expiry.

## Project layout

- `repository-files/programs/shellwork/src/lib.rs`: Solana program written with Anchor
- `repository-files/src/`: JavaScript client, license checks, artifact verification and WebAssembly runtime
- `repository-files/app/`: browser system source
- `system/`: generated browser application

## Run locally

Requires Node.js 22 or newer. From `repository-files/`:

```sh
npm ci
npm run verify
npm run demo
```

Serve the repository root over HTTP and open `/system/`. The browser starts in Local Demo mode. In Chain Settings, choose Solana Devnet or Mainnet and enter a deployed Shellwork Program ID to enable onchain purchases. Catalog entries in Local Demo are samples; real purchases require matching published components and listings on the chosen network.

## Build the Solana program

Install Rust, Solana CLI and Anchor 0.32.1 in a Linux, macOS or WSL environment. From `repository-files/` run `anchor build` and `anchor test`. The program ID in `Anchor.toml`, `programs/shellwork/src/lib.rs` and the JavaScript default must match the generated deployment keypair. Keep deployment keys in the ignored `repository-files/target/` directory.

The program uses program-derived accounts for configuration, components, listings and licenses. Paid listings use lamports; purchase renews a time-limited license and transfers SOL to the publisher and protocol treasury in one transaction. The local runtime verifies component bytes and declared permissions before running WebAssembly.

## Status

This is a reference implementation. Audit the onchain program and runtime before handling real-value payments.

[MIT License](LICENSE)
