import { equalHash, sha256 } from "./hash.js";
import { validateManifest } from "./manifest.js";
import { WasmLoader } from "./wasm-loader.js";

export class CapabilityKernel {
  #mounted = new Map();

  constructor({ owner, licenseProvider, loader = new WasmLoader() }) {
    if (!owner) throw new Error("owner is required");
    if (!licenseProvider?.hasAccess) throw new Error("licenseProvider is required");
    this.owner = owner;
    this.licenseProvider = licenseProvider;
    this.loader = loader;
  }

  async mount(untrustedManifest, bytes) {
    const manifest = validateManifest(untrustedManifest);
    const actualHash = sha256(bytes);
    if (!equalHash(actualHash, manifest.codeHash)) {
      throw new Error("Component integrity check failed");
    }

    const licensed = await this.licenseProvider.hasAccess(this.owner, manifest.id);
    if (!licensed) throw new Error("No active license for " + manifest.id);

    const loaded = await this.loader.load(bytes, manifest.permissions);
    if (typeof loaded.instance.exports[manifest.entrypoint] !== "function") {
      throw new Error("Missing WebAssembly entrypoint: " + manifest.entrypoint);
    }

    this.#mounted.set(manifest.id, Object.freeze({ manifest, ...loaded }));
    return manifest;
  }

  execute(componentName, ...args) {
    const component = this.#mounted.get(componentName);
    if (!component) throw new Error("Component is not mounted: " + componentName);
    return component.instance.exports[component.manifest.entrypoint](...args);
  }

  list() {
    return [...this.#mounted.values()].map(item => item.manifest);
  }

  unmount(componentName) {
    return this.#mounted.delete(componentName);
  }
}
