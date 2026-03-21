export const prisma = new Proxy(
  {},
  {
    get(_, property) {
      if (!globalThis.__testPrisma) {
        throw new Error("TEST_PRISMA_NOT_CONFIGURED");
      }

      return globalThis.__testPrisma[property];
    },
  },
);
