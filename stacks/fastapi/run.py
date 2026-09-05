"""開発用の起動。`.venv/Scripts/python run.py` で 8414 番に立つ。

ポートはレーンごとに変える必要がある（5実装が同時に立つため）。
`coordination/PORTS.md` が唯一の正で、レーンDは **8414**
（8404 が「握ったまま死んだソケット」になったため、指揮役が振り直した。
`coordination/qa/lane-d.md` D-6 参照）。
"""

from __future__ import annotations

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=int(os.environ.get("PORT", "8414")),
        reload=True,
    )
