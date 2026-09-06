<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Controller;
use App\Models\Prevention;
use App\Support\FixedData;
use Illuminate\Contracts\View\View;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * DM管理（画面16）。契約: spec/openapi.yaml `/dm` `/dm.csv`。
 * 画面とCSVは**同じ絞り込みロジック**（query()）を使い、件数が食い違わないようにする。
 */
class DmController extends Controller
{
    public function index(Request $request): View
    {
        $rows = $this->query($request);

        return view('billing.dm', [
            'rows' => $rows,
            'kinds' => FixedData::master('prevention_kinds'),
            'type' => $request->query('type'),
            'field' => $request->query('field', 'next_due_date'),
            'from' => $request->query('from'),
            'to' => $request->query('to'),
        ]);
    }

    public function csv(Request $request): StreamedResponse
    {
        $rows = $this->query($request);

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['karte_no', 'owner_name_kanji', 'patient_name_kanji', 'kind', 'next_due_date', 'performed_date']);
            foreach ($rows as $r) {
                fputcsv($out, [
                    $r->patient->karte_no,
                    $r->patient->owner->name_kanji,
                    $r->patient->name_kanji,
                    $r->kind,
                    optional($r->next_due_date)->toDateString(),
                    optional($r->performed_date)->toDateString(),
                ]);
            }
            fclose($out);
        }, 'dm.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * 画面・CSV共通の絞り込み。次回予定日が入っていない記録は出さない。
     * deleted_at が入っている Patient／Owner に紐づく記録は出さない（spec/screens.md画面16）。
     */
    private function query(Request $request): Collection
    {
        $field = in_array($request->query('field'), ['next_due_date', 'performed_date'], true)
            ? $request->query('field') : 'next_due_date';

        $query = Prevention::with(['patient.owner'])
            ->whereNotNull('next_due_date')
            ->whereHas('patient', fn ($q) => $q->whereNull('deleted_at'))
            ->whereHas('patient.owner', fn ($q) => $q->whereNull('deleted_at'));

        if ($request->filled('type')) {
            $kinds = FixedData::master('prevention_kinds');
            $kindIndex = (int) $request->query('type');
            if (isset($kinds[$kindIndex])) {
                $query->where('kind', $kinds[$kindIndex]['code']);
            }
        }

        if ($request->filled('from')) {
            $query->whereDate($field, '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate($field, '<=', $request->query('to'));
        }

        return $query->orderBy($field)->get();
    }
}
