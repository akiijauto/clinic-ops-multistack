<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'clinic-ops-multistack（Laravel）')</title>
    {{--
        ビルド手順（npm/Vite）を要らなくするため、CSSはこのファイルに直接書く。
        「画面の見た目は各スタックの流儀でよい」（spec/README.md）ので、
        ここは最低限の見やすさだけを目的にした素朴なスタイル。
    --}}
    <style>
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body { font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; margin: 0; background: #f4f5f7; color: #222; }
        header.gnav { background: #274060; color: #fff; padding: .6rem 1rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
        header.gnav a { color: #fff; text-decoration: none; font-size: .92rem; }
        header.gnav a:hover { text-decoration: underline; }
        header.gnav .brand { font-weight: bold; margin-right: 1rem; }
        header.gnav .staff { margin-left: auto; font-size: .85rem; opacity: .9; }
        main { padding: 1rem 1.2rem; max-width: 1100px; margin: 0 auto; }
        table { border-collapse: collapse; width: 100%; background: #fff; }
        table th, table td { border: 1px solid #ddd; padding: .35rem .5rem; font-size: .9rem; }
        table th { background: #eef1f6; text-align: left; }
        .btn { display: inline-block; padding: .35rem .8rem; border-radius: 4px; border: 1px solid #274060; background: #274060; color: #fff; text-decoration: none; font-size: .88rem; cursor: pointer; }
        .btn.is-disabled { background: #ccc; border-color: #bbb; color: #666; cursor: not-allowed; }
        .btn.secondary { background: #fff; color: #274060; }
        [data-testid="error-banner"] { background: #fdeaea; border: 1px solid #d33; color: #8a1c1c; padding: .6rem .8rem; margin-bottom: .8rem; border-radius: 4px; }
        [data-testid="success-banner"] { background: #eaf6ea; border: 1px solid #2a7a2a; color: #1c5c1c; padding: .6rem .8rem; margin-bottom: .8rem; border-radius: 4px; }
        .flag-high { color: #b30000; font-weight: bold; }
        .flag-low { color: #0056b3; font-weight: bold; }
        .card { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 1rem; margin-bottom: 1rem; }
    </style>
    @stack('styles')
</head>
<body>
<header class="gnav">
    <span class="brand">clinic-ops-multistack（Laravel）</span>
    {{--
        ルート相対パスで書く（url() は絶対URLを返すため、共通クローラーの
        href="/..." 判定にかからず「辿れない」扱いになる。spec/acceptance.md 検算8）。
    --}}
    <a href="/">トップ</a>
    <a href="/today">本日の患者</a>
    <a href="/search">検索</a>
    <a href="/reservations">予約</a>
    <a href="/ward">入院</a>
    <a href="/dm">DM</a>
    <a href="/sales">売上集計</a>
    <a href="/staff">スタッフ</a>
    <a href="/settings">設定</a>
    <a href="/about">このシステムについて</a>
    <span class="staff">
        @php($current = \App\Support\CurrentStaff::get())
        担当: {{ $current?->name ?? '未選択' }}
    </span>
</header>
<main>
    @yield('content')
</main>
</body>
</html>
