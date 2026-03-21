import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function getRequestId(request: NextRequest) {
  const existingRequestId = request.headers.get("x-request-id")?.trim();

  return existingRequestId || crypto.randomUUID();
}

export function proxy(request: NextRequest) {
  const requestId = getRequestId(request);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("x-request-id", requestId);

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
