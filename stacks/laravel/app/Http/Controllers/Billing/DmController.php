<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Controller;
use App\Models\Prevention;
use Illuminate\Contracts\View\View;

/** DM管理（区分検索・一覧）。契約は spec/openapi.yaml `/dm`。 */
class DmController extends Controller
{
    public function index(): View
    {
        $rows = Prevention::with('patient.owner')
            ->whereNotNull('next_due_date')
            ->orderBy('next_due_date')
            ->limit(100)
            ->get();

        return view('billing.dm', ['rows' => $rows]);
    }
}
