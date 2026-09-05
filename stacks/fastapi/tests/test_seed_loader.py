"""seed投入の見張り。`data/README.md` の件数表と実際に入った件数が一致するか。

ここで2件、実装しながら踏んだ不具合がある。**両方とも「単発の小さな検証では
見えず、フルセットを1回で流したときだけ出る」種類**だった。

1. FK制約が伝票（Billing）で失敗する — 2000件超をまとめて1回 flush すると、
   SQLAlchemyの自動テーブル順序解決が期待どおりに効かなかった
   （エンティティ群ごとに `session.flush()` を挟んで解決）
2. `care_records.id` は入院ごとに1から振り直されており、全体では一意でない
   （seed.json 側の仕様。DBに採番させる形に直した）
"""

from __future__ import annotations

from app import fixtures, models


def test_seed_counts_match_data_readme(client):
    # client フィクスチャがアプリを起動する時点で seed が投入される（app/main.py lifespan）。
    from app.db import get_session_factory

    seed = fixtures.seed()
    with get_session_factory()() as s:
        assert s.query(models.Clinic).count() == 1
        assert s.query(models.Staff).count() == len(seed["staff"])
        assert s.query(models.Owner).count() == len(seed["owners"])
        assert s.query(models.Patient).count() == len(seed["patients"])
        assert s.query(models.Billing).count() == len(seed["billings"])
        assert s.query(models.BillingDetail).count() == len(seed["billing_details"])
        assert s.query(models.Reservation).count() == len(seed["reservations"])
        assert s.query(models.Hospitalization).count() == len(seed["hospitalizations"])

        expected_care_records = sum(
            len(h.get("care_records", [])) for h in seed["hospitalizations"]
        )
        assert s.query(models.CareRecord).count() == expected_care_records


def test_seed_is_idempotent(client):
    """2回目の投入では増えない（`is_seeded` が既存の Clinic を見て止める）。"""
    from app.db import get_session_factory
    from app.seed_loader import load_seed

    with get_session_factory()() as s:
        before = s.query(models.Patient).count()
        load_seed(s)  # 2回目
        after = s.query(models.Patient).count()
        assert before == after
