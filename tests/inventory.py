"""在庫検査 — 契約に載っている画面とAPIが、実装に「在る」かを数える。

**なぜ要るか（2026-09-06 の事故その1）**

共通テスト14件が5実装すべて緑・食い違い0なのを見て、指揮役が「完了」と判断して
push した。実際にはレーンDが「未完了。残り23画面・26 API」と報告していた。

原因は判定側の穴である。検算8のクローラーは**辿り着けたリンクが生きているか**しか
見ない。まだ作っていない画面はリンクが張られていないので、**クローラーからは
最初から存在しない**。つまり **作っていないほど緑になる**。

だからこの検査はクロールをしない。`spec/openapi.yaml` のパスを**1件ずつ直に叩く**。

**この検査自体の欠陥（2026-09-06 の事故その2）**

最初の版は `karte_no=10002` `visit_id=1` `owner_no=1` のような値を**直に書いていた**。
実データと噛み合わず、**実装があるのに404**と報告した。レーンAが1件ずつ実測して
見つけた（`coordination/qa/lane-a.md` Q-A-15）。判定器の欠陥はこれで4件目で、
**4件目は指揮役である私が作った**。

    実データを見ずに書いた固定値は、実装ではなく判定器を間違わせる。

いまは値を **`data/` から引く**。引けないものは「無い」ではなく **「確かめられない」**
として別に数える。**無いことと、確かめられないことは違う。** 混ぜると、
どちらの方向にも嘘になる。

run.py から register() 経由で読み込まれる。`--only inventory` で単独実行できる。
"""
from __future__ import annotations

import json
import os
import re

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SPEC = os.path.join(_ROOT, "spec", "openapi.yaml")
_DATA = os.path.join(_ROOT, "data")

# 画面として叩いても意味が無いもの（死活・外部照会・CSV配信）
_NOT_SCREEN = {"/healthz", "/postal", "/dm.csv"}


def _load(name):
    with open(os.path.join(_DATA, name), encoding="utf-8") as f:
        return json.load(f)


def _spec_paths() -> list[str]:
    """openapi.yaml のトップレベルのパスを拾う。YAMLの依存は足さない。"""
    with open(_SPEC, encoding="utf-8") as f:
        return re.findall(r"(?m)^  (/[^:\s]*):", f.read())


