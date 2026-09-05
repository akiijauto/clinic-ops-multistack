<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ProgressNote — 経過記録。
 *
 * temperature_c は患者ごとに違う値が入るはず。題材の実システムでは
 * 「全患者に同じ体温が印字される」不具合が実際に出た（spec/model.md）。
 * 検算3（spec/acceptance.md）はこれを行単位で突き合わせる。
 * テンプレート側で固定値を参照しないこと。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('progress_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_id')->constrained('visits');
            $table->unsignedInteger('row_no');
            $table->date('entry_date');
            $table->decimal('temperature_c', 4, 1)->nullable();
            $table->unsignedInteger('pulse')->nullable();
            $table->unsignedInteger('respiration')->nullable();
            $table->decimal('body_weight_kg', 6, 2)->nullable();
            $table->string('symptom_course')->nullable();
            $table->string('treatment_rx')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->unique(['visit_id', 'row_no']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('progress_notes');
    }
};
