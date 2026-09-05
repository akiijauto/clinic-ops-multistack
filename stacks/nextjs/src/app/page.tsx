import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1>clinic-ops / Next.js（レーンE）</h1>
      <p>学習・研究目的の実装です。複製・再配布・改変・商用利用を許可しません。</p>

      <h2>いま動くもの</h2>
      <ul>
        <li>
          <Link href="/healthz">GET /healthz</Link> — <code>{'{"status":"ok"}'}</code>
        </li>
        <li>
          <Link href="/health">GET /health</Link> — 同じ応答を返す別名
        </li>
      </ul>

      <h2>まだ無いもの</h2>
      <p>
        窓口業務の26画面は<strong>まだ作っていません</strong>。画面の契約
        （<code>spec/openapi.yaml</code> と <code>spec/acceptance.md</code>）が
        まだ公開されていないためです。凍る前に作ると、凍った契約と食い違って作り直しになります。
      </p>
      <p>
        データの層（型・スキーマ・接続）だけは先に作ってあります。
        <code>spec/model.md</code> が公開済みで、そこが契約だからです。
      </p>
    </main>
  );
}
