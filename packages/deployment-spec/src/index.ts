/**
 * Stand-in for @omega/deployment-spec: the shared output contract that every
 * adapter depends on. Exists in this POC so that the release has a real
 * intra-monorepo dependency edge — deployment-spec must reach the registry
 * before the adapters that depend on it.
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
