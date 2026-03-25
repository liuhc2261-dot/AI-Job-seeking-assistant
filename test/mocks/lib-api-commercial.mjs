export async function getAuthenticatedCommercialUserId() {
  if (!globalThis.__testLibApiCommercial?.getAuthenticatedCommercialUserId) {
    throw new Error("TEST_LIB_API_COMMERCIAL_METHOD_NOT_CONFIGURED:getAuthenticatedCommercialUserId");
  }

  return globalThis.__testLibApiCommercial.getAuthenticatedCommercialUserId();
}

export function getCommercialApiErrorResponse(error) {
  if (!globalThis.__testLibApiCommercial?.getCommercialApiErrorResponse) {
    throw new Error("TEST_LIB_API_COMMERCIAL_METHOD_NOT_CONFIGURED:getCommercialApiErrorResponse");
  }

  return globalThis.__testLibApiCommercial.getCommercialApiErrorResponse(error);
}

export function hasValidCommerceCallbackSecret(request) {
  if (!globalThis.__testLibApiCommercial?.hasValidCommerceCallbackSecret) {
    throw new Error("TEST_LIB_API_COMMERCIAL_METHOD_NOT_CONFIGURED:hasValidCommerceCallbackSecret");
  }

  return globalThis.__testLibApiCommercial.hasValidCommerceCallbackSecret(request);
}
