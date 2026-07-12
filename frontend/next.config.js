/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  // Enables the minimal `.next/standalone` output copied by the Docker
  // build (see frontend/Dockerfile). Harmless for local `next dev`/`next start`.
  output: "standalone",
};

module.exports = nextConfig;