def _samples() -> dict:
    """パス変数に入れる値を、**data/ から引いて**組み立てる。

    直に書かない。実データと噛み合わない固定値は、実装ではなく判定器を間違わせる。
    引けなかったものは入れない（＝そのパスは「確かめられない」に落ちる）。
    """
    s = {}
    try:
        seed = _load("seed.json")
    except Exception:
        return s

    pats = seed.get("patients") or []
    if pats:
        s["karte_no"] = str(pats[0]["karte_no"])

    # **患者に紐づく値は、すべて同じ患者から選ぶ。**
    #
    # 別々に選ぶと「その患者の記録ではない」という理由で**正しく404**になり、
    # 欠けと誤認する。この誤りは2回起こした。
    #
    #   1回目: `visit_id` を `karte_no` と対にしていなかった（レーンAが発見）
    #   2回目: `kind_id` を `karte_no` と対にしていなかった。投薬記録は一部の患者に
    #          しか無いので、記録の無い患者へ投げて404を「欠け」と数えた
    #          （レーンDが「契約は404を正式な応答として定義している」と反論して発覚）
    #
    #     契約が404を認めている経路に、記録の無い相手を選んで投げれば、
    #     **正しい実装ほど落ちる。**
    #
    # だから **診察と投薬の両方を持つ患者**を選び、その患者の値だけを使う。
    by_id = {p["id"]: p for p in pats}
    visits = seed.get("visits") or []
    dos_pids = {d.get("patient_id") for d in (seed.get("dosings") or [])}
    pid = None
    for v in visits:
        if v.get("patient_id") in dos_pids and v.get("patient_id") in by_id:
            pid = v["patient_id"]
            s["karte_no"] = str(by_id[pid]["karte_no"])
            s["visit_id"] = str(v["id"])
            break
    if pid is None:
        for v in visits:
            if v.get("patient_id") in by_id:
                s["karte_no"] = str(by_id[v["patient_id"]]["karte_no"])
                s["visit_id"] = str(v["id"])
                break

    for key, coll, field in (("owner_no", "owners", "owner_no"),
                             ("id", "reservations", "id"),
                             ("staff_id", "staff", "id")):
        rows = seed.get(coll) or []
        if rows and field in rows[0]:
            s.setdefault(key, str(rows[0][field]))

    # 種別は **契約どおり整数で渡す。**
    #
    # 最初は `dosings[0]["kind"]`（`"heartworm"` のような文字列コード）を
    # そのまま渡していた。契約は `kind_id` を **integer** と型付けしているので、
    # **契約どおりに実装したものほど落ちる**という逆転が起きた
    # （FastAPI が Pydantic の型検証で422を返し、それを「無い」と数えていた）。
    # レーンDが「これは検査側の誤りではないか」と反論して分かった（2026-09-06）。
    #
    #     判定器が契約と違う型で叩けば、**契約を守った実装が落ちる。**
    #     「4対1で落ちているほうが悪い」は成り立たない。
    #
    # 数値は `masters.json` の `prevention_kinds` の並び順（1始まり）。
    # 実データに存在する種別だけを選ぶ（データに無い種別は正しく404になるため）。
    # **選んだ患者が実際に持っている種別**を使う。持っていない種別を投げると、
    # 契約どおり404が返り、それを欠けと数えてしまう。
    alldos = seed.get("dosings") or []
    dos = [d for d in alldos if d.get("patient_id") == pid] or alldos
    if dos:
        code = dos[0].get("kind")
        try:
            with open(os.path.join(_DATA, "masters.json"), encoding="utf-8") as f:
                kinds = json.load(f).get("prevention_kinds") or []
            idx = next(i for i, k in enumerate(kinds, 1) if k.get("code") == code)
            s["kind_id"] = str(idx)
        except Exception:
            pass

    return s


def _testids() -> dict:
    """`openapi.yaml` の `x-data-testids` を、画面パスごとに拾う。

    契約は目印を2系統に分けている（`spec/README.md`）。

        data-testid = **その要素が在るか**
        data-check  = **その値が正しいか**

    `data-check` は検算で使っていたが、**`data-testid` を確かめる検査は1つも無かった。**
    そのため FastAPI が `/ward` で目印を1つも出していないことに誰も気づかなかった
    （2026-09-06、裁定 R-22）。**契約に書いた目印を、契約どおりに確かめていなかった。**
    """
    with open(_SPEC, encoding="utf-8") as f:
        src = f.read()
    out, cur = {}, None
    for line in src.splitlines():
        m = re.match(r"^  (/\S*):\s*$", line)
        if m:
            cur = m.group(1)
            continue
        if cur and "x-data-testids:" in line:
            ids = re.findall(r"[\"']([a-zA-Z0-9_-]+)[\"']", line.split("x-data-testids:", 1)[1])
            if ids:
                out.setdefault(cur, set()).update(ids)
    return out


