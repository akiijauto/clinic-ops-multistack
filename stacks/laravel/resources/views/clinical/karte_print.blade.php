<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <title>カルテ印刷 — 動物病院 窓口業務システム</title>
    {{--
        印刷画面は独立したレイアウト（nav等の画面用UIを含まない）。
        中身は通常画面と**同じ部分テンプレート**（_visits.blade.php）を include する。
        別々に組み立てると印刷側だけ古い表示が残る食い違い（spec/acceptance.md 検算4）が起きるため。
        見た目は5実装の共通CSS（spec/ui.css）に揃える（オーナー判断・案B、2026-09-06）。
    --}}
    <link rel="stylesheet" href="/ui.css">
</head>
<body data-testid="screen-karte-print">
    <h1>カルテ印刷</h1>
    <p>{{ $patient->name_kanji }}（{{ $patient->karte_no }}）</p>
    @include('clinical._visits', ['visits' => $visits])
</body>
</html>
