export class CommercialAccessServiceError extends Error {}

export const commercialAccessService = new Proxy(
  {},
  {
    get(_, property) {
      return (...args) => {
        if (!globalThis.__testCommercialAccessService?.[property]) {
          throw new Error(
            `TEST_COMMERCIAL_ACCESS_SERVICE_METHOD_NOT_CONFIGURED:${String(property)}`,
          );
        }

        return globalThis.__testCommercialAccessService[property](...args);
      };
    },
  },
);
