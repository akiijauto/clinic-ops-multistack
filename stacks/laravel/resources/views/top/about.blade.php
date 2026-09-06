@extends('layouts.app')

@section('title', 'このシステムについて')

@section('content')
    <div class="card" data-testid="screen-about">
        <h1>このシステムについて</h1>

        <p>
            この企画（<code>clinic-ops-multistack</code>）は、動物病院の窓口業務を題材に、
            同じ仕様・同じ受け入れテストを5つの技術スタック（Go / Rails / Laravel / FastAPI /
            Next.js）で独立に実装し比較する、<strong>学習・研究を目的とした個人の検証プロジェクト
            です。商用製品ではありません。</strong>
        </p>

        <p>
            <strong>このリポジトリにライセンスは付与していません。著作権者が全ての権利を
            留保します。複製・再配布・改変・商用利用は許可しません。</strong>
            学習・研究目的での閲覧は歓迎します。
        </p>

        <p>
            表示しているデータは<strong>すべて架空</strong>です。実在する動物病院・飼主・動物の
            情報は一切含んでいません。実運用しているシステムのソースコードも含みません。
        </p>

        <p>
            題材にした実システムには28のデータモデルがありますが、この企画ではその範囲を
            14のデータモデルに絞っています（分院・レセプト・監査ログ・マスタの編集画面 等は
            意図して外しました。作れなかったのではなく、比較の題材として要らないと判断した
            ためです）。落としたものの一覧と理由は「機能設定」画面にまとめてあります。
        </p>

        <p>この画面はDBに繋がらなくても開けます（データを参照しません）。</p>

        <p>
            <a class="button secondary" href="/settings/features">機能設定（落としたものの一覧）</a>
            <a class="button secondary" href="/settings">設定</a>
        </p>
        <p><a href="/">トップへ戻る</a></p>
    </div>
@endsection
