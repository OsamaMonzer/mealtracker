/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sqlite3', 'sqlite']
  }
};
module.exports = nextConfig;
