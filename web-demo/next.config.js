/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['partner-enablement-mcp-server', 'mcp-security-gateway'],
}

module.exports = nextConfig