def _required_query() -> dict:
    """契約が **必須** と書いている **クエリ** を、パスごとに拾う。

    最初はクエリを1つも付けずに叩いていたので、`/postal`（`code` が必須）が
    422 を返し、それを「無い」と数えていた。
    **こちらが必要な入力を渡していないだけなのを、相手のせいにしていた。**

    直した版にも間違いがあった。**URLのパス変数まで拾っていた。**
    `karte_no` のようなパス変数も契約では `required: true` と書かれるので、
    `/animals/10018/accounting?karte_no=1` のような無意味な問い合わせになり、
    **5実装とも200を返しているのに404と報告した**（2026-09-06）。

        検査を厳しくするたびに、**検査自身の間違いも増える。**
        厳しくした直後は、落ちたものが本当に落ちているかを1件ずつ確かめる。

    いまは `in: query` と書いてあるものだけを拾う。
    値は形だけ満たすもので良い。ここで見たいのは「在るか」であって「正しいか」ではない。
    """
    with open(_SPEC, encoding="utf-8") as f:
        src = f.read()
    out, cur = {}, None
    name = where = None
    req = False
    for line in src.splitlines():
        m = re.match(r"^  (/\S*):\s*$", line)
        if m:
            cur, name, where, req = m.group(1), None, None, False
            continue
        m = re.search(r"-\s*name:\s*[\"']?([A-Za-z_]+)", line)
        if m:
            # 直前のパラメータを確定させてから、次へ移る
            if name and where == "query" and req and cur:
                out.setdefault(cur, {})[name] = _QUERY_SAMPLE.get(name, "1")
            name, where, req = m.group(1), None, False
            continue
        if name:
            mm = re.search(r"\bin:\s*([a-z]+)", line)
            if mm:
                where = mm.group(1)
            if re.search(r"required:\s*true", line):
                req = True
            # パラメータの並びが終わったら確定
            if re.match(r"^\s{0,6}\w", line) and "name:" not in line:
                if where == "query" and req and cur:
                    out.setdefault(cur, {})[name] = _QUERY_SAMPLE.get(name, "1")
                name, where, req = None, None, False
    if name and where == "query" and req and cur:
        out.setdefault(cur, {})[name] = _QUERY_SAMPLE.get(name, "1")
    return out


# 必須クエリに入れる値。**形が合っていればよい**（在るかどうかを見るだけ）。
# 日付は `data/seed.json` の anchor_date に合わせる。形の違う値を渡すと
# 400/422 が返り、**実装ではなく検査のせいで「無い」と数えてしまう**。
_QUERY_SAMPLE = {
    "code": "1000001",
    "q": "a",
    "date": "2026-09-01",
    "from": "2026-04-01",
    "to": "2027-03-31",
}


def _split():
    allp = _spec_paths()
    screens = [p for p in allp if not p.startswith("/api") and p not in _NOT_SCREEN]
    apis = [p for p in allp if p.startswith("/api")]
    return screens, apis


_VAR = re.compile(r"\{([A-Za-z_]+)\}")


