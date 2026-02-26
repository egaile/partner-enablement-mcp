/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/docs/**": ["./content/docs/**/*"],
    },
  },
};
module.exports = nextConfig;
