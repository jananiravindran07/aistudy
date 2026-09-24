/**
 * Application error type with a user-friendly message, an HTTP status,
 * and whether the caller may retry (e.g. rate limits / transient LLM errors).
 */
export class AppError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(
    status: number,
    message: string,
    options: { code?: string; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.status = status;
    this.code = options.code ?? 'error';
    this.retryable = options.retryable ?? status >= 500;
  }
}

/** Standard JSON body for unsuccessful API responses. */
export function errorBody(err: unknown) {
  if (err instanceof AppError) {
    return {
      error: {
        message: err.message,
        code: err.code,
        retryable: err.retryable,
      },
    };
  }
  console.error('[api] unhandled error', err);
  return {
    error: {
      message: 'Something went wrong on our end. Please try again.',
      code: 'internal',
      retryable: true,
    },
  };
}