def register(check, Client, Report):

    _REQ = _required_query()

    def _resolve(c, path, sample):
        """パスを実際に叩ける形にする。埋められなければ None を返す。

        3つのことをする。

        1. `key` のような語彙は data/ にも契約にも一意の答えが無いので、
           **実装が出している一覧から拾う**（例: /folded の中の /folded/xxx）。
           拾えなければ「確かめられない」に落とす。**無いとは言わない**
        2. 残りのパス変数を `data/` から引いた値で埋める
        3. **契約が必須と書いているクエリを付ける。** 付けずに叩いていたころは
           `/postal`（`code` が必須）が422を返し、それを「無い」と数えていた。
           **こちらが必要な入力を渡していないだけなのを、相手のせいにしていた**
        """
        spec_path = path
        names = _VAR.findall(path)
        if "key" in names:
            index = path.split("/{key}")[0]
            status, html, _ = c.get(index)
            if status != 200 or not html:
                return None
            m = re.search(re.escape(index) + r"/([A-Za-z0-9_\-]+)", html)
            if not m:
                return None
            path = path.replace("{key}", m.group(1))
            names = _VAR.findall(path)
        for n in names:
            if n not in sample:
                return None
            path = path.replace("{" + n + "}", sample[n])
        params = _REQ.get(spec_path)
        if params:
            path += "?" + "&".join(f"{k}={v}" for k, v in params.items())
        return path

    def _probe(c, paths):
        """在る / 無い / 確かめられない の3つに分ける。"""
        sample = _samples()
        present, missing, unknown = [], [], []
        for p in paths:
            real = _resolve(c, p, sample)
            if real is None:
                unknown.append(p)
                continue
            status, _, _ = c.get(real)
            # **「404でなければ在る」は甘すぎた。** 段階的に2回直している。
            #
            # 1回目: 404/501/接続不可 だけを「無い」としていたので、**500 を「在る」と
            #   数えていた**（2026-09-06、Rails と Laravel が記録0件の投薬APIで500を
            #   返しながらこの検査を緑で通った）。裁定 R-20
            # 2回目: 5xx を足しても **406 が「在る」のまま**だった（`/dm.csv` が
            #   内容交渉の不具合で406を返していたのに、レーンBが手で見つけるまで
            #   検査は緑だった）。
            #
            # いまは**「在る」と言える状態を列挙する**形にした。除外を足していく形だと、
            # 数え漏らした番号がそのまま穴になる。
            #   200番台・300番台 = 応答している
            #   401 / 403        = 在るが、通していない（認証・権限）
            #   405              = 在るが、そのメソッドでは呼べない（POST専用など）
            # それ以外はすべて「無い」に数える。
            if status < 400 or status in (401, 403, 405):
                present.append(p)
            else:
                missing.append(f"{p}={status}")
        return present, missing, unknown

    def _fmt(kind, total, present, missing, unknown):
        head = f"{len(present)}/{total} 件ある"
        if unknown:
            head += f"（{len(unknown)} 件は確かめられない: {', '.join(unknown[:3])}）"
        if missing:
            return False, f"{len(missing)} 件が無い: {', '.join(missing[:5])} ／ {head}"
        return True, head

    @check("inventory", "在庫 契約の画面ルートが全部ある（未実装はクローラーに見えない）")
    def _screens(c, rep):
        screens, _ = _split()
        if len(screens) < 20:
            return False, f"画面ルートを {len(screens)} 件しか読めない（契約側を疑う）"
        pr, mi, un = _probe(c, screens)
        return _fmt("画面", len(screens), pr, mi, un)

    @check("inventory", "在庫 契約のAPIルートが全部ある")
    def _apis(c, rep):
        _, apis = _split()
        if len(apis) < 10:
            return False, f"APIルートを {len(apis)} 件しか読めない（検査が働いていない）"
        pr, mi, un = _probe(c, apis)
        return _fmt("API", len(apis), pr, mi, un)

    @check("inventory", "在庫 この検査自体が働いているか（確かめられない分が多すぎないか）")
    def _self(c, rep):
        """検査が空振りしていないかを見る。

        検算4・検算8 で「何も比べずに緑」という事故が実際に起きた。
        **「確かめられない」を逃げ道にできてしまうと、この検査も同じ穴に落ちる。**
        だから、確かめられない割合が高すぎるときは緑にしない。
        """
        screens, apis = _split()
        if not screens or not apis:
            return False, f"画面 {len(screens)} 件 / API {len(apis)} 件（読めていない）"
        sample = _samples()
        if "karte_no" not in sample or "visit_id" not in sample:
            return False, "data/ から値を引けていない（固定値に戻っていないか確認）"
        _, _, un_s = _probe(c, screens)
        _, _, un_a = _probe(c, apis)
        un, tot = len(un_s) + len(un_a), len(screens) + len(apis)
        if un > tot * 0.25:
            return False, f"確かめられないものが {un}/{tot} 件。検査として成り立っていない"
        return True, f"対象 {tot} 件中、確かめられないのは {un} 件"

    @check("inventory", "在庫 契約が求める data-testid が画面に出ている")
    def _marks(c, rep):
        """`x-data-testids` を1件ずつ照合する。

        **在ることと、目印が付いていることは別。** 目印はテストのためだけの飾りではなく、
        「どの画面か」を機械に名乗る唯一の手段なので、無いと画面の同一性を確かめられない。
        """
        want = _testids()
        if len(want) < 10:
            return False, f"契約から {len(want)} 画面ぶんしか読めない（検査が働いていない）"
        sample = _samples()
        bad, looked = [], 0
        for path, ids in sorted(want.items()):
            if path.startswith("/api") or path in _NOT_SCREEN:
                continue
            real = _resolve(c, path, sample)
            if real is None:
                continue                      # 確かめられないものは責めない
            status, html, _ = c.get(real)
            if status != 200 or not html:
                continue                      # 在る／無いは別の検査の仕事
            looked += 1
            miss = [i for i in ids if f'data-testid="{i}"' not in html]
            # **その画面を名乗る目印（screen-*）だけを必須にする。**
            # 行や空表示の目印は、データ次第で出ないことが正しい場合がある。
            miss = [i for i in miss if i.startswith("screen-")]
            if miss:
                bad.append(f"{path}:{','.join(miss)}")
        if looked < 10:
            return False, f"{looked} 画面しか見られていない（検査が働いていない）"
        if bad:
            return False, f"{len(bad)} 画面で目印が無い: {', '.join(bad[:4])}"
        return True, f"{looked} 画面で目印を確認"

    @check("inventory", "在庫 画面でもAPIでもないルートが応答する（CSV配信・死活・外部照会）")
    def _others(c, rep):
        """`_NOT_SCREEN` に逃がしたルートを、逃がしっぱなしにしない。

        `/dm.csv` は画面でもAPIでもないので画面の検査から外していた。
        **その結果、内容交渉の不具合で406を返していたのに検査は緑だった**
        （2026-09-06、レーンBが手で見つけた）。
        **検査の対象から外したものは、外した先で数える。** 数えないと穴になる。
        """
        allp = _spec_paths()
        others = [p for p in allp if p in _NOT_SCREEN]
        if not others:
            return False, "対象が0件（_NOT_SCREEN が空。検査が働いていない）"
        sample = _samples()
        pr, mi, un = [], [], []
        for p in others:
            real = _resolve(c, p, sample)
            if real is None:
                un.append(p); continue
            status, _, _ = c.get(real)
            if status < 400 or status in (401, 403, 405):
                pr.append(p)
            else:
                mi.append(f"{p}={status}")
        if mi:
            return False, f"{len(mi)} 件が応答しない: {', '.join(mi)}"
        return True, f"{len(pr)}/{len(others)} 件が応答" + (f"（{len(un)} 件は確かめられない）" if un else "")


    @check("inventory", "見た目 共通CSS(/ui.css)を配っていて、全画面が読んでいる")
    def _ui(c, rep):
        """`spec/ui.css` が配られ、画面から読まれているかを見る。

        **配っただけでは揃わない。読まれていなければ意味が無い。**
        そして**中身が同じでなければ、読んでいても揃わない。**
        だから3つを見る。

          1. `/ui.css` が配られているか
          2. その中身が `spec/ui.css` と同じか（各実装が書き換えていないか）
          3. 画面が実際に読んでいるか

        2 が要るのは、今日「配ったつもりが各実装で別物になっていた」型の事故を
        何度も見たからである。**同じ名前の別物ほど気づきにくいものは無い。**
        """
        want_path = os.path.join(_ROOT, "spec", "ui.css")
        try:
            with open(want_path, encoding="utf-8") as f:
                want = f.read()
        except Exception:
            return False, "spec/ui.css が読めない（検査が働いていない）"

        status, body, _ = c.get("/ui.css")
        if status != 200:
            return False, f"/ui.css が配られていない（status={status}）"
        norm = lambda s: "".join(s.split())
        if norm(body) != norm(want):
            return False, (f"/ui.css の中身が spec/ui.css と違う"
                           f"（配布 {len(body)}字 / 正 {len(want)}字）")

        # 画面が読んでいるか。**代表ではなく、辿れる範囲を全部見る。**
        sample = _samples()
        screens, _ = _split()
        looked, bad = 0, []
        for p in screens:
            real = _resolve(c, p, sample)
            if real is None:
                continue
            st, html, _ = c.get(real)
            if st != 200 or not html or "<html" not in html.lower():
                continue
            looked += 1
            if "ui.css" not in html:
                bad.append(p)
        if looked < 10:
            return False, f"{looked} 画面しか見られていない（検査が働いていない）"
        if bad:
            return False, f"{len(bad)} 画面が読んでいない: {', '.join(bad[:4])}"
        return True, f"{looked} 画面すべてが読んでいる"


