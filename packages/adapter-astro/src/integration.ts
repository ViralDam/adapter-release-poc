import {
  validateHostingManifest,
  type HostingManifest,
} from "@viraldam/poc-deployment-spec";

export interface AstroAdapterOptions {
  computeName?: string;
}

/**
 * Deliberately imports from the sibling workspace package so the release has a
 * real dependency edge: `changeset publish` must put poc-deployment-spec on the
 * registry before this package, or an installing consumer gets a broken tree.
 */
export function astroAdapter(options?: AstroAdapterOptions): HostingManifest {
  const computeName = options?.computeName ?? "default";

  const manifest: HostingManifest = {
    version: 1,
    staticAssets: "static",
    routes: [
      { source: "/_astro/.*", target: "static" },
      { source: "/.*", target: "compute" },
    ],
    compute: {
      [computeName]: {
        runtime: "NodeJs-24.x",
        directory: `compute/${computeName}`,
        entrypoint: "index.js",
      },
    },
  };

  if (!validateHostingManifest(manifest)) {
    throw new Error("poc-adapter-astro produced an invalid hosting manifest");
  }

  return manifest;
}
