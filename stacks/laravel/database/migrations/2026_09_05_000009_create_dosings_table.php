<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dosings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients');
            $table->string('kind');
            $table->unsignedInteger('fiscal_year');
            for ($m = 1; $m <= 12; $m++) {
                $table->string(sprintf('m%02d', $m))->nullable();
            }
            $table->timestamps();

            $table->unique(['patient_id', 'kind', 'fiscal_year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dosings');
    }
};
