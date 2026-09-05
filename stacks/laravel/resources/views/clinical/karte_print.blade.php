<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <title>カルテ印刷 - {{ $patient->name_kanji }}</title>
    {{--
        印刷画面は独立したレイアウト（gnav等の画面用UIを含まない）。
        中身は通常画面と**同じ部分テンプレート**（_visits.blade.php）を include する。
        別々に組み立てると印刷側だけ古い表示が残る食い違い（spec/acceptance.md 検算4）が起きるため。
    --}}
    <style>
        body { font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; margin: 1.5rem; color: #111; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
        table th, table td { border: 1px solid #999; padding: .3rem .5rem; font-size: .85rem; }
        table th { background: #eee; text-align: left; }
    </style>
</head>
<body data-testid="screen-karte-print">
    <h1>カルテ印刷 — {{ $patient->name_kanji }}（{{ $patient->karte_no }}）</h1>
    @include('clinical._visits', ['visits' => $visits])
</body>
</html>
