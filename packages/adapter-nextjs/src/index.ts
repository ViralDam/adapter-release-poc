import {
  validateHostingManifest,
  type HostingManifest,
} from "@viraldam/poc-deployment-spec";

export function build(): HostingManifest {
  const manifest: HostingManifest = {
    version: 1,
    staticAssets: "static",
    routes: [
      { source: "/_next/static/.*", target: "static" },
      { source: "/.*", target: "compute" },
    ],
    compute: {
      default: {
        runtime: "NodeJs-24.x",
        directory: "compute/default",
        entrypoint: "index.js",
      },
    },
  };

  if (!validateHostingManifest(manifest)) {
    throw new Error("poc-adapter-nextjs produced an invalid hosting manifest");
  }

  return manifest;
}
