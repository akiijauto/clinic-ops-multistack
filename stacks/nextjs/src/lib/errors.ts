/**
 * The error vocabulary from `spec/openapi.yaml`'s "エラーの文言" table.
 *
 * The wording is fixed **verbatim** across all five implementations
 * (`DECISIONS.md` 4). Nobody writing a route handler invents their own
 * message; they pick one of these.
 */
export type ErrorCode =
  | 'invalid_json'
  | 'invalid_input'
  | 'not_found'
  | 'forbidden'
  | 'save_failed'
  | 'reservation_conflict';

export const ERROR_STATUS: Record<ErrorCode, number> = {
  invalid_json: 400,
  invalid_input: 422,
  not_found: 404,
  forbidden: 403,
  save_failed: 500,
  reservation_conflict: 409,
};

export const ERROR_MESSAGE: Record<ErrorCode, string> = {
  invalid_json: 'リクエストの本文がJSONとして壊れています。書き方を確認してください。',
  invalid_input: '入力の形式が正しくありません。必須の項目や値の型を確認してください。',
  not_found: '指定されたデータが見つかりません。',
  forbidden: 'この操作を行う権限がありません。',
  save_failed: '保存に失敗しました。時間をおいてもう一度お試しください。',
  reservation_conflict: '指定した時間帯は、担当または処置室の予定と重なっています。',
};

export type ErrorDetail = { field: string; message: string };

export type ErrorBody = {
  error: { code: ErrorCode; message: string; details?: ErrorDetail[] };
};

/** Builds the JSON body for `components.schemas.Error`. */
export function errorBody(code: ErrorCode, details?: ErrorDetail[]): ErrorBody {
  const body: ErrorBody = { error: { code, message: ERROR_MESSAGE[code] } };
  if (details && details.length > 0) body.error.details = details;
  return body;
}

/** A JSON error `Response` for an API route, matching status + wording. */
export function errorResponse(code: ErrorCode, details?: ErrorDetail[]): Response {
  return Response.json(errorBody(code, details), { status: ERROR_STATUS[code] });
}

/** Thrown by domain logic; caught at the route boundary and turned into the right response. */
export class ApiError extends Error {
  code: ErrorCode;
  details?: ErrorDetail[];
  constructor(code: ErrorCode, details?: ErrorDetail[]) {
    super(ERROR_MESSAGE[code]);
    this.code = code;
    this.details = details;
  }
  toResponse(): Response {
    return errorResponse(this.code, this.details);
  }
}

/**
 * Parses a JSON request body, distinguishing "not JSON at all" (400
 * `invalid_json`) from "valid JSON, wrong shape" (422 `invalid_input`,
 * raised later by the caller's own validation). Only this function may
 * throw `invalid_json`.
 */
export async function parseJsonBody(req: Request): Promise<unknown> {
  const text = await req.text();
  try {
    return text.length === 0 ? {} : JSON.parse(text);
  } catch {
    throw new ApiError('invalid_json');
  }
}

/** Wraps a route handler so a thrown `ApiError` becomes the right JSON response. */
export function withApiErrors(handler: () => Promise<Response>): Promise<Response> {
  return handler().catch((e) => {
    if (e instanceof ApiError) return e.toResponse();
    throw e;
  });
}
