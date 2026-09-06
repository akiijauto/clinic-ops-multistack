import Link from 'next/link';
import { getDb } from '@/lib/db';
import { visitCountForDate } from '@/lib/area1/data';
import { todayJst } from '@/lib/jst';

// GET / -- spec/screens.md「8. トップ」.
export default function Home() {
  const day = todayJst();
  const visitCount = visitCountForDate(getDb(), day);

  return (
    <main data-testid="screen-top">
      <h1>clinic-ops / Next.js（レーンE）</h1>
      <p>
        学習・研究目的の実装です。動物病院の窓口業務を題材に、同じ仕様（<code>spec/</code>）を
        5つの技術スタックで実装し比較しています。ここにあるデータは<strong>すべて合成データ</strong>
        で、実在の病院・飼主・動物とは一切関係ありません。
      </p>
      <p>
        26画面すべてが動きますが、この企画では意図して作らなかった範囲（分院・レセプト・
        監査ログ・マスタの編集画面 等）があります。詳細は
        <Link href="/folded/hospital_division">折りたたみ表示</Link>と
        <Link href="/about">このシステムについて</Link>を見てください。「できます」と書いた
        操作は、実際にこの実装で押して動きます。
      </p>
      <p>
        対象日（{day}）の診察件数: <span data-check="visit_count.today">{visitCount}</span>
        （「本日の患者」と同じ値です）
      </p>
      <p>
        <Link href="/today">中へ入る（本日の患者）</Link>
      </p>
    </main>
  );
}
