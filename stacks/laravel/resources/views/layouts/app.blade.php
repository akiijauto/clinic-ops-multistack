<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'clinic-ops-multistack（Laravel）')</title>
    {{--
        見た目は5実装の共通CSS（spec/ui.css）に揃える（オーナー判断・案B、2026-09-06）。
        このファイルはコピーして配るだけで、1文字も変えない
        （public/ui.css を参照。直したい点は spec/ui.css 側で指揮役に相談する）。
    --}}
    <link rel="stylesheet" href="/ui.css">
    @stack('styles')
</head>
<body>
<nav>
    <strong>動物病院 窓口業務システム</strong>
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
    <span>
        @php($current = \App\Support\CurrentStaff::get())
        担当: {{ $current?->name ?? '未選択' }}
    </span>
</nav>
<main>
    @yield('content')
</main>
</body>
</html>
