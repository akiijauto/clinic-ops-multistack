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

    # 鍵の文字クラスに **`.` を含める。**
    # 最初は `[A-Za-z0-9_-]` だけで拾っていたので、`today.complete_delete_all` の
    # ような**点を含む鍵が `today` に切り詰められ**、2つの別々の鍵が同じものに見えた。
    # その結果「灰色のボタンが1個しか無い」と誤って報告した
    # （2026-09-06、レーンCが原因を突き止めた。判定器の欠陥8件目）。
    #
    #     判定器が**読み取れる文字を狭く決めた**せいで、
    #     正しく作ってあるものが「無い」ことにされた。

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
            # **語彙の出どころを1つに決めつけない。**
            #
            # 決めつけるたびに外した（2026-09-06、いずれも判定器の誤り）。
            #
            #   1回目「`key=reception` で通るはず」→ どの語彙にも無い語だった
            #   2回目「その経路の一覧ページに在るはず」→ `/folded` は一覧に全項目を
            #         並べる作りで**自分の個別ページへリンクしない**実装があり、
            #         個別への入口は `/settings/features` 側にあった（レーンCが切り分け）
            #   3回目「`masters.json` のキー名が語彙のはず」→ 実装の語彙は**単数形**
            #         （`department` `price_item` …）で、5実装とも404になった
            #
            #     判定器が「ここにしか無いはず」と決めつけると、
            #     **正しく作ってあるものが「確かめられない」や「無い」に落ちる。**
            #
            # だから**実装が出しているものを探す**。単数・複数の揺れも見る。
            index = path.split("/{key}")[0]
            seg = index.rsplit("/", 1)[-1]
            segs = {seg, seg.rstrip("s"), seg + "s"}
            pages = [index]
            if index.startswith("/api/"):
                pages.append(index[4:])                     # /api/masters → /masters
                pages.append(index[4:].rstrip("s"))          # → /master
                pages.append("/settings" + index[4:].rstrip("s"))
            # 灰色ボタン（状態C）の導線は本日の患者とカルテに在る。
            # そこを見ないと `/todo/{key}` が「確かめられない」に落ちる。
            pages += ["/settings/master", "/settings/features", "/settings",
                      "/today", "/", "/animals/" + sample.get("karte_no", "") + "/karte"]
            cand = None
            seen_pages = set()
            for probe in pages:
                if probe in seen_pages:
                    continue
                seen_pages.add(probe)
                st, html, _ = c.get(probe)
                if st != 200 or not html:
                    continue
                for sg in segs:
                    m = re.search(r"/" + re.escape(sg) + r"/([A-Za-z0-9_.\-]+)", html)
                    if m:
                        cand = m.group(1)
                        break
                if cand:
                    break
            if cand is None:
                return None
            path = path.replace("{key}", cand)
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

    @check("inventory", "見た目 指示したクラスが実際に画面に付いている")
    def _ui_classes(c, rep):
        """**読んでいることと、当たっていることは別。**

        共通CSSを配って読ませたが、それだけでは足りなかった。2レーンが独立に
        こう報告してきた（2026-09-06）。

          レーンE「`class="banner-error"`（語順が逆）が複数箇所にあり、
                  `ui.css` の `.error-banner` に当たらない」
          レーンC「`class="btn"` 72箇所は ui.css のどのセレクタにも一致せず**死んでいた**」

        **同じ名前で違う語順、似た名前で別物** — CSSはこれを黙って無視する。
        エラーも警告も出ない。読み込みだけを見る検査では、この状態が緑になる。

            指示しただけでは、付いていることの証明にならない。

        だから**指示した3クラスが実際に現れるか**を数える。
        画面の内容次第で出ないもの（`out-of-range` は基準外の値が無ければ出ない）も
        あるので、**全画面に必須とはしない。** 辿れる範囲のどこかに現れればよい。
        """
        want = {
            "num": "金額・数量の右寄せ",
            "disabled": "押せるが動かないボタン",
            "out-of-range": "基準の外にある検査値",
        }
        sample = _samples()
        screens, _ = _split()
        found, looked = set(), 0
        for p in screens:
            real = _resolve(c, p, sample)
            if real is None:
                continue
            st, html, _ = c.get(real)
            if st != 200 or not html or "<html" not in html.lower():
                continue
            looked += 1
            for cls in want:
                if re.search(r'class="[^"]*\b' + re.escape(cls) + r'\b', html):
                    found.add(cls)
        if looked < 10:
            return False, f"{looked} 画面しか見られていない（検査が働いていない）"
        missing = [f"{k}({v})" for k, v in want.items() if k not in found]
        if missing:
            return False, f"どの画面にも現れないクラス: {', '.join(missing)}"
        return True, f"{looked} 画面で {len(found)} クラスすべてを確認"

    @check("inventory", "契約 押しても何も起きないボタンにしない（灰色3つが理由へ繋がる）")
    def _grey(c, rep):
        """契約が名指しで求めている3つのボタンが在るかを見る。

        `spec/openapi.yaml` の `/todo/{key}` にこう書いてある。

            押しても保存されない灰色のボタン3つ（一時保存／完了全削除／完了削除）の
            行き先。**押しても何も起きないボタンにはしない。** 押すと決めた理由が読める。

        **契約が名指しで要求しているのに、確かめる検査が無かった。**
        レーンA（Go）が「テンプレートに一切実装されていない」と全文検索で気づくまで、
        **5実装のうち4つが持っていないまま、すべての検査が緑だった**（2026-09-06）。

            書いてあるのに確かめない。この企画でいちばん多く繰り返した型である。

        キーの語彙は契約が実装に委ねている（`enum` に固定しない、と明記）ので、
        **名前は問わない。** 「3つの異なる `/todo/<key>` への導線が在り、
        その行き先が生きていること」だけを見る。
        """
        keys = set()
        for path in ("/today", "/animals/{karte_no}/karte"):
            real = _resolve(c, path, _samples())
            if real is None:
                continue
            st, html, _ = c.get(real)
            if st != 200 or not html:
                continue
            keys.update(re.findall(r"/todo/([A-Za-z0-9_.\-]+)", html))
        if len(keys) < 3:
            return False, (f"灰色のボタンが {len(keys)} 個しか無い（3つ必要）"
                           f"{'：' + ', '.join(sorted(keys)) if keys else ''}")
        dead = []
        for k in sorted(keys):
            st, _, _ = c.get(f"/todo/{k}")
            if st != 200:
                dead.append(f"/todo/{k}={st}")
        if dead:
            return False, f"理由の行き先が生きていない: {', '.join(dead)}"
        return True, f"{len(keys)} 個: {', '.join(sorted(keys))}"

    @check("inventory", "書き込み 作って・確かめて・取り消せる（GETだけでは分からない）")
    def _write_roundtrip(c, rep):
        """**書き込み経路を一度も検査していなかった。**

        検算はすべてGETで、`POST` / `PATCH` / `DELETE` を1本も送っていない。
        そのため `POST /api/reservations` が **FastAPI だけ500** を返していても、
        「5実装 × 22件すべて通過」と表示され続けた（2026-09-06、監査役が発見）。

            読めることと、書けることは別。
            **読むだけの検査は、書き込みが壊れていても緑になる。**

        しかも同じ欠陥は、読むだけの役が **07:30 に既に報告していた**。
        指揮役がそれを拾わなかったので、4時間気づかれなかった。

        ここでは**往復で見る**。作って、返り値を確かめて、取り消す。
        **状態を残さない。** 残すと次の測定が前の測定に影響される。
        """
        seed_path = os.path.join(_DATA, "seed.json")
        try:
            with open(seed_path, encoding="utf-8") as f:
                seed = json.load(f)
        except Exception:
            return False, "data/seed.json が読めない（検査が働いていない）"

        pats = seed.get("patients") or []
        staff = seed.get("staff") or []
        if not pats or not staff:
            return False, "患者か担当がデータに無い（検査が働いていない）"

        body = {
            "patient_id": pats[0]["id"],
            "staff_id": staff[0]["id"],
            # **既存と重ならない未来の時間**を選ぶ。重なると正しく拒否され、
            # それを「壊れている」と誤認する（検算6は重なりを拒否する規則）。
            "starts_at": "2027-12-31T09:00:00+09:00",
            "ends_at": "2027-12-31T09:30:00+09:00",
            "room": "処置室1",
            "note": "判定器の往復確認",
        }
        status, text, _ = c.post("/api/reservations", body)
        if status not in (200, 201):
            head = (text or "")[:80].replace("\n", " ")
            return False, f"作れない: POST /api/reservations = {status} {head}"

        try:
            made = json.loads(text)
        except Exception:
            return False, f"作れたが応答がJSONでない: {(text or '')[:80]}"
        new_id = made.get("id")
        if new_id is None:
            return False, f"作れたが id が返らない: {list(made)[:6]}"

        # 取り消す。**後片付けまでが検査。**
        st2, _, _ = c.post(f"/api/reservations/{new_id}/cancel", {})
        if st2 not in (200, 201, 204):
            return False, (f"作れたが取り消せない: "
                           f"POST /api/reservations/{new_id}/cancel = {st2}"
                           f"（判定器がデータを残した。手で消す必要がある）")
        return True, f"作成→取消の往復ができた（id={new_id}）"

    @check("inventory", "データ 実装が読んでいる中身が data/ と一致する（数字だけ見ても分からない）")
    def _same_data(c, rep):
        """**5実装が同じデータを読んでいるかを、誰も確かめていなかった。**

        2026-09-06、読むだけの役が画面を見て気づいた。3実装が**古い `seed.json` を
        取り込んだまま**動いていて、飼主の氏名が `data/seed.json` と違っていた。
        住所と電話は正しく、**氏名だけ**がずれていた。

        判定器はこれを永久に見つけられない作りだった。検算が見ているのは
        **数値**（売上・件数・重なり・体温の散らばり）だけで、**文字列を1つも
        照合していなかった**。売上が5実装とも 5,185,704円 で一致していたのは、
        **差が名前だけだったから**である。数字が合っていたので誰も疑わなかった。

            **判定器が見ている範囲の外では、データがずれていても緑になる。**
            そして「同じ契約から同じものが出る」の土台は、
            **同じデータを読んでいること**である。そこを確かめていなかった。

        ここでは**文字列の項目**を `data/seed.json` と突き合わせる。
        数字は他の検算が見ているので、ここでは見ない。
        """
        try:
            with open(os.path.join(_DATA, "seed.json"), encoding="utf-8") as f:
                seed = json.load(f)
        except Exception:
            return False, "data/seed.json が読めない（検査が働いていない）"

        # **先頭数件だけ見ると空振りする。**
        # 最初は `[:6]` で組んでいたが、実際にずれていた `owner id=18` が対象外で、
        # **3実装が古いデータのまま緑になった**（2026-09-06、検査を足した直後に気づいた）。
        #
        #     一部だけ見る検査は、**見ていないところがずれていても緑**になる。
        #     「代表を見れば足りる」は、ずれ方を知っているときにしか言えない。
        #
        # だから**全件見る**。要求数は増えるが、ここを削ると検査の意味が消える。
        # **項目名を推測で書かない。** `data/` に実在するキーだけを対象にする。
        #
        # 最初は `tel` と `name` を見ていた。実際のキーは `phone` と `name_kanji` で、
        # **どちらも存在しないので `.get()` が None を返し、静かに飛ばされていた。**
        # つまり **動物の氏名と電話番号を1件も照合していなかった** — この検査が
        # まさに捕まえるはずだったものである（2026-09-06、読むだけの役がコードを
        # 読んで見つけた。判定器の欠陥9件目）。
        #
        #     **存在しないキーを読んでも、例外もエラーも出ない。**
        #     照合したつもりで、何も照合していない状態が緑になる。
        #
        # 対策として、下で「実在するキーだけを使ったか」を数え、
        # 対象が痩せていたら検査自体を失敗させる。
        OWNER_FLDS = ("name_kanji", "name_kana", "address1", "address2", "phone", "mobile")
        PAT_FLDS = ("name_kanji", "name_kana", "species", "breed", "sex")

        avail_o = set(seed["owners"][0].keys()) if seed.get("owners") else set()
        avail_p = set(seed["patients"][0].keys()) if seed.get("patients") else set()
        unknown = [f for f in OWNER_FLDS if f not in avail_o] + \
                  [f for f in PAT_FLDS if f not in avail_p]
        if unknown:
            return False, f"data/ に無い項目名を見ようとしている: {', '.join(unknown)}"

        checks = []
        for o in (seed.get("owners") or []):
            for fld in OWNER_FLDS:
                if o.get(fld):
                    checks.append((f"/api/owners/{o['owner_no']}", fld, o[fld]))
        for p in (seed.get("patients") or []):
            for fld in PAT_FLDS:
                if p.get(fld):
                    checks.append((f"/api/patients/{p['karte_no']}", fld, p[fld]))

        if len(checks) < 40:
            return False, f"照合できる項目が {len(checks)} 件しか組めない（検査が働いていない）"

        bad, looked = [], 0
        for path, fld, want in checks:
            status, text, _ = c.get(path)
            if status != 200 or not text:
                continue                       # 在る・無いは別の検査の仕事
            try:
                got = json.loads(text)
            except Exception:
                continue
            if not isinstance(got, dict) or fld not in got:
                continue
            looked += 1
            if str(got.get(fld)) != str(want):
                # **値そのものは書かない。** 古いデータの氏名が公開物へ入る事故を
                # 一度起こしかけている。**どこが違うかだけ**を出す。
                bad.append(f"{path}:{fld}")
        if looked < 40:
            return False, f"{looked} 項目しか照合できていない（検査が働いていない）"
        if bad:
            return False, (f"{len(bad)} 項目が data/ と違う: {', '.join(bad[:5])}"
                           f"（古いデータを取り込んだまま入れ直していない疑い）")
        return True, f"{looked} 項目が data/ と一致"

    @check("inventory", "見た目 トップの見出しと共通ナビが契約どおり（5実装で同じに見えるか）")
    def _shell(c, rep):
        """トップの見出しと、全画面のナビを契約と突き合わせる。

        **「同じCSSを配った」と「同じに見える」は別だった**（2026-09-06、オーナーが
        5実装を並べて指摘）。実測すると、トップの `<h1>` が5通り、ナビの本数が
        0〜10本、`<h1>` が空の画面が複数あった。

        原因は契約が**トップの題名・見出し・ナビを何も決めていなかった**こと。
        R-24（検査画面の既定表示）と同じ型で、**契約が何も言っていない場所は割れる**。

            割れていること自体は、それまでどの検査にも引っかからなかった。
            **どの実装も200を返していたから。**

        `spec/screens.md` 末尾「トップ画面と共通ナビは、5実装で同一にする」を正とする。
        """
        H1 = "動物病院 窓口業務システム"
        NAV = ["/today", "/search", "/reservations", "/ward", "/dm",
               "/sales", "/staff", "/settings", "/about"]

        status, html, _ = c.get("/")
        if status != 200 or not html:
            return False, f"トップが開けない（status={status}）"

        m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S)
        h1 = re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""
        if h1 != H1:
            return False, f"トップの見出しが契約と違う: 「{h1[:30]}」（契約は「{H1}」）"

        # **内部呼称が画面に出ていないか。** レーン名や実装名は体制の言葉であって、
        # 画面に出すものではない。「同じものを比べる」企画で見出しが違っては比べられない。
        leaked = [w for w in ("レーン", "lane-", "評価版") if w in html[:4000]]
        if leaked:
            return False, f"体制の内部呼称が画面に出ている: {', '.join(leaked)}"

        # ナビは**全画面**に同じものが要る。トップだけ揃えても意味が無い。
        sample = _samples()
        screens, _ = _split()
        bad, looked = [], 0
        for p in screens:
            # **印刷用の画面にナビは要らない。** `spec/ui.css` の `@media print` も
            # ナビを隠している。紙に出すものに画面の導線を求めるのは、検査の側が
            # 厳しすぎる（2026-09-06、Laravel の印刷2画面だけが落ちて気づいた）。
            if p.endswith("/print"):
                continue
            real = _resolve(c, p, sample)
            if real is None:
                continue
            st, h, _ = c.get(real)
            if st != 200 or not h or "<html" not in h.lower():
                continue
            looked += 1
            nav = re.search(r"<nav[^>]*>(.*?)</nav>", h, re.S)
            if not nav:
                bad.append(f"{p}(navなし)")
                continue
            hrefs = set(re.findall(r'href="([^"]+)"', nav.group(1)))
            miss = [n for n in NAV if not any(x == n or x.endswith(n) for x in hrefs)]
            if miss:
                bad.append(f"{p}({len(miss)}本欠け)")
            if not re.search(r"<h1[^>]*>\s*\S", h):
                bad.append(f"{p}(h1が空)")
        if looked < 10:
            return False, f"{looked} 画面しか見られていない（検査が働いていない）"
        if bad:
            return False, f"{len(bad)} 画面が契約どおりでない: {', '.join(bad[:4])}"
        return True, f"{looked} 画面で見出しとナビを確認"







