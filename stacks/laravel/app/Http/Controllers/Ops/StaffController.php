<?php

namespace App\Http\Controllers\Ops;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use App\Support\ApiError;
use App\Support\CurrentStaff;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * スタッフ（担当選択・画面21）。契約は spec/openapi.yaml `/staff`（一覧のみ規定。
 * 選択・解除のPOST経路はopenapi.yamlに明記が無いため、この画面の統合点として
 * レーンC自身がルートを決める——会計画面のE3と同じ考え方）。
 *
 * 「いまこの端末を使っている担当者」を選ぶだけで、認証ではない
 * （coordination/DECISIONS.md）。App\Support\CurrentStaffがセッションに持つ。
 * 以前はこの画面に選択手段が一切無く、`CurrentStaff::set()`を呼ぶ経路が
 * どこにも存在しなかった（2026-09-06レビュー指摘）。
 */
class StaffController extends Controller
{
    public function index(): View
    {
        return view('ops.staff', [
            'staffList' => Staff::orderBy('id')->get(),
            'current' => CurrentStaff::get(),
        ]);
    }

    /** 一覧から選ぶ。以後の登録・修正・削除の記録にこの担当が残る（画面21「満たすべきこと」）。 */
    public function select(int $id): RedirectResponse|Response
    {
        $staff = Staff::find($id);
        if ($staff === null) {
            return ApiError::response(ApiError::NOT_FOUND);
        }

        CurrentStaff::set($staff->id);

        return redirect('/staff');
    }

    /** 「担当を外す」。押すと未選択に戻る（画面21「できること」）。 */
    public function clear(): RedirectResponse
    {
        CurrentStaff::set(null);

        return redirect('/staff');
    }
}
