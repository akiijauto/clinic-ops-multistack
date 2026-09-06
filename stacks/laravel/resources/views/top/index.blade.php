@extends('layouts.app')

@section('title', 'トップ')

@section('content')
    <div class="card" data-testid="screen-top">
        <h1>動物病院 窓口業務システム</h1>
        <p>
            これは動物病院の窓口業務を題材にした<strong>学習・研究目的</strong>の実装です。
            表示している飼主・動物・診察・会計などのデータは<strong>すべて架空の合成データ</strong>で、
            実在の動物病院・飼主・動物の情報は一切含みません。同じ仕様を
            Go・Ruby on Rails・PHP/Laravel・Python/FastAPI・TypeScript/Next.js の
            <strong>5つのスタックで実装して比べています</strong>。
        </p>
        <p><a class="button" href="/today">本日の患者へ</a></p>
    </div>
@endsection
