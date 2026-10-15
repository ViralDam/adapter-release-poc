/**
 * Shared output contract that every adapter in this fixture depends on.
 * Exists so the release has a real intra-monorepo dependency edge: this
 * package must reach the registry before the adapters that depend on it.
 */

export type ComputeRuntime = "NodeJs-24.x";

export interface Route {
  source: string;
  target: "static" | "compute";
}

export interface HostingManifest {
  version: number;
  routes: Route[];
  staticAssets: string;
  compute: Record<string, { runtime: ComputeRuntime; directory: string; entrypoint: string }>;
}

export function validateHostingManifest(manifest: HostingManifest): boolean {
  if (manifest.version !== 1) return false;
  if (!Array.isArray(manifest.routes) || manifest.routes.length === 0) return false;
  return manifest.routes.every((r) => r.source.length > 0);
}
