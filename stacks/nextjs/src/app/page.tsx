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
      <h1>動物病院 窓口業務システム</h1>
      <p>
        学習・研究目的の実装です。動物病院の窓口業務を題材に、同じ仕様（<code>spec/</code>）を
        5つの技術スタックで実装し比較しています。ここにあるデータは<strong>すべて合成データ</strong>
        で、実在の病院・飼主・動物とは一切関係ありません。
      </p>
      {/* 「折りたたみ表示」「このシステムについて」への導線は共通ナビに既にある
          （spec/screens.md 追記「トップ画面の本文」: 本文はh1・説明・本日の患者への
          導線1本だけで、ナビの複製を並べない）。ここではリンクにせず文中で触れるだけ。 */}
      <p>
        26画面すべてが動きますが、この企画では意図して作らなかった範囲（分院・レセプト・
        監査ログ・マスタの編集画面 等）があります。詳細は「折りたたみ表示」「このシステムに
        ついて」を見てください。「できます」と書いた操作は、実際にこの実装で押して動きます。
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
