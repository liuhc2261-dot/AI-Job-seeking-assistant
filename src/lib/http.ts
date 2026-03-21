type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

type ApiErrorResponse = {
  success: false;
  error: {
    message: string;
    details?: unknown;
  };
};

export function apiOk<T>(
  data: T,
  init?: Omit<ResponseInit, "status"> & { status?: number },
) {
  return Response.json(
    {
      success: true,
      data,
    } satisfies ApiSuccessResponse<T>,
    { status: init?.status ?? 200, headers: init?.headers },
  );
}

export function apiError(
  message: string,
  status = 400,
  details?: unknown,
) {
  return Response.json(
    {
      success: false,
      error: {
        message,
        details,
      },
    } satisfies ApiErrorResponse,
    { status },
  );
}
