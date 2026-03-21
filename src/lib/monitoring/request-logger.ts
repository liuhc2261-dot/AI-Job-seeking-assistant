type RequestLogValue = string | number | boolean | null | undefined;

type RequestLogExtra = Record<string, RequestLogValue>;

type CreateApiRequestLoggerInput = {
  request: Request;
  route: string;
  taskType: string;
};

type FinalizeApiRequestLogInput = {
  response: Response;
  userId?: string | null;
  extra?: RequestLogExtra;
};

function getRequestId(request: Request) {
  const existingRequestId = request.headers.get("x-request-id")?.trim();

  return existingRequestId || crypto.randomUUID();
}

function getRequestPath(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

function compactExtra(extra?: RequestLogExtra) {
  if (!extra) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(extra).filter(([, value]) => value !== undefined),
  );
}

function writeStructuredLog(input: Record<string, RequestLogValue>) {
  const payload = JSON.stringify(input);

  if (input.statusCode && Number(input.statusCode) >= 500) {
    console.error(payload);
    return;
  }

  if (input.statusCode && Number(input.statusCode) >= 400) {
    console.warn(payload);
    return;
  }

  console.info(payload);
}

export function createApiRequestLogger({
  request,
  route,
  taskType,
}: CreateApiRequestLoggerInput) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const path = getRequestPath(request);

  return {
    requestId,
    finalize({ response, userId, extra }: FinalizeApiRequestLogInput) {
      response.headers.set("x-request-id", requestId);

      writeStructuredLog({
        type: "api_request",
        requestId,
        taskType,
        route,
        method: request.method,
        path,
        userId: userId ?? null,
        statusCode: response.status,
        success: response.ok,
        latencyMs: Date.now() - startedAt,
        ...compactExtra(extra),
      });

      return response;
    },
  };
}
