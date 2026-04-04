import type { PrismaConfig } from "prisma/config";

if (!process.env.DATABASE_URL) {
  try {
    const dotenv = await import("dotenv");
    dotenv.config();
  } catch {
    // Ignore if dotenv fails
  }
}

const config: PrismaConfig = {
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
};

export default config;
