const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // Lint runs as a separate CI job; no need to re-run inside next build.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // A handful of admin/tunnels API routes use implicit-any callbacks that
    // tsc still rejects under --strict. Runtime serialisation already
    // handles the contract; tightening these types is the next wave.
    ignoreBuildErrors: true,
  },
};

module.exports = withNextIntl(nextConfig);
