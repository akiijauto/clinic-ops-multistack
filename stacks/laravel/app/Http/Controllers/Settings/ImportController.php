<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\ApiError;
use App\Support\FixedData;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 取込（画面24）。契約: spec/openapi.yaml `/settings/import`。
 *
 * 【仮決め】spec/screens.md の説明（初期データの投入状況を件数で見る）と、
 * spec/openapi.yaml の契約（CSVファイルを受け取り列名と件数だけを読む。保存はしない）
 * の中身が食い違っている。HTTPの契約（openapi.yaml）を優先しつつ、
 * screens.mdの「件数の確認」もあわせて出す（両立できるため）。
 * coordination/qa/lane-c.md に記録する。
 */
class ImportController extends Controller
{
    private const TABLES = [
        'owners' => '飼主', 'patients' => '動物', 'receptions' => '受付',
        'visits' => '診察', 'progress_notes' => '経過記録', 'preventions' => '予防',
        'dosings' => '投薬', 'lab_tests' => '検査', 'lab_test_items' => '検査項目',
        'billings' => '会計', 'billing_details' => '会計明細',
        'reservations' => '予約', 'hospitalizations' => '入院',
    ];

    public function index(): View
    {
        return view('settings.import', ['counts' => $this->counts(), 'seedCounts' => $this->seedCounts()]);
    }

    /** CSVを1つ受け取り、列名と件数だけを読む。保存はしない。 */
    public function survey(Request $request)
    {
        $file = $request->file('file');
        if ($file === null) {
            return view('settings.import', [
                'counts' => $this->counts(),
                'seedCounts' => $this->seedCounts(),
                'error' => 'ファイルを選択してください。',
            ]);
        }

        $handle = fopen($file->getRealPath(), 'r');
        $header = fgetcsv($handle);
        $rowCount = 0;
        while (fgetcsv($handle) !== false) {
            $rowCount++;
        }
        fclose($handle);

        return view('settings.import', [
            'counts' => $this->counts(),
            'seedCounts' => $this->seedCounts(),
            'success' => '読み取りました（内容は保存していません）。',
            'columns' => $header,
            'rowCount' => $rowCount,
        ]);
    }

    private function counts(): array
    {
        $out = [];
        foreach (self::TABLES as $table => $label) {
            $out[$label] = DB::table($table)->count();
        }

        return $out;
    }

    private function seedCounts(): array
    {
        $seed = FixedData::seed();
        $out = [];
        foreach (self::TABLES as $table => $label) {
            $out[$label] = count($seed[$table] ?? []);
        }

        return $out;
    }
}
