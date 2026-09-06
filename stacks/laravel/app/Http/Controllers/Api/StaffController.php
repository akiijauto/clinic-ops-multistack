<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** スタッフ一覧のAPI。契約は spec/openapi.yaml `/api/staff`。 */
class StaffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Staff::query();
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $items = $query->orderBy('id')->get();

        return response()->json([
            'items' => $items->map(fn ($s) => [
                'id' => $s->id,
                'staff_code' => $s->staff_code,
                'name' => $s->name,
                'role' => $s->role,
                'is_active' => (bool) $s->is_active,
            ])->values(),
            'total' => $items->count(),
        ]);
    }
}
