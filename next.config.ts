import type { NextConfig } from "next";

// Site 100% estático: as vagas vêm de public/jobs.json (gerado pelo coletor) e o
// seu board fica no navegador. No GitHub Pages o site mora em /<repo>, por isso
// o basePath vem de variável de ambiente (vazio no `npm run dev`).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
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
