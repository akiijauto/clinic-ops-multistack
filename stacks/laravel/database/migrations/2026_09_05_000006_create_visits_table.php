<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients');
            // 患者ごとに連番（spec/openapi.yaml Visit.visit_no。サーバが決める＝readOnly）。
            $table->unsignedInteger('visit_no');
            $table->date('visit_date');
            $table->time('visit_time')->nullable();
            $table->decimal('body_weight_kg', 6, 2)->nullable();
            $table->string('chief_complaint')->nullable();
            $table->string('symptom')->nullable();
            $table->string('diagnosis')->nullable();
            $table->string('treatment')->nullable();
            $table->foreignId('staff_id')->nullable()->constrained('staff');
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();

            $table->unique(['patient_id', 'visit_no']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visits');
    }
};
