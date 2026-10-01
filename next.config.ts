import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desktop packaging: emit a self-contained server we can spawn from Electron.
  ...(process.env.AIRA_PACKAGE === "1" ? { output: "standalone" as const } : {}),
  // Native driver-adapter modules must stay outside the bundler.
  serverExternalPackages: ["@prisma/adapter-better-sqlite3", "better-sqlite3", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
