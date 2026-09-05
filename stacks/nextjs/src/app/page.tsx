export default function Home() {
  return (
    <main data-testid="screen-top">
      <h1>clinic-ops / Next.js（レーンE）</h1>
      <p>学習・研究目的の実装です。複製・再配布・改変・商用利用を許可しません。</p>

      <h2>画面</h2>
      <ul>
        <li>
          <a href="/today">本日の患者（受付一覧）</a>
        </li>
        <li>
          <a href="/search">検索</a>
        </li>
        <li>
          <a href="/animals/10001/karte">カルテ（例: カルテNo 10001）</a>
        </li>
        <li>
          <a href="/ward">入院</a>
        </li>
        <li>
          <a href="/reservations">予約</a>
        </li>
        <li>
          <a href="/staff">スタッフ</a>
        </li>
        <li>
          <a href="/settings">設定</a>
        </li>
        <li>
          <a href="/about">このシステムについて</a>
        </li>
      </ul>

      <h2>いま動くAPI</h2>
      <ul>
        <li>
          <a href="/healthz">GET /healthz</a> — <code>{'{"status":"ok"}'}</code>
        </li>
        <li>
          <a href="/health">GET /health</a> — 同じ応答を返す別名
        </li>
      </ul>

      <h2>まだ無いもの</h2>
      <p>
        26画面のうち一部はまだ最小限の表示にとどまっています（保存・登録の
        操作は未実装のものがあります）。「できます」と書いて出来ていない状態は
        作らないため、そのような画面は控えめな表示にしてあります。
      </p>
    </main>
  );
}
