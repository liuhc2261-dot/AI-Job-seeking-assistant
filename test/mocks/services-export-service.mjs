export const exportService = new Proxy(
  {},
  {
    get(_, property) {
      return (...args) => {
        if (!globalThis.__testExportService?.[property]) {
          throw new Error(`TEST_EXPORT_SERVICE_METHOD_NOT_CONFIGURED:${String(property)}`);
        }

        return globalThis.__testExportService[property](...args);
      };
    },
  },
);
