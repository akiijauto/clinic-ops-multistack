<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->foreignId('staff_id')->constrained('staff');
            $table->string('room');
            $table->string('purpose')->nullable();
            $table->string('note')->nullable();
            $table->enum('status', ['booked', 'cancelled'])->default('booked');
            $table->timestamps();

            // 重なり判定（検算6）はアプリ側で行う。ここでは絞り込みを速くするための索引だけ。
            $table->index(['staff_id', 'starts_at']);
            $table->index(['room', 'starts_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservations');
    }
};
