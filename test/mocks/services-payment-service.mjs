export class PaymentServiceError extends Error {}

export const paymentService = new Proxy(
  {},
  {
    get(_, property) {
      return (...args) => {
        if (!globalThis.__testPaymentService?.[property]) {
          throw new Error(`TEST_PAYMENT_SERVICE_METHOD_NOT_CONFIGURED:${String(property)}`);
        }

        return globalThis.__testPaymentService[property](...args);
      };
    },
  },
);
