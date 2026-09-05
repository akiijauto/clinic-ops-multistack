<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Clinic — 病院。1件だけ存在する（spec/model.md）。分院は扱わない。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinics', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('postal_code')->nullable();
            $table->string('address1')->nullable();
            $table->string('address2')->nullable();
            $table->string('phone')->nullable();
            $table->string('fax')->nullable();
            $table->string('director_name')->nullable();
            $table->unsignedInteger('reservation_slot_minutes')->default(15);
            // 消費税率。小数（例 0.10）。金額はSQLiteでも誤差が出ないよう常に整数円で扱うが、
            // 税率そのものは decimal として持つ（4,2 で 0.00〜9.99 まで表現できる）。
            $table->decimal('tax_rate', 4, 2)->default(0.10);
            // 休診日（0=月…6=日）。JSON配列で持つ。SQLiteは json() をTEXTとして扱う。
            $table->json('closed_weekdays')->default('[]');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clinics');
    }
};
