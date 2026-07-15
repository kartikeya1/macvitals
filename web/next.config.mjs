/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static export — no server, deploys to Vercel (or any static host)
  // as plain files. This is what keeps the whole thing client-side.
  output: "export",
  images: { unoptimized: true },
  // Emit /report/index.html so the route works on static hosts without config.
  trailingSlash: true,
};

export default nextConfig;
