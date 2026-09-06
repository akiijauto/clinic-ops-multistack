<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

/**
 * 機能設定（画面23）。参照専用。「折りたたみ表示」と同じ元データ
 * （config/feature_notes.php）を使うことで、掲載内容が食い違わないことを保証する。
 */
class FeaturesController extends Controller
{
    public function index(): View
    {
        return view('settings.features', [
            'folded' => config('feature_notes.folded'),
            'todo' => config('feature_notes.todo'),
        ]);
    }
}
