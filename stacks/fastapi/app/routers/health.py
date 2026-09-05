"""死活監視。

契約は **`/healthz`**（`spec/openapi.yaml` `api_healthz`）。
`briefs/lane-d.md` の「いまやること」には `/health` と書かれていたが、
**契約が正**なので `/healthz` にした（`qa/lane-d.md` D-4 に記録）。
別名の `/health` は置かない。契約に無い経路を1実装だけが持つと、
第3段階の突き合わせで「差」として出てしまうため。
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["api-misc"])


class HealthzResponse(BaseModel):
    # 契約は enum: ["ok"]。Literal にしておくと、うっかり別の値を返す実装に
    # なったとき**返す前に**落ちる。
    status: Literal["ok"]


@router.get("/healthz", response_model=HealthzResponse, operation_id="api_healthz")
def healthz() -> HealthzResponse:
    """認証を素通しする唯一のルート。落ちているのか閉じているのかを外から区別するため。"""
    return HealthzResponse(status="ok")
