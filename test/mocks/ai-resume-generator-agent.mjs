export const resumeGeneratorAgent = new Proxy(
  {},
  {
    get(_, property) {
      return (...args) => {
        if (!globalThis.__testResumeGeneratorAgent?.[property]) {
          throw new Error(
            `TEST_RESUME_GENERATOR_AGENT_METHOD_NOT_CONFIGURED:${String(property)}`,
          );
        }

        return globalThis.__testResumeGeneratorAgent[property](...args);
      };
    },
  },
);
