@extends('layouts.app')

@section('title', 'トップ')

@section('content')
    <div class="card" data-testid="screen-top">
        <h1>動物病院 窓口業務システム</h1>
        <p>
            これは動物病院の窓口業務システムを題材にした<strong>学習・研究目的</strong>の実装です。
            同じ仕様（<code>spec/</code>）を Go・Ruby on Rails・PHP/Laravel・Python/FastAPI・
            TypeScript/Next.js の5つのスタックで実装し、同じ問題を別の道具で解くと何が変わるかを
            比べています。
        </p>
        <p>
            表示している飼主・動物・診察・会計などのデータは<strong>すべて架空の合成データ</strong>です。
            実在の動物病院・飼主・動物の情報は一切含みません。
        </p>
        <p>
            この企画の範囲でスコープに含めなかった機能（分院・レセプト・監査ログ 等）があります。
            詳しくは <a href="/folded/hospital_division">折りたたみ表示</a> と
            <a href="/about">このシステムについて</a> を参照してください。
        </p>
        <p>対象日（{{ \App\Support\BusinessClock::todayString() }}）の診察件数:
            <strong data-check="visit_count.today">{{ $todayCount }}</strong>
        </p>
        <p><a class="button" href="/today">中へ入る（本日の患者へ）</a></p>
    </div>
@endsection
