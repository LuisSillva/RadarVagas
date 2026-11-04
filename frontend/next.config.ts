import type { NextConfig } from "next";

// STATIC_EXPORT=1 gera um site estático em out/ (usado para a demo do portfólio).
// O export estático não suporta Cache Components, então eles só ficam ligados no build normal.
const staticExport = Boolean(process.env.STATIC_EXPORT);

const nextConfig: NextConfig = {
  ...(staticExport
    ? { output: "export" as const, images: { unoptimized: true } }
    : { cacheComponents: true, partialPrefetching: true }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
