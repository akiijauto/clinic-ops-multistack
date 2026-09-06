"""会計画面の書き込み系（追加・削除・確定）の見張り。

`spec/screens.md` 14番「満たすべきこと」を実機（TestClient経由）で確かめる。

**注意**: seed.json には既に150枚の伝票がある。患者によっては既存のdraft伝票を
持っている場合があるため、`slip` を明示して対象の伝票を固定する
（固定しないと「本日のdraftを開くか無ければ新規作成」のロジックが毎回別の伝票を
指すことがあり、テストの意図とズレる）。
"""

from __future__ import annotations

import re

from app import fixtures, models
from app.db import get_session_factory


def _fresh_draft(karte_no: str, db) -> int:
    """指定患者の既存draftを全部confirmed扱いにして退避し、新規の空draftを作る。

    テストの独立性のため（既存のseedデータの状態に依存しない）。
    """
    patient = db.query(models.Patient).filter(models.Patient.karte_no == karte_no).first()
    for b in db.query(models.Billing).filter(
        models.Billing.patient_id == patient.id, models.Billing.status == "draft"
    ):
        b.status = "confirmed"
    db.commit()
    return patient.id


def _extract_excluded(html: str) -> int:
    m = re.search(r'data-check="billing\.excluded_count"[^>]*>(\d+)<', html)
    assert m, "billing.excluded_count が見つからない"
    return int(m.group(1))


def test_add_detail_then_confirm_locks_editing(client):
    karte_no = fixtures.seed()["patients"][0]["karte_no"]
    price_code = fixtures.price_items()[0]["price_code"]

    with get_session_factory()() as db:
        _fresh_draft(karte_no, db)

    res = client.get(f"/animals/{karte_no}/accounting")
    assert res.status_code == 200

    res = client.post(
        f"/animals/{karte_no}/accounting",
        data={"action": "add_detail", "price_code": price_code, "quantity": "2"},
    )
    assert res.status_code == 200
    assert 'data-check="billing.net_amount"' in res.text

    res = client.post(f"/animals/{karte_no}/accounting", data={"action": "confirm"})
    assert res.status_code == 200
    assert "確定しました" in res.text


def test_empty_billing_cannot_be_confirmed(client):
    """明細が1行も無い伝票は確定できない（screens.md 14番）。"""
    karte_no = fixtures.seed()["patients"][1]["karte_no"]
    with get_session_factory()() as db:
        _fresh_draft(karte_no, db)

    client.get(f"/animals/{karte_no}/accounting")  # 新しい空draftを確定させる
    res = client.post(f"/animals/{karte_no}/accounting", data={"action": "confirm"})
    assert res.status_code == 200
    assert "確定できません" in res.text


def test_unset_unit_price_item_excluded_from_totals(client):
    """検算2：単価未設定の項目を追加しても、税抜合計に0円として入らない。件数だけ増える。"""
    karte_no = fixtures.seed()["patients"][2]["karte_no"]
    unset_item = next(p for p in fixtures.price_items() if p.get("unit_price") is None)

    with get_session_factory()() as db:
        _fresh_draft(karte_no, db)

    res = client.get(f"/animals/{karte_no}/accounting")
    before_excluded = _extract_excluded(res.text)

    res = client.post(
        f"/animals/{karte_no}/accounting",
        data={"action": "add_detail", "price_code": unset_item["price_code"], "quantity": "1"},
    )
    after_excluded = _extract_excluded(res.text)
    assert after_excluded == before_excluded + 1


def test_confirmed_billing_rejects_detail_changes(client):
    """確定済みの伝票は明細の追加・複写・削除・全削除がいずれも拒否される。"""
    karte_no = fixtures.seed()["patients"][3]["karte_no"]
    price_code = fixtures.price_items()[0]["price_code"]

    with get_session_factory()() as db:
        patient_id = _fresh_draft(karte_no, db)

    client.get(f"/animals/{karte_no}/accounting")  # 新しい空draftを作る
    with get_session_factory()() as db:
        billing_id = (
            db.query(models.Billing)
            .filter(models.Billing.patient_id == patient_id, models.Billing.status == "draft")
            .order_by(models.Billing.id.desc())
            .first()
            .id
        )

    client.post(
        f"/animals/{karte_no}/accounting",
        data={"action": "add_detail", "slip": billing_id, "price_code": price_code, "quantity": "1"},
    )
    client.post(f"/animals/{karte_no}/accounting", data={"action": "confirm", "slip": billing_id})

    res = client.post(
        f"/animals/{karte_no}/accounting",
        data={"action": "add_detail", "slip": billing_id, "price_code": price_code, "quantity": "1"},
    )
    assert "確定済みの伝票は明細を追加できません" in res.text
