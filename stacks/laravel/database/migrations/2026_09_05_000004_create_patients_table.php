<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            // karte_no は data/seed.json の実値（ダッシュ無しの数字）をそのまま使う。
            // openapi.yaml の正規表現 ^[0-9]+-[0-9]+$ とは食い違う
            // （coordination/qa/lane-c.md D2）。ここでは強制しない。
            $table->string('karte_no')->unique();
            $table->foreignId('owner_id')->constrained('owners');
            $table->string('name_kana');
            $table->string('name_kanji');
            $table->string('species');
            $table->string('breed')->nullable();
            $table->enum('sex', ['male', 'female', 'unknown']);
            $table->date('birth_date')->nullable();
            $table->date('neuter_date')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
