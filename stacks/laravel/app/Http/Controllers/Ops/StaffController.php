<?php

namespace App\Http\Controllers\Ops;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use Illuminate\Contracts\View\View;

/** スタッフ（一覧）。契約は spec/openapi.yaml `/staff`。 */
class StaffController extends Controller
{
    public function index(): View
    {
        return view('ops.staff', ['staffList' => Staff::orderBy('id')->get()]);
    }
}
