export const resumeService = new Proxy(
  {},
  {
    get(_, property) {
      return (...args) => {
        if (!globalThis.__testResumeService?.[property]) {
          throw new Error(`TEST_RESUME_SERVICE_METHOD_NOT_CONFIGURED:${String(property)}`);
        }

        return globalThis.__testResumeService[property](...args);
      };
    },
  },
);
