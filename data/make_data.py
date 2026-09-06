#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
data/make_data.py
==================

5つの実装（Go / Rails / Laravel / FastAPI / Next.js）が共通で読み込む
合成データを生成する。標準ライブラリのみを使う（追加インストール不要）。

守っていること:
  - すべて架空のデータ（実在の病院・飼主・動物・獣医師・薬品名・保険会社名・料金は使わない）
  - 乱数の種を固定する（何度流しても同じ出力になる）
  - 壁時計（datetime.now）を一切使わない。日付はすべて ANCHOR_DATE を基準に計算する
  - 生成後に自分で検査し、結果を標準出力に出す（検査に落ちたら exit code 1）

出力:
  data/lab_items.json    検査項目と基準値（種別・性別で変わる）
  data/price_items.json  料金項目（単価未設定を意図的に8件混ぜる）
  data/masters.json      予防の種別・受付の種別・診療科・定型文
  data/seed.json         病院・スタッフ・飼主・動物・診察・会計・予約・入院などの初期データ

再生成する: `python data/make_data.py`
"""

import json
import os
import random
import sys
from datetime import date, datetime, timedelta

# Windows のコンソール既定コードページ(cp932)で日本語が文字化けするのを防ぐ
try:
    sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass

# ---------------------------------------------------------------------------
# 定数
# ---------------------------------------------------------------------------

SEED = 20260905  # 乱数の種。変えると全データが変わるので固定する
random.seed(SEED)

# 「今日」はここに固定する。datetime.now() は使わない
# (使うと実行日によって出力が変わり、2回流して同じ出力にならなくなるため)
# **基準日。既定は「このデータを作った日」。**
#
# 受付・診察は基準日に作られる。実装の「本日」は壁時計の日付なので、
# **基準日を過ぎると `/today` は5実装とも0件になり、受付区分の絞り込みが
# 効いているかを確かめられなくなる**（2026-09-06、オーナーの指摘で作り直した）。
#
#     確かめられない範囲は、減らせるなら減らす。
ANCHOR_DATE = date(2026, 9, 6)

JST = "+09:00"

# 出力先は**このファイルのある場所**に固定する。
# もとは "." で「data/ の中から実行される想定」だったが、リポジトリの
# ルートから流すとルート直下へ書き出してしまい、data/ が更新されないまま
# 「再生成した」と思い込む（2026-09-06 に実際に起きた）。
OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def jst_dt(d: date, hh: int, mm: int, ss: int = 0) -> str:
    return f"{d.isoformat()}T{hh:02d}:{mm:02d}:{ss:02d}{JST}"


def add_days(d: date, n: int) -> date:
    return d + timedelta(days=n)


# ---------------------------------------------------------------------------
# 名前・住所などの素材（すべて架空。実在の人物・団体を指さない一般的な組み合わせ）
# ---------------------------------------------------------------------------

SURNAMES = [
    # **実在しそうな一般的な姓を使わない。**
    # 最初は実際に多い姓を並べていたが、
    # 公開前のNGワード照合に引っかかった（2026-09-06 実測）。
    # 合成データに一般的な姓を使うと、**誰かの本名と当たる**。
    # 住所に「はるかぜ県こだま市」のような架空地名を使ったのと同じ理由で、
    # 姓も**架空と分かるもの**に揃える。
    ("春風", "はるかぜ"), ("小鳥遊", "たかなし"), ("八重樫", "やえがし"), ("風見", "かざみ"),
    ("水無瀬", "みなせ"), ("常磐", "ときわ"), ("東雲", "しののめ"), ("白瀬", "しらせ"),
    ("柊", "ひいらぎ"), ("楠見", "くすみ"), ("千歳", "ちとせ"), ("凪沢", "なぎさわ"),
    ("藤白", "ふじしろ"), ("朝比奈", "あさひな"), ("星野原", "ほしのはら"), ("琴平", "ことひら"),
    ("雪村", "ゆきむら"), ("真鶴", "まなづる"), ("宵待", "よいまち"), ("鷺沼", "さぎぬま"),
]

GIVEN_NAMES = [
    ("太郎", "たろう"), ("次郎", "じろう"), ("健一", "けんいち"), ("大輔", "だいすけ"),
    ("拓也", "たくや"), ("誠", "まこと"), ("修", "おさむ"), ("直樹", "なおき"),
    ("悠斗", "ゆうと"), ("翔太", "しょうた"), ("花子", "はなこ"), ("由美", "ゆみ"),
    ("恵子", "けいこ"), ("美咲", "みさき"), ("陽子", "ようこ"), ("さくら", "さくら"),
    ("真理", "まり"), ("舞", "まい"), ("愛", "あい"), ("千尋", "ちひろ"),
]

PET_NAMES = [
    ("ポチ", "ぽち"), ("タマ", "たま"), ("モモ", "もも"), ("ソラ", "そら"),
    ("マロン", "まろん"), ("チョコ", "ちょこ"), ("クッキー", "くっきー"), ("レオ", "れお"),
    ("ムギ", "むぎ"), ("ハナ", "はな"), ("ココ", "ここ"), ("ラテ", "らて"),
    ("ミルク", "みるく"), ("サクラ", "さくら"), ("ゴマ", "ごま"), ("アズキ", "あずき"),
    ("ノア", "のあ"), ("リク", "りく"), ("ベル", "べる"), ("パイ", "ぱい"),
    ("ロン", "ろん"), ("キナコ", "きなこ"), ("ユズ", "ゆず"), ("トト", "とと"),
]

# 架空の地名(実在の都道府県・市区町村と一致しない、明らかに架空と分かる形)
FAKE_PREFECTURES = ["みなも県", "はるかぜ県", "とわの県", "ひばり県"]
FAKE_CITIES = ["すみれ市", "こだま市", "あさひ野市", "つきかげ市", "ひかり市"]

DOG_BREEDS = [
    "柴犬", "トイプードル", "チワワ", "ミニチュアダックスフンド", "ポメラニアン",
    "フレンチブルドッグ", "ゴールデンレトリバー", "ラブラドールレトリバー",
    "ヨークシャーテリア", "パグ", "雑種(犬)",
]
CAT_BREEDS = [
    "雑種(猫)", "アメリカンショートヘア", "スコティッシュフォールド", "マンチカン",
    "ロシアンブルー", "ノルウェージャンフォレストキャット", "ラグドール",
]
OTHER_SPECIES = [
    ("rabbit", "ウサギ", ["ネザーランドドワーフ", "ホーランドロップ"]),
    ("bird", "鳥", ["セキセイインコ", "オカメインコ"]),
    ("ferret", "フェレット", ["フェレット"]),
]

PHRASES = {
    "chief_complaint": ["元気消失", "食欲不振", "嘔吐", "下痢", "咳", "痒み", "跛行", "健康診断希望"],
    "symptom": ["軽度の脱水あり", "可視粘膜やや蒼白", "腹部軽度膨満", "皮膚に発赤あり",
                "関節可動域に制限あり", "特記すべき異常所見なし", "耳道内に汚れあり", "軽度の疼痛反応あり"],
    "diagnosis": ["急性胃腸炎", "外耳炎", "アレルギー性皮膚炎", "軽度脱水", "健康",
                  "歯周病", "膀胱炎疑い", "経過観察"],
    "treatment": ["整腸剤処方", "点滴処置", "外用薬処方", "抗生剤投与", "経過観察",
                  "食事指導", "耳道洗浄", "鎮痛剤処方"],
}

PREVENTION_KINDS = [
    {"code": "vaccine_core", "name": "混合ワクチン"},
    {"code": "vaccine_rabies", "name": "狂犬病予防接種"},
    {"code": "heartworm", "name": "フィラリア予防"},
    {"code": "flea_tick", "name": "ノミ・マダニ予防"},
    {"code": "deworming", "name": "寄生虫駆除"},
]

RECEPTION_KINDS = [
    {"code": "first_visit", "name": "初診"},
    {"code": "revisit", "name": "再診"},
    {"code": "vaccination", "name": "予防接種"},
    {"code": "checkup", "name": "健康診断"},
    {"code": "emergency", "name": "急患"},
    {"code": "surgery_consult", "name": "手術相談"},
]

DEPARTMENTS = [
    {"code": "internal", "name": "内科"},
    {"code": "surgery", "name": "外科"},
    {"code": "dermatology", "name": "皮膚科"},
    {"code": "dentistry", "name": "歯科"},
    {"code": "ophthalmology", "name": "眼科"},
    {"code": "orthopedics", "name": "整形外科"},
]

PAYMENT_METHODS = ["cash", "credit_card", "electronic_money", "bank_transfer"]

# ---------------------------------------------------------------------------
# 検査項目マスタ (data/lab_items.json)
# ---------------------------------------------------------------------------

# (item_code, name, unit, category, dog_range, cat_range, other_range)
# range = (low, high)。sex は "any" 固定のもの、male/female で分けるものは
# LAB_ITEMS_SEX_SPLIT に別途持つ。
LAB_ITEMS_BASE = [
    ("RBC", "赤血球数", "10^6/uL", "血球算定", (5.5, 8.5), (5.0, 10.0), (3.0, 9.0)),
    ("WBC", "白血球数", "/uL", "血球算定", (6000, 17000), (5500, 19500), (4000, 20000)),
    ("HGB", "ヘモグロビン濃度", "g/dL", "血球算定", (12.0, 18.0), (8.0, 15.0), (8.0, 17.0)),
    ("HCT", "ヘマトクリット値", "%", "血球算定", (37.0, 55.0), (24.0, 45.0), (24.0, 55.0)),
    ("PLT", "血小板数", "10^4/uL", "血球算定", (20.0, 50.0), (30.0, 70.0), (15.0, 70.0)),
    ("MCV", "平均赤血球容積", "fL", "血球算定", (60.0, 77.0), (39.0, 55.0), (35.0, 80.0)),
    ("MCH", "平均赤血球血色素量", "pg", "血球算定", (19.5, 24.5), (12.5, 17.5), (12.0, 25.0)),
    ("MCHC", "平均赤血球血色素濃度", "g/dL", "血球算定", (32.0, 36.0), (30.0, 36.0), (28.0, 37.0)),
    ("NEUT", "好中球比率", "%", "血球算定", (60.0, 77.0), (35.0, 75.0), (30.0, 80.0)),
    ("LYMPH", "リンパ球比率", "%", "血球算定", (12.0, 30.0), (20.0, 55.0), (10.0, 55.0)),
    ("MONO", "単球比率", "%", "血球算定", (3.0, 10.0), (1.0, 4.0), (1.0, 10.0)),
    ("EOS", "好酸球比率", "%", "血球算定", (2.0, 10.0), (2.0, 12.0), (1.0, 12.0)),
    ("BASO", "好塩基球比率", "%", "血球算定", (0.0, 1.0), (0.0, 1.0), (0.0, 1.5)),
    ("TP", "総蛋白", "g/dL", "生化学", (5.4, 7.8), (5.7, 8.9), (5.0, 9.0)),
    ("ALB", "アルブミン", "g/dL", "生化学", (2.6, 4.0), (2.3, 3.9), (2.0, 4.2)),
    ("GLOB", "グロブリン", "g/dL", "生化学", (2.0, 3.6), (2.6, 5.1), (2.0, 5.5)),
    ("ALT", "ALT(GPT)", "U/L", "生化学", (10, 100), (12, 130), (10, 150)),
    ("AST", "AST(GOT)", "U/L", "生化学", (10, 50), (10, 40), (10, 60)),
    ("ALP", "ALP", "U/L", "生化学", (20, 150), (10, 90), (10, 200)),
    ("GGT", "GGT", "U/L", "生化学", (0, 10), (0, 5), (0, 15)),
    ("TBIL", "総ビリルビン", "mg/dL", "生化学", (0.0, 0.5), (0.0, 0.4), (0.0, 0.6)),
    ("BUN", "尿素窒素", "mg/dL", "生化学", (8.0, 28.0), (16.0, 36.0), (10.0, 40.0)),
    ("CRE", "クレアチニン", "mg/dL", "生化学", (0.4, 1.4), (0.6, 2.1), (0.3, 2.5)),
    ("GLU", "血糖値", "mg/dL", "生化学", (65.0, 118.0), (67.0, 124.0), (60.0, 150.0)),
    ("TCHO", "総コレステロール", "mg/dL", "生化学", (110.0, 320.0), (65.0, 220.0), (60.0, 330.0)),
    ("TG", "中性脂肪", "mg/dL", "生化学", (20.0, 130.0), (20.0, 110.0), (15.0, 150.0)),
    ("CA", "カルシウム", "mg/dL", "生化学", (9.0, 11.8), (8.0, 11.0), (8.0, 12.0)),
    ("IP", "無機リン", "mg/dL", "生化学", (2.5, 6.5), (3.0, 7.0), (2.0, 7.5)),
    ("NA", "ナトリウム", "mEq/L", "生化学", (140.0, 155.0), (145.0, 158.0), (135.0, 160.0)),
    ("K", "カリウム", "mEq/L", "生化学", (3.8, 5.6), (3.5, 5.5), (3.0, 6.0)),
]

# 性別で基準値が変わることを確認するため、CRE と ALB は雄雌で幅をずらす
LAB_ITEMS_SEX_SPLIT = {
    "CRE": {
        "dog": {"male": (0.5, 1.5), "female": (0.4, 1.2)},
        "cat": {"male": (0.7, 2.3), "female": (0.6, 1.9)},
    },
    "ALB": {
        "dog": {"male": (2.7, 4.1), "female": (2.5, 3.9)},
        "cat": {"male": (2.4, 4.0), "female": (2.3, 3.8)},
    },
}


def build_lab_items():
    items = []
    for code, name, unit, category, dog_r, cat_r, other_r in LAB_ITEMS_BASE:
        ranges = []
        if code in LAB_ITEMS_SEX_SPLIT:
            split = LAB_ITEMS_SEX_SPLIT[code]
            for species in ("dog", "cat"):
                for sex in ("male", "female"):
                    low, high = split[species][sex]
                    ranges.append({"species": species, "sex": sex, "low": low, "high": high})
            ranges.append({"species": "other", "sex": "any", "low": other_r[0], "high": other_r[1]})
        else:
            ranges.append({"species": "dog", "sex": "any", "low": dog_r[0], "high": dog_r[1]})
            ranges.append({"species": "cat", "sex": "any", "low": cat_r[0], "high": cat_r[1]})
            ranges.append({"species": "other", "sex": "any", "low": other_r[0], "high": other_r[1]})
        items.append({
            "item_code": code,
            "name": name,
            "unit": unit,
            "category": category,
            "reference_ranges": ranges,
        })
    assert len(items) == 30, f"lab_items must be 30, got {len(items)}"
    return items


def lookup_range(lab_items_by_code, item_code, species, sex):
    """species: 'dog'/'cat'/その他すべて 'other' 扱い。sex: 'male'/'female'/'unknown'"""
    entry = lab_items_by_code[item_code]
    sp = species if species in ("dog", "cat") else "other"
    candidates = [r for r in entry["reference_ranges"] if r["species"] == sp]
    # sex 指定があるものを優先。無ければ any を使う
    for r in candidates:
        if r["sex"] == sex:
            return r["low"], r["high"]
    for r in candidates:
        if r["sex"] == "any":
            return r["low"], r["high"]
    # sp = other 相当のフォールバック
    fallback = [r for r in entry["reference_ranges"] if r["species"] == "other"]
    return fallback[0]["low"], fallback[0]["high"]


# ---------------------------------------------------------------------------
# 料金マスタ (data/price_items.json)
# ---------------------------------------------------------------------------

# 大分類 -> [(名称テンプレート, 目安単価 or None, 課税区分)]
# 単価・名称はすべて架空。実在の料金表を参照していない
#
# **単価に端数を混ぜてある。**
#
# 以前は112件中109件が10の倍数で、税率10%だと**税額に端数が出なかった**。
# そのため「消費税は伝票単位で1回だけ切り捨て」という規則が、
# **150枚すべての伝票で明細ごとに切り捨てても同じ答え**になり、
# 検算が緑でも**何も見張っていなかった**（2026-09-05に判定器自身が指摘）。
#
#     検算が働いているかどうかは、**データが決める**。
#     区別できない値ばかりを入れると、規則は永久に確かめられない。
PRICE_CATALOG = {
    "診察料": [
        ("初診料", 1107, True), ("再診料", 553, True), ("時間外診察料", 3307, True),
        ("往診料", 5507, True), ("健康診断料", 2207, True), ("セカンドオピニオン料", 3307, True),
        ("電話再診料", 553, True), ("死亡診断料", 3307, True), ("紹介状作成料", 2207, True),
        ("入院管理料(1日)", 1653, True), ("往診交通費", None, True), ("休日加算", 1107, True),
        ("深夜加算", 2207, True), ("往診時間延長料", 2753, True), ("診断書発行料", 1653, True),
    ],
    "検査料": [
        ("血液一般検査", 3307, True), ("生化学検査(基本項目)", 4407, True), ("生化学検査(追加項目)", None, True),
        ("尿検査", 1653, True), ("糞便検査", 1107, True), ("レントゲン検査(1部位)", 3307, True),
        ("レントゲン検査(追加部位)", 1653, True), ("超音波検査", 4407, True), ("心電図検査", 2753, True),
        ("血液凝固検査", 3853, True), ("アレルギー検査", 6607, True), ("ホルモン検査", 5507, True),
        ("感染症迅速検査", 3307, True), ("細胞診検査", 2753, True), ("血液型検査", 2207, True),
    ],
    "処置料": [
        ("点滴処置(皮下)", 1653, True), ("点滴処置(静脈内)", 2753, True), ("注射(筋肉内)", 887, True),
        ("注射(皮下)", 773, True), ("創傷処置", 1653, True), ("耳道洗浄", 1107, True),
        ("爪切り", 553, True), ("肛門腺絞り", 553, True), ("浣腸処置", 1653, True),
        ("包帯交換", 887, True), ("導尿処置", 2207, True), ("酸素吸入(30分)", None, True),
        ("ネブライザー処置", 1653, True), ("止血処置", None, True), ("胃洗浄", 3307, True),
    ],
    "手術料": [
        ("避妊手術(犬・小型)", 33007, True), ("避妊手術(犬・大型)", 44007, True), ("避妊手術(猫)", 27507, True),
        ("去勢手術(犬)", 22007, True), ("去勢手術(猫)", 16507, True), ("腫瘍摘出術(小)", 27507, True),
        ("腫瘍摘出術(大)", 55007, True), ("歯石除去(全身麻酔下)", 22007, True), ("抜歯処置", 5507, True),
        ("異物除去手術", 66007, True), ("骨折整復術", None, True), ("帝王切開術", 55007, True),
        ("眼瞼形成術", 33007, True), ("会陰ヘルニア整復術", 77007, True), ("麻酔管理料", 5507, True),
    ],
    "予防": [
        ("混合ワクチン(5種)", 6607, True), ("混合ワクチン(8種)", 8807, True), ("狂犬病予防接種", 3507, True),
        ("フィラリア予防薬(1ヶ月分・小型)", 1653, True), ("フィラリア予防薬(1ヶ月分・大型)", 2753, True),
        ("フィラリア抗原検査", 2207, True), ("ノミ・マダニ予防薬(1本)", 2207, True),
        ("駆虫薬(内部寄生虫)", 1653, True), ("猫エイズ・白血病検査", 3853, True), ("マイクロチップ挿入", 5507, True),
        ("狂犬病登録手数料", None, True), ("ワクチン抗体価検査", 5507, True), ("予防相談料", 0, True),
        ("フィラリア予防薬(1ヶ月分・中型)", 2207, True), ("ノミ・マダニ予防薬(お試し1回分)", 1107, True),
    ],
    "入院料": [
        ("入院基本料(1日・小型)", 3307, True), ("入院基本料(1日・大型)", 4407, True), ("集中管理入院料(1日)", 6607, True),
        ("酸素室使用料(1日)", 3307, True), ("入院中投薬料(1日)", 1107, True), ("入院中給餌料(1日)", 553, True),
        ("面会立会料", 0, True), ("入院中点滴管理料(1日)", 1653, True), ("退院時サマリー作成料", 1107, True),
        ("入院中モニタリング料(1日)", 2207, True), ("隔離室使用料(1日)", 4407, True), ("入院中検温料(1回)", 0, True),
        ("入院延長管理料(1日)", 3307, True), ("入院中包帯交換料", 887, True), ("入院準備料", 1107, True),
    ],
    "物品販売": [
        ("療法食(缶・1個)", 447, True), ("療法食(ドライ・1袋)", 3307, True), ("エリザベスカラー", 1653, True),
        ("サプリメント(関節用)", 3853, True), ("サプリメント(皮膚用)", 3307, True), ("歯みがきガム(1箱)", 887, True),
        ("シャンプー(薬用)", 2207, True), ("爪切り用具", 1653, True), ("ペット用消臭剤", 1327, True),
        ("キャリーバッグ", 4407, True), ("介護用リハビリ用品", None, True), ("包帯・ガーゼセット", 667, True),
        ("療法食(猫用・缶)", 447, True), ("サプリメント(整腸用)", 2753, True), ("防水シート(1パック)", 993, True),
    ],
    "その他": [
        ("診断書再発行料", 1107, True), ("カルテ開示手数料", 2207, False), ("ペット霊園紹介料", 0, False),
        ("火葬手配代行料", None, False), ("郵送料", 507, False), ("キャンセル料", 1107, False),
        ("駐車場利用料", 0, False), ("会員登録料", 1107, False), ("ペットシーツ(1枚)", 33, True),
        ("待合室コピー代", 11, True), ("ペット保険相談料", 0, False), ("預り金領収書再発行", 0, False),
        ("院内資料コピー代", 22, True), ("往診用消耗品費", 887, True), ("その他雑費", 0, False),
    ],
}


def build_price_items():
    items = []
    idx = 1
    unset_count = 0
    for major, rows in PRICE_CATALOG.items():
        for name, price, taxable in rows:
            code = f"PR{idx:04d}"
            items.append({
                "price_code": code,
                "name": name,
                "unit_price": price,  # None = 単価未設定
                "is_taxable": taxable,
                "category_major": major,
                "category": major,  # 2階層のうち小分類は品目名に近く、まとめ表示用に大分類を複製
            })
            if price is None:
                unset_count += 1
            idx += 1
    assert len(items) == 120, f"price_items must be 120, got {len(items)}"
    assert unset_count == 8, f"unit_price unset must be 8, got {unset_count}"
    return items


# ---------------------------------------------------------------------------
# masters.json
# ---------------------------------------------------------------------------

def build_masters():
    price_categories = [{"major": major, "count": len(rows)} for major, rows in PRICE_CATALOG.items()]
    return {
        "prevention_kinds": PREVENTION_KINDS,
        "reception_kinds": RECEPTION_KINDS,
        "departments": DEPARTMENTS,
        "phrases": PHRASES,
        "price_categories": price_categories,
    }


# ---------------------------------------------------------------------------
# seed.json - Clinic / Staff
# ---------------------------------------------------------------------------

def build_clinic():
    return {
        "id": 1,
        "name": "はるかぜ動物病院",
        "postal_code": "999-0001",
        "address1": "みなも県すみれ市かえで町1-2-3",
        "address2": "はるかぜビル1F",
        "phone": "03-0000-0001",
        "fax": "03-0000-0002",
        "director_name": "架空 一郎",
        "reservation_slot_minutes": 15,
        "tax_rate": 0.10,
        "closed_weekdays": [2],  # 0=月 … 6=日。水曜休診
    }


STAFF_DEFS = [
    ("S001", "架空 一郎", "vet"),
    ("S002", "架空 二郎", "vet"),
    ("S003", "架空 三郎", "vet"),
    ("S004", "架空 花子", "nurse"),
    ("S005", "架空 恵美", "nurse"),
    ("S006", "架空 直子", "nurse"),
    ("S007", "架空 修二", "nurse"),
    ("S008", "架空 由紀", "office"),
    ("S009", "架空 大輔", "office"),
    ("S010", "架空 桃子", "vet"),
]


def build_staff():
    import hashlib
    staff = []
    for i, (code, name, role) in enumerate(STAFF_DEFS, start=1):
        # 平文のパスワードは持たない。ダミー文字列のハッシュ値を入れる
        digest = hashlib.sha256(f"seed-only-not-a-real-password-{code}".encode("utf-8")).hexdigest()
        staff.append({
            "id": i,
            "staff_code": code,
            "name": name,
            "role": role,
            "is_active": not (i in (9,)),  # 1名だけ退職済み扱いにして is_active=False を混ぜる
            "password_hash": digest,
        })
    return staff


# ---------------------------------------------------------------------------
# Owners / Patients
# ---------------------------------------------------------------------------

def build_owners(n=40):
    owners = []
    deleted_ids = {7, 23}  # 削除済み(deleted_at あり)を少数含める
    for i in range(1, n + 1):
        sname, skana = random.choice(SURNAMES)
        gname, gkana = random.choice(GIVEN_NAMES)
        pref = FAKE_PREFECTURES[i % len(FAKE_PREFECTURES)]
        city = FAKE_CITIES[i % len(FAKE_CITIES)]
        deleted_at = None
        if i in deleted_ids:
            deleted_at = jst_dt(add_days(ANCHOR_DATE, -30 + i), 10, 0)
        owners.append({
            "id": i,
            "owner_no": f"O-{i:05d}",
            "name_kana": f"{skana} {gkana}",
            "name_kanji": f"{sname} {gname}",
            "postal_code": f"{900 + (i % 90):03d}-{1000 + i:04d}",
            "address1": f"{pref}{city}{(i % 9) + 1}丁目{(i % 20) + 1}-{(i % 15) + 1}",
            "address2": "" if i % 3 else f"はるかぜマンション{100 + i}",
            "phone": f"03-0000-{2000 + i:04d}",
            "mobile": f"090-0000-{3000 + i:04d}",
            "deleted_at": deleted_at,
        })
    return owners


def build_patients(owners, n=60):
    patients = []
    deleted_ids = {15, 42}
    owner_ids = [o["id"] for o in owners]
    # まず各飼主に1匹ずつ割り当て、残りをランダムな飼主へ追加して
    # 「1人の飼主に複数の動物がぶら下がる」形を作る
    assigned_owner_for = list(owner_ids)  # 40件
    remaining = n - len(assigned_owner_for)  # 20件を追加配分
    extra_owner_for = [random.choice(owner_ids) for _ in range(remaining)]
    all_owner_for = assigned_owner_for + extra_owner_for
    random.shuffle(all_owner_for)

    for i in range(1, n + 1):
        owner_id = all_owner_for[i - 1]
        species_roll = random.random()
        if species_roll < 0.55:
            species, breed = "dog", random.choice(DOG_BREEDS)
        elif species_roll < 0.90:
            species, breed = "cat", random.choice(CAT_BREEDS)
        else:
            species, _, breeds = random.choice(OTHER_SPECIES)
            breed = random.choice(breeds)
        pname, pkana = PET_NAMES[(i - 1) % len(PET_NAMES)]
        sex = random.choice(["male", "female", "female", "male", "unknown"])
        age_days = random.randint(180, 15 * 365)
        birth_date = add_days(ANCHOR_DATE, -age_days)
        neuter_date = None
        if sex in ("male", "female") and random.random() < 0.5:
            neuter_date = add_days(birth_date, random.randint(180, 600))
        deleted_at = None
        if i in deleted_ids:
            deleted_at = jst_dt(add_days(ANCHOR_DATE, -10 + i), 11, 0)
        patients.append({
            "id": i,
            "karte_no": f"{10000 + i}",
            "owner_id": owner_id,
            "name_kana": pkana,
            "name_kanji": pname,
            "species": species,
            "breed": breed,
            "sex": sex,
            "birth_date": birth_date.isoformat(),
            "neuter_date": neuter_date.isoformat() if neuter_date else None,
            "deleted_at": deleted_at,
        })
    return patients


# ---------------------------------------------------------------------------
# Visits / ProgressNotes
# ---------------------------------------------------------------------------

VET_ROLE = "vet"


def staff_ids_by_role(staff, role):
    return [s["id"] for s in staff if s["role"] == role and s["is_active"]]


def base_weight_for(species):
    if species == "dog":
        return random.uniform(3.0, 35.0)
    if species == "cat":
        return random.uniform(2.5, 6.5)
    return random.uniform(0.3, 3.0)


def build_visits(patients, staff, n=200):
    vets = staff_ids_by_role(staff, VET_ROLE)
    visits = []
    visit_no_counter = {p["id"]: 0 for p in patients}
    # 患者ごとの基準体重を先に決めておく(体重・体温が患者ごとに違うことを保証するため)
    base_weight = {p["id"]: round(base_weight_for(p["species"]), 1) for p in patients}

    deleted_ids = {33, 150}
    for i in range(1, n + 1):
        patient = random.choice(patients)
        pid = patient["id"]
        visit_no_counter[pid] += 1
        days_ago = random.randint(0, 700)
        vdate = add_days(ANCHOR_DATE, -days_ago)
        vtime_h = random.randint(9, 17)
        vtime_m = random.choice([0, 15, 30, 45])
        weight = round(base_weight[pid] + random.uniform(-0.3, 0.3), 1)
        staff_id = random.choice(vets)
        deleted_at = None
        if i in deleted_ids:
            deleted_at = jst_dt(add_days(vdate, 1), 9, 30)
        visits.append({
            "id": i,
            "patient_id": pid,
            "visit_no": visit_no_counter[pid],
            "visit_date": vdate.isoformat(),
            "visit_time": f"{vtime_h:02d}:{vtime_m:02d}",
            "body_weight_kg": weight,
            "chief_complaint": random.choice(PHRASES["chief_complaint"]),
            "symptom": random.choice(PHRASES["symptom"]),
            "diagnosis": random.choice(PHRASES["diagnosis"]),
            "treatment": random.choice(PHRASES["treatment"]),
            "staff_id": staff_id,
            "deleted_at": deleted_at,
        })
    return visits, base_weight


def build_progress_notes(visits, patients, base_weight, ratio=0.7):
    notes = []
    note_id = 1
    patients_by_id = {p["id"]: p for p in patients}
    # 患者ごとの基準体温を先に決める(全員同じ体温にならないようにするため)
    base_temp = {}
    for p in patients:
        # 犬・猫は概ね38度前後、その他は個体差が大きいので幅を広く取る
        if p["species"] in ("dog", "cat"):
            base_temp[p["id"]] = round(random.uniform(37.8, 39.2), 1)
        else:
            base_temp[p["id"]] = round(random.uniform(37.0, 40.0), 1)

    for visit in visits:
        if random.random() > ratio:
            continue
        pid = visit["patient_id"]
        rows = random.randint(1, 3)
        for row_no in range(1, rows + 1):
            entry_date = add_days(date.fromisoformat(visit["visit_date"]), row_no - 1)
            temp = round(base_temp[pid] + random.uniform(-0.4, 0.4), 1)
            notes.append({
                "id": note_id,
                "visit_id": visit["id"],
                "row_no": row_no,
                "entry_date": entry_date.isoformat(),
                "temperature_c": temp,
                "pulse": random.randint(60, 160),
                "respiration": random.randint(10, 40),
                "body_weight_kg": round(base_weight[pid] + random.uniform(-0.3, 0.3), 1),
                "symptom_course": random.choice(PHRASES["symptom"]),
                "treatment_rx": random.choice(PHRASES["treatment"]),
                "note": "",
            })
            note_id += 1
    return notes


# ---------------------------------------------------------------------------
# Receptions (本日の患者)
# ---------------------------------------------------------------------------

def build_receptions(patients, staff, n=25):
    staff_pool = [s["id"] for s in staff if s["is_active"]]
    receptions = []
    statuses = ["waiting", "in_exam", "done"]
    for i in range(1, n + 1):
        patient = random.choice(patients)
        hh = 9 + (i % 8)
        mm = (i * 7) % 60
        receptions.append({
            "id": i,
            "patient_id": patient["id"],
            "display_no": i,
            "received_at": jst_dt(ANCHOR_DATE, hh, mm),
            "owner_purpose": random.choice(PHRASES["chief_complaint"]),
            "medical_purpose": random.choice(RECEPTION_KINDS)["name"],
            "status": statuses[min(i // 9, 2)],
            "staff_id": random.choice(staff_pool),
        })
    return receptions


# ---------------------------------------------------------------------------
# Prevention / Dosing
# ---------------------------------------------------------------------------

def build_preventions(patients, n=80):
    preventions = []
    for i in range(1, n + 1):
        patient = random.choice(patients)
        kind = random.choice(PREVENTION_KINDS)
        days_ago = random.randint(0, 400)
        performed = add_days(ANCHOR_DATE, -days_ago)
        interval = 365 if kind["code"] in ("vaccine_core", "vaccine_rabies") else 30
        next_due = add_days(performed, interval)
        preventions.append({
            "id": i,
            "patient_id": patient["id"],
            "kind": kind["code"],
            "content": kind["name"],
            "performed_date": performed.isoformat(),
            "next_due_date": next_due.isoformat(),
        })
    return preventions


def build_dosings(patients, n=40):
    dosings = []
    fiscal_year = ANCHOR_DATE.year
    marks = ["○", "○", "○", "", "×"]
    chosen = random.sample(patients, k=min(n, len(patients)))
    for i, patient in enumerate(chosen, start=1):
        months = {f"m{m:02d}": random.choice(marks) for m in range(1, 13)}
        dosings.append({
            "id": i,
            "patient_id": patient["id"],
            "kind": "heartworm",
            "fiscal_year": fiscal_year,
            **months,
        })
    return dosings


# ---------------------------------------------------------------------------
# LabTest / LabTestItem
# ---------------------------------------------------------------------------

def build_lab_tests_and_items(patients, visits, staff, lab_items, n=80):
    lab_items_by_code = {item["item_code"]: item for item in lab_items}
    item_codes = list(lab_items_by_code.keys())
    staff_pool = [s["id"] for s in staff if s["is_active"]]

    visits_by_patient = {}
    for v in visits:
        visits_by_patient.setdefault(v["patient_id"], []).append(v)
    patients_with_visits = [p for p in patients if p["id"] in visits_by_patient]

    tests = []
    test_items = []
    test_item_id = 1
    out_of_range_count = 0
    in_range_count = 0

    for i in range(1, n + 1):
        patient = random.choice(patients_with_visits)
        visit = random.choice(visits_by_patient[patient["id"]])
        category = random.choice(["血液一般", "生化学", "血球算定+生化学"])
        days_ago = random.randint(0, 700)
        tested_on = add_days(ANCHOR_DATE, -days_ago)
        tests.append({
            "id": i,
            "patient_id": patient["id"],
            "visit_id": visit["id"],
            "category": category,
            "tested_on": tested_on.isoformat(),
            "tested_at_time": f"{random.randint(9, 17):02d}:{random.choice([0, 15, 30, 45]):02d}",
            "staff_id": random.choice(staff_pool),
        })

        sex_for_lookup = patient["sex"] if patient["sex"] in ("male", "female") else "any"
        n_items = random.randint(4, 6)
        codes = random.sample(item_codes, k=n_items)
        for code in codes:
            low, high = lookup_range(lab_items_by_code, code, patient["species"], sex_for_lookup)
            width = high - low
            # 約3割は基準の外の値にする(下回る/上回るをランダムに選ぶ)
            if random.random() < 0.3:
                if random.random() < 0.5:
                    value = round(low - width * random.uniform(0.05, 0.35), 2)
                else:
                    value = round(high + width * random.uniform(0.05, 0.35), 2)
                out_of_range_count += 1
            else:
                value = round(low + width * random.uniform(0.15, 0.85), 2)
                in_range_count += 1
            test_items.append({
                "id": test_item_id,
                "lab_test_id": i,
                "item_code": code,
                "value_num": value,
                "value_text": None,
            })
            test_item_id += 1

    return tests, test_items, out_of_range_count, in_range_count


# ---------------------------------------------------------------------------
# Billing / BillingDetail
# ---------------------------------------------------------------------------

def build_billings_and_details(patients, staff, price_items, n_billing=150, n_detail=600):
    staff_pool = [s["id"] for s in staff if s["is_active"]]
    cashier_pool = [s["id"] for s in staff if s["role"] == "office" and s["is_active"]] or staff_pool
    priced_items = [p for p in price_items if p["unit_price"] is not None]
    unset_items = [p for p in price_items if p["unit_price"] is None]

    billings = []
    details = []
    detail_id = 1
    unset_hit_billing_ids = set()

    # まず各伝票の明細行数を決め、合計 n_detail 件になるよう調整する
    base_rows = n_detail // n_billing  # 4
    extra = n_detail - base_rows * n_billing  # 余りを先頭の伝票に配る
    rows_per_billing = [base_rows + (1 if i < extra else 0) for i in range(n_billing)]

    # 単価未設定の明細を複数の伝票にまたがって仕込む(1枚だけに集中させない)
    unset_target_billings = random.sample(range(n_billing), k=min(16, n_billing))

    for bi in range(n_billing):
        i = bi + 1
        patient = random.choice(patients)
        owner_id = patient["owner_id"]
        days_ago = random.randint(0, 700)
        billed_on = add_days(ANCHOR_DATE, -days_ago)
        status = "confirmed" if random.random() < 0.8 else "draft"
        staff_id = random.choice(staff_pool)
        cashier_staff_id = random.choice(cashier_pool)

        n_rows = max(1, rows_per_billing[bi])
        row_defs = []
        # この伝票に単価未設定行を混ぜるか
        include_unset = bi in unset_target_billings
        for row_no in range(1, n_rows + 1):
            if include_unset and row_no == 1:
                item = random.choice(unset_items)
                unset_hit_billing_ids.add(i)
            else:
                item = random.choice(priced_items)
            qty = random.choice([1, 1, 1, 2, 3])
            row_defs.append((item, qty))

        computed_total = 0
        unset_row_count = 0
        for row_no, (item, qty) in enumerate(row_defs, start=1):
            unit_price = item["unit_price"]
            if unit_price is None:
                unset_row_count += 1
            else:
                computed_total += unit_price * qty
            details.append({
                "id": detail_id,
                "billing_id": i,
                "row_no": row_no,
                "price_code": item["price_code"],
                "name": item["name"],
                "quantity": qty,
                "unit_price": unit_price,
                "is_taxable": item["is_taxable"],
            })
            detail_id += 1

        if status == "confirmed":
            paid_amount = computed_total
            payment_method = random.choice(PAYMENT_METHODS)
        else:
            paid_amount = None
            payment_method = None

        billings.append({
            "id": i,
            "patient_id": patient["id"],
            "owner_id": owner_id,
            "slip_no": f"B-{billed_on.strftime('%Y%m%d')}-{i:04d}",
            "status": status,
            "billed_on": billed_on.isoformat(),
            "staff_id": staff_id,
            "cashier_staff_id": cashier_staff_id,
            "paid_amount": paid_amount,
            "payment_method": payment_method,
            # 検算用の参考値(仕様上 Billing に保存フィールドは無いが、
            # 明細から計算した金額をここに残し、self-check で照合する)
            "_computed_total_priced_only": computed_total,
            "_unpriced_row_count": unset_row_count,
        })

    return billings, details, unset_hit_billing_ids


# ---------------------------------------------------------------------------
# Reservation
# ---------------------------------------------------------------------------

def build_reservations(patients, staff, clinic, n=60):
    vets = staff_ids_by_role(staff, VET_ROLE)
    rooms = ["診察室1", "診察室2"]
    slot_min = clinic["reservation_slot_minutes"]
    closed = set(clinic["closed_weekdays"])

    # 資源(担当 or 処置室)ごとに埋まっている区間を管理して重複を作らない
    busy = {}  # key: (kind, resource, date) -> list of (start_min, end_min)

    def is_free(kind, resource, d, start_min, end_min):
        key = (kind, resource, d)
        for s, e in busy.get(key, []):
            if start_min < e and s < end_min:
                return False
        return True

    def mark_busy(kind, resource, d, start_min, end_min):
        key = (kind, resource, d)
        busy.setdefault(key, []).append((start_min, end_min))

    reservations = []
    durations = [15, 30, 45, 60]
    day_offset = 0
    attempts = 0
    while len(reservations) < n and attempts < n * 50:
        attempts += 1
        d = add_days(ANCHOR_DATE, day_offset % 14)
        day_offset += 1
        if d.weekday() in closed:
            continue
        staff_id = random.choice(vets)
        room = random.choice(rooms)
        duration = random.choice(durations)
        slot_index = random.randint(0, (18 - 9) * 60 // slot_min - duration // slot_min)
        start_min = 9 * 60 + slot_index * slot_min
        end_min = start_min + duration
        if not is_free("staff", staff_id, d, start_min, end_min):
            continue
        if not is_free("room", room, d, start_min, end_min):
            continue
        mark_busy("staff", staff_id, d, start_min, end_min)
        mark_busy("room", room, d, start_min, end_min)
        patient = random.choice(patients)
        rid = len(reservations) + 1
        sh, sm = divmod(start_min, 60)
        eh, em = divmod(end_min, 60)
        reservations.append({
            "id": rid,
            "patient_id": patient["id"],
            "starts_at": jst_dt(d, sh, sm),
            "ends_at": jst_dt(d, eh, em),
            "staff_id": staff_id,
            "room": room,
            "purpose": random.choice(RECEPTION_KINDS)["name"],
            "note": "",
            "status": "booked" if random.random() < 0.9 else "cancelled",
        })
    return reservations


# ---------------------------------------------------------------------------
# Hospitalization
# ---------------------------------------------------------------------------

def build_hospitalizations(patients, staff, n=8):
    rooms = ["入院室1", "入院室2", "入院室3"]
    staff_pool = [s["id"] for s in staff if s["is_active"]]
    categories = ["medication", "feeding", "measurement"]
    chosen = random.sample(patients, k=n)
    hospitalizations = []
    for i, patient in enumerate(chosen, start=1):
        stay_days = random.randint(2, 7)
        admitted_days_ago = random.randint(stay_days, 60)
        admitted_on = add_days(ANCHOR_DATE, -admitted_days_ago)
        ongoing = (i == n)  # 最後の1件だけ退院日未定(入院継続中)にする
        discharged_on = None if ongoing else add_days(admitted_on, stay_days)
        room = rooms[i % len(rooms)]

        care_records = []
        record_span_days = stay_days if not ongoing else min(stay_days, 3)
        rec_id = 1
        for day in range(record_span_days):
            d = add_days(admitted_on, day)
            for hh in (9, 13, 18):
                category = categories[(hh // 5) % len(categories)]
                care_records.append({
                    "id": rec_id,
                    "recorded_at": jst_dt(d, hh, 0),
                    "category": category,
                    "content": {
                        "medication": "投薬実施(処方どおり)",
                        "feeding": "給餌実施(完食)",
                        "measurement": "体温・体重測定実施",
                    }[category],
                    # 実施者を必ず持たせる。フィールド名は spec/model.md の指定どおり
                    "performed_by_staff_id": random.choice(staff_pool),
                })
                rec_id += 1

        hospitalizations.append({
            "id": i,
            "patient_id": patient["id"],
            "admitted_on": admitted_on.isoformat(),
            "discharged_on": discharged_on.isoformat() if discharged_on else None,
            "room": room,
            "care_records": care_records,
        })
    return hospitalizations


# ---------------------------------------------------------------------------
# 組み立て
# ---------------------------------------------------------------------------

def build_all():
    lab_items = build_lab_items()
    price_items = build_price_items()
    masters = build_masters()

    clinic = build_clinic()
    staff = build_staff()
    owners = build_owners(40)
    patients = build_patients(owners, 60)
    visits, base_weight = build_visits(patients, staff, 200)
    progress_notes = build_progress_notes(visits, patients, base_weight)
    receptions = build_receptions(patients, staff, 25)
    preventions = build_preventions(patients, 80)
    dosings = build_dosings(patients, 40)
    lab_tests, lab_test_items, oor_count, ir_count = build_lab_tests_and_items(
        patients, visits, staff, lab_items, 80
    )
    billings, billing_details, unset_hit_billing_ids = build_billings_and_details(
        patients, staff, price_items, 150, 600
    )
    reservations = build_reservations(patients, staff, clinic, 60)
    hospitalizations = build_hospitalizations(patients, staff, 8)

    # ── 書類（紙カルテの取込記録）─────────────────────────
    #
    # **`papers` が1件も無かったので、`/papers/{paper_id}` は5実装とも
    # 「確かめられない」のままだった**（2026-09-06）。契約には6ルートあり、
    # `spec/screens.md` 13番も詳細に規定しているのに、**確かめようが無かった。**
    #
    #     確かめられない範囲は、**データが原因なら、データで消せる。**
    #
    # **PDFの実体は持たない。** 取込の記録（台帳）だけを持つ。
    # `spec/model.md` で `KartePdf` を落とした理由が「ファイルの取り扱いが
    # 主題になってしまう」だったので、そこは踏み越えない（裁定 R-21）。
    #
    # **乱数の最後に置いてある。** 途中に入れると、これ以前の抽選がずれて
    # 売上などの数字が全部変わる。既に確かめた数字を動かさないための順番である。
    papers = []
    paper_targets = random.sample(patients, k=min(12, len(patients)))
    for i, pt in enumerate(paper_targets, start=1):
        taken = add_days(ANCHOR_DATE, -random.randint(0, 400))
        papers.append({
            "id": i,
            "patient_id": pt["id"],
            "visit_id": None,                      # 動物ぜんぶに紐づく（診察単位ではない）
            "title": f"紙カルテ {taken.year}年分",
            "note": random.choice(["前医からの紹介状を含む", "手書き部分あり", ""]),
            "taken_on": taken.isoformat(),
            "removed_at": None,
        })
    # **「元から紙カルテが無い」印も混ぜる。** 取り込んでいないのか、
    # そもそも存在しないのかを画面で区別できるようにするため（screens.md 13番）。
    no_paper_patient_ids = [p["id"] for p in random.sample(patients, k=3)]

    seed = {
        "note": "すべて架空のデータ。実在の動物病院・飼主・動物・獣医師・薬品名・保険会社名・料金は含まない。",
        "anchor_date": ANCHOR_DATE.isoformat(),
        "clinic": clinic,
        "staff": staff,
        "owners": owners,
        "patients": patients,
        "receptions": receptions,
        "visits": visits,
        "progress_notes": progress_notes,
        "preventions": preventions,
        "dosings": dosings,
        "lab_tests": lab_tests,
        "lab_test_items": lab_test_items,
        "billings": billings,
        "billing_details": billing_details,
        "reservations": reservations,
        "hospitalizations": hospitalizations,
        "papers": papers,
        "no_paper_patient_ids": no_paper_patient_ids,
    }

    checks = run_self_checks(
        owners=owners, patients=patients, visits=visits, progress_notes=progress_notes,
        price_items=price_items, billings=billings, billing_details=billing_details,
        reservations=reservations, hospitalizations=hospitalizations,
        lab_test_items=lab_test_items, oor_count=oor_count, ir_count=ir_count,
        unset_hit_billing_ids=unset_hit_billing_ids,
    )

    # 検算用の内部フィールドは出力から取り除く(仕様の外なので保存しない)
    for b in billings:
        b.pop("_computed_total_priced_only", None)
        b.pop("_unpriced_row_count", None)

    return lab_items, price_items, masters, seed, checks


# ---------------------------------------------------------------------------
# 自己検査
# ---------------------------------------------------------------------------

def run_self_checks(*, owners, patients, visits, progress_notes, price_items, billings,
                     billing_details, reservations, hospitalizations, lab_test_items,
                     oor_count, ir_count, unset_hit_billing_ids):
    results = []

    def check(name, ok, detail=""):
        results.append((name, ok, detail))

    # 1. 予約の重複が0件
    conflicts = 0
    by_staff = {}
    by_room = {}
    for r in reservations:
        if r["status"] == "cancelled":
            continue
        d = r["starts_at"][:10]
        s = r["starts_at"]
        e = r["ends_at"]
        for key_map, key in ((by_staff, (r["staff_id"], d)), (by_room, (r["room"], d))):
            key_map.setdefault(key, []).append((s, e))
    for key_map in (by_staff, by_room):
        for key, intervals in key_map.items():
            intervals.sort()
            for a, b in zip(intervals, intervals[1:]):
                if a[1] > b[0]:
                    conflicts += 1
    check("予約の重複が0件", conflicts == 0, f"conflicts={conflicts}")

    # 2. 入院の記録行に実施者が空のものが0件
    missing_staff = sum(
        1 for h in hospitalizations for c in h["care_records"] if not c.get("performed_by_staff_id")
    )
    check("入院記録の実施者欠落が0件", missing_staff == 0, f"missing={missing_staff}")

    # 3. 体温がすべて同じ値になっていない
    temps = {n["temperature_c"] for n in progress_notes}
    check("体温が単一値に固定されていない", len(temps) > 1, f"unique_temps={len(temps)}")

    # 3b. 体重も患者ごとに違う値になっている
    weights = {v["body_weight_kg"] for v in visits}
    check("体重が単一値に固定されていない", len(weights) > 1, f"unique_weights={len(weights)}")

    # 4. 単価未設定が意図した件数だけある
    unset_count = sum(1 for p in price_items if p["unit_price"] is None)
    check("料金項目の単価未設定が8件", unset_count == 8, f"unset={unset_count}")
    check("単価未設定行が複数の伝票にまたがっている", len(unset_hit_billing_ids) >= 5,
          f"billings_with_unset={len(unset_hit_billing_ids)}")

    # 5. 会計明細の合計が、伝票の合計と一致する(未算入を除いて)
    detail_sum_by_billing = {}
    unpriced_by_billing = {}
    for d in billing_details:
        bid = d["billing_id"]
        if d["unit_price"] is None:
            unpriced_by_billing[bid] = unpriced_by_billing.get(bid, 0) + 1
        else:
            detail_sum_by_billing[bid] = detail_sum_by_billing.get(bid, 0) + d["unit_price"] * d["quantity"]
    mismatches = 0
    for b in billings:
        expected = b["_computed_total_priced_only"]
        actual = detail_sum_by_billing.get(b["id"], 0)
        if expected != actual:
            mismatches += 1
        if b["status"] == "confirmed" and b["paid_amount"] != expected:
            mismatches += 1
    check("会計明細合計と伝票金額が一致(未算入を除く)", mismatches == 0, f"mismatches={mismatches}")

    # 追加: 削除済み行が少数含まれる
    deleted_owners = sum(1 for o in owners if o["deleted_at"])
    deleted_patients = sum(1 for p in patients if p["deleted_at"])
    deleted_visits = sum(1 for v in visits if v["deleted_at"])
    check("削除済み(deleted_at)行が少数含まれる",
          deleted_owners > 0 and deleted_patients > 0 and deleted_visits > 0,
          f"owners={deleted_owners} patients={deleted_patients} visits={deleted_visits}")

    # 追加: 検査値が範囲内・範囲外の両方を含む
    check("検査値が範囲内・範囲外を両方含む", oor_count > 0 and ir_count > 0,
          f"out_of_range={oor_count} in_range={ir_count}")

    return results


def print_checks(checks):
    print("=== 自己検査結果 ===")
    all_ok = True
    for name, ok, detail in checks:
        mark = "OK" if ok else "NG"
        if not ok:
            all_ok = False
        print(f"[{mark}] {name} ({detail})")
    print("=== 全体判定:", "OK" if all_ok else "NG", "===")
    return all_ok


def main():
    lab_items, price_items, masters, seed, checks = build_all()

    def dump(name, obj):
        # **このファイルのある場所へ書く。** カレントディレクトリ任せにすると、
        # リポジトリのルートから流したときにルート直下へ出てしまい、
        # data/ が更新されないまま「再生成した」と思い込む
        # （2026-09-06 に実際に起きた）。
        with open(os.path.join(OUT_DIR, name), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
            f.write("\n")

    dump("lab_items.json", lab_items)
    dump("price_items.json", price_items)
    dump("masters.json", masters)
    dump("seed.json", seed)

    print(f"lab_items.json   : {len(lab_items)} 件")
    print(f"price_items.json : {len(price_items)} 件"
          f" (単価未設定 {sum(1 for p in price_items if p['unit_price'] is None)} 件)")
    print(f"masters.json     : prevention_kinds={len(masters['prevention_kinds'])}"
          f" reception_kinds={len(masters['reception_kinds'])}"
          f" departments={len(masters['departments'])}")
    print(f"seed.json        : owners={len(seed['owners'])} patients={len(seed['patients'])}"
          f" visits={len(seed['visits'])} progress_notes={len(seed['progress_notes'])}"
          f" receptions={len(seed['receptions'])} preventions={len(seed['preventions'])}"
          f" dosings={len(seed['dosings'])} lab_tests={len(seed['lab_tests'])}"
          f" lab_test_items={len(seed['lab_test_items'])} billings={len(seed['billings'])}"
          f" billing_details={len(seed['billing_details'])} reservations={len(seed['reservations'])}"
          f" hospitalizations={len(seed['hospitalizations'])}"
          f" papers={len(seed['papers'])}")
    print()

    ok = print_checks(checks)
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
