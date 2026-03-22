export class ExportStorageError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

export const exportFileStorage = new Proxy(
  {},
  {
    get(_, property) {
      return (...args) => {
        if (!globalThis.__testExportStorage?.[property]) {
          throw new Error(
            `TEST_EXPORT_STORAGE_METHOD_NOT_CONFIGURED:${String(property)}`,
          );
        }

        return globalThis.__testExportStorage[property](...args);
      };
    },
  },
);
