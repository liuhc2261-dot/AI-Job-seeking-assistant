import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local" });
loadEnv();

const PLACEHOLDER_DATABASE_URL =
  "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public";

function resolveDatasourceUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.argv.includes("generate")) {
    return PLACEHOLDER_DATABASE_URL;
  }

  throw new Error(
    'DATABASE_URL is required for Prisma commands other than "prisma generate".',
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: resolveDatasourceUrl(),
  },
});
