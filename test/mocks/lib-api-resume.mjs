export async function getAuthenticatedResumeUserId(...args) {
  if (!globalThis.__testLibApiResume?.getAuthenticatedResumeUserId) {
    throw new Error("TEST_GET_AUTHENTICATED_RESUME_USER_ID_NOT_CONFIGURED");
  }

  return globalThis.__testLibApiResume.getAuthenticatedResumeUserId(...args);
}

export function getResumeApiErrorResponse(...args) {
  if (!globalThis.__testLibApiResume?.getResumeApiErrorResponse) {
    throw new Error("TEST_GET_RESUME_API_ERROR_RESPONSE_NOT_CONFIGURED");
  }

  return globalThis.__testLibApiResume.getResumeApiErrorResponse(...args);
}
