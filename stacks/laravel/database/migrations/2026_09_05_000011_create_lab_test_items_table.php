<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * LabTestItem — 検査の項目値。
 *
 * 基準値は data/lab_items.json（固定データ）から引く。ここには保存しない
 * （spec/model.md）。判定（judgement）・基準の上下限もDBには持たず、
 * App\Services\LabJudgment が都度計算する。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lab_test_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lab_test_id')->constrained('lab_tests');
            $table->string('item_code');
            $table->decimal('value_num', 10, 4)->nullable();
            $table->string('value_text')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_test_items');
    }
};
