<?php

namespace App\Http\Controllers\Clinical;

use App\Http\Controllers\Controller;
use App\Models\Paper;
use App\Models\Patient;
use App\Support\ApiError;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * 書類（画面13）。契約: spec/openapi.yaml `/animals/{karte_no}/papers` `/papers/{paper_id}`
 * `/papers/{paper_id}/remove` `/papers/no-paper`。
 *
 * 【仮決め】spec/model.md は KartePdf（紙カルテPDFの取込）を明示的にスコープ外としている
 * （「落としたもの」）。spec/openapi.yaml の Paper スキーマにもファイル実体のフィールドは無い
 * （id/patient_id/title/note/created_atのみ）。よってこの画面は
 * **文書の題名・メモだけを持つ一覧**として実装し、実ファイルの取込・PDF形式検証は行わない。
 * coordination/qa/lane-c.md に記録する。
 */
class PaperController extends Controller
{
    public function index(string $karteNo): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $papers = Paper::where('patient_id', $patient->id)->whereNull('removed_at')->orderByDesc('created_at')->get();

        return view('clinical.papers', ['patient' => $patient, 'papers' => $papers]);
    }

    public function store(Request $request, string $karteNo): View|Response
    {
        $patient = Patient::where('karte_no', $karteNo)->first();
        if ($patient === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        $title = trim((string) $request->input('title', ''));
        if ($title === '') {
            return view('clinical.papers', [
                'patient' => $patient,
                'papers' => Paper::where('patient_id', $patient->id)->whereNull('removed_at')->orderByDesc('created_at')->get(),
                'error' => '題名を入力してください。',
            ]);
        }

        Paper::create(['patient_id' => $patient->id, 'title' => $title, 'note' => $request->input('note')]);

        return view('clinical.papers', [
            'patient' => $patient,
            'papers' => Paper::where('patient_id', $patient->id)->whereNull('removed_at')->orderByDesc('created_at')->get(),
            'success' => '取り込みました。',
        ]);
    }

    public function show(int $paperId): View|Response
    {
        $paper = Paper::with('patient')->find($paperId);
        if ($paper === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        return view('clinical.paper_detail', ['paper' => $paper]);
    }

    public function remove(int $paperId): View|Response
    {
        $paper = Paper::find($paperId);
        if ($paper === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }
        $karteNo = $paper->patient->karte_no;
        // 物理削除しない（screens.md画面13「満たすべきこと」）。一覧表示からだけ隠す。
        $paper->removed_at = now();
        $paper->save();

        return redirect("/animals/{$karteNo}/papers");
    }

    public function noPaper(): View
    {
        return view('clinical.papers_no_paper');
    }
}
