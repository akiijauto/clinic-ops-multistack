<?php

namespace App\Http\Controllers\Reception;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

/** 検索。契約は spec/openapi.yaml `/search`。飼主名・カナ・カルテNo・電話番号・診療の中身を横断する。 */
class SearchController extends Controller
{
    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $patients = collect();

        if ($q !== '') {
            $patients = Patient::with('owner')
                ->where('karte_no', 'like', "%{$q}%")
                ->orWhere('name_kanji', 'like', "%{$q}%")
                ->orWhere('name_kana', 'like', "%{$q}%")
                ->limit(50)
                ->get();
        }

        return view('reception.search', ['q' => $q, 'patients' => $patients]);
    }
}
