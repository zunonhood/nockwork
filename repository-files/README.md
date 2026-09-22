# Shellwork Solana implementation

Shellwork separates local software execution from Solana ownership and settlement. The Anchor program stores component code hashes, publishers, SOL-denominated listings and time-limited licenses in deterministic program-derived accounts. The browser uses a Solana wallet to sign purchases. The local runtime verifies artifacts before executing WebAssembly.

## Local verification

```sh
npm ci
npm run verify
npm run demo
```

The generated browser interface is in the repository root at `/system/`. Serve the repository root with an HTTP server. It starts in Local Demo mode. A configured Program ID activates Solana purchase and access checks against the selected RPC endpoint.

## Program workflow

Use Solana CLI and Anchor 0.32.1 from Linux, macOS or Windows WSL:

```sh
anchor build
anchor test
solana config set --url devnet
anchor deploy
```

The program address must match `Anchor.toml`, `programs/shellwork/src/lib.rs` and `src/solana-codec.js`. The program deployment keypair is kept under ignored `target/deploy/`; never commit it. Deployment requires a funded Solana wallet. Initialize the configuration account once after deployment, then publish components and create listings with `MarketClient`.

## Security model

Program-derived accounts constrain who can publish, list and transfer a license. The purchase instruction checks the live listing and component accounts and settles SOL atomically. The local kernel checks licenses, artifact SHA-256 hashes and declared capabilities before execution. This reference implementation requires independent review before production funds are used.
