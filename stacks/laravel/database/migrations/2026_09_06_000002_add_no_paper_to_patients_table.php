<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 「この子の紙カルテは元から無い」の印（画面13「書類」の「できること」）。
 *
 * spec/openapi.yaml の Patient スキーマには定義が無い（契約は決めていない）。
 * `data/seed.json` の `no_paper_patient_ids`（指揮役が追加。契約側の定義ではない）を
 * 初期値として使うには、この状態をどこかに永続させる必要があるため、
 * `patients.no_paper` を追加した（2026-09-06、レビュー指摘対応）。
 *
 * 「取り込んでいない（0件）」と「元から無い」は、一覧表示だけでは区別できない
 * （どちらも空に見える）。この列はその区別のためだけに存在する。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->boolean('no_paper')->default(false)->after('neuter_date');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn('no_paper');
        });
    }
};
