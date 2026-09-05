<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CareRecord — 入院の記録行（投薬・給餌・計測）。
 *
 * performed_by_staff_id は必須。**空の記録行を作らない**（spec/model.md・検算7）。
 * DB制約でも nullable にしない（アプリ側のバリデーションだけに頼らない）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('care_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospitalization_id')->constrained('hospitalizations');
            $table->dateTime('recorded_at');
            $table->enum('category', ['medication', 'feeding', 'measurement']);
            $table->string('content')->nullable();
            $table->foreignId('performed_by_staff_id')->constrained('staff');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('care_records');
    }
};
