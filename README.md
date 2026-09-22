# Shellwork

Shellwork is an open-source experiment in building a computer system whose software components can be owned, licensed, transferred and settled through Robinhood Chain.

The computer itself remains local-first: code executes on the user's device, while the chain records shared facts such as component publishers, code hashes, licenses, access expiry and payments. Shellwork is independent and is not an official Robinhood product.

## Explore the project

- [Project website and source browser](https://nockwork.xyz/)
- [Open the Shellwork system](https://nockwork.xyz/system/)
- [Developer documentation](repository-files/README.md)

## V1.1 includes

- Solidity registries for versioned components and fixed-price licenses
- A local JavaScript runtime with manifest, hash and permission verification
- A constrained WebAssembly capability kernel
- Robinhood Chain mainnet and testnet configuration
- An in-memory development provider and EVM read provider
- A browser system for discovering, installing and running components
- Contract compilation, runtime tests and an end-to-end local demo

## Run locally

Requires Node.js 22 or newer.

```bash
cd repository-files
npm install
npm run verify
npm run demo
```

The generated browser application is written to `system/`. Serve the repository root with any static HTTP server, then open `/system/`.

## Current status

V1.1 is a working reference implementation, not a production-ready operating system. Before real-value deployment, the contracts and runtime sandbox require independent security audits, stronger recovery design and adversarial testing.

## License

[MIT](LICENSE)
