"""エラーの形。`spec/openapi.yaml` の `Error` スキーマ・文言表が正。

**独自の文言を作らない**（`coordination/DECISIONS.md` 第4節）。契約にある6つの
`code` と文言だけを使う。領域ごとのルーターはここの `ApiError` を `raise` するだけでよい。

| code | HTTP | 文言 |
| --- | --- | --- |
| invalid_json | 400 | リクエストの本文がJSONとして壊れています。書き方を確認してください。 |
| invalid_input | 422 | 入力の形式が正しくありません。必須の項目や値の型を確認してください。 |
| not_found | 404 | 指定されたデータが見つかりません。 |
| forbidden | 403 | この操作を行う権限がありません。 |
| save_failed | 500 | 保存に失敗しました。時間をおいてもう一度お試しください。 |
| reservation_conflict | 409 | 指定した時間帯は、担当または処置室の予定と重なっています。 |
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# 契約の文言（一字一句）。ここ以外で新しい文言を作らない。
MESSAGES: dict[str, str] = {
    "invalid_json": "リクエストの本文がJSONとして壊れています。書き方を確認してください。",
    "invalid_input": "入力の形式が正しくありません。必須の項目や値の型を確認してください。",
    "not_found": "指定されたデータが見つかりません。",
    "forbidden": "この操作を行う権限がありません。",
    "save_failed": "保存に失敗しました。時間をおいてもう一度お試しください。",
    "reservation_conflict": "指定した時間帯は、担当または処置室の予定と重なっています。",
}

STATUS_BY_CODE: dict[str, int] = {
    "invalid_json": 400,
    "invalid_input": 422,
    "not_found": 404,
    "forbidden": 403,
    "save_failed": 500,
    "reservation_conflict": 409,
}


class ApiError(Exception):
    """データのルートで送出する。`code` は `MESSAGES` のキーのどれか。

    `details` は `invalid_input` のときだけ必須（契約：空配列は不可、最低1件）。
    """

    def __init__(self, code: str, details: list[dict[str, str]] | None = None):
        if code not in MESSAGES:
            raise ValueError(f"未知のエラーコード: {code}")
        if code == "invalid_input" and not details:
            raise ValueError("invalid_input には details が最低1件要る（契約）")
        self.code = code
        self.details = details
        super().__init__(MESSAGES[code])

    def to_body(self) -> dict:
        body: dict = {"error": {"code": self.code, "message": MESSAGES[self.code]}}
        if self.details:
            body["error"]["details"] = self.details
        return body


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=STATUS_BY_CODE[exc.code], content=exc.to_body())

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # FastAPI/Pydantic が拾った形の壊れ（型違い・必須欠落）は 422 invalid_input。
        # 本文がJSONとして構文的に壊れている場合も pydantic はここに投げてくるため、
        # メッセージ種別で invalid_json と区別する。
        is_json_syntax_error = any(
            e.get("type") == "json_invalid" for e in exc.errors()
        )
        code = "invalid_json" if is_json_syntax_error else "invalid_input"
        details = [
            {"field": ".".join(str(p) for p in e.get("loc", ())), "message": e.get("msg", "")}
            for e in exc.errors()
        ] or [{"field": "-", "message": "入力の形式を確認してください。"}]
        body = {"error": {"code": code, "message": MESSAGES[code]}}
        if code == "invalid_input":
            body["error"]["details"] = details
        status = 400 if code == "invalid_json" else 422
        return JSONResponse(status_code=status, content=body)

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        # データのルート（/api/...）だけ契約の形に載せる。画面のルートは
        # FastAPI既定のHTML相当（各領域が error-banner で自前に描画する）に任せる。
        if request.url.path.startswith("/api/") and exc.status_code == 404:
            return JSONResponse(status_code=404, content={
                "error": {"code": "not_found", "message": MESSAGES["not_found"]},
            })
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
