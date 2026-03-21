export const profileService = new Proxy(
  {},
  {
    get(_, property) {
      return (...args) => {
        if (!globalThis.__testProfileService?.[property]) {
          throw new Error(`TEST_PROFILE_SERVICE_METHOD_NOT_CONFIGURED:${String(property)}`);
        }

        return globalThis.__testProfileService[property](...args);
      };
    },
  },
);
