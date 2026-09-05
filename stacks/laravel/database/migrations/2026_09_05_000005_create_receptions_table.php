<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('receptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients');
            // 表示順。上下送りで変わる（spec/model.md）。
            $table->integer('display_no');
            $table->dateTime('received_at');
            $table->string('owner_purpose')->nullable();
            $table->string('medical_purpose')->nullable();
            $table->enum('status', ['waiting', 'in_exam', 'done'])->default('waiting');
            $table->foreignId('staff_id')->nullable()->constrained('staff');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receptions');
    }
};
