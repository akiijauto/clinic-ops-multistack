<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 書類（Paper）の「取消」（screen13）。物理削除しない——行は残し、一覧表示からだけ隠す。
 * Owner/Patient/Visit の deleted_at と同じ発想だが、Paper はその3モデルに含まれないため
 * 別名 removed_at にして区別する（App\Support\SoftDeletable は使わない。混同を避けるため）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('papers', function (Blueprint $table) {
            $table->timestamp('removed_at')->nullable()->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('papers', function (Blueprint $table) {
            $table->dropColumn('removed_at');
        });
    }
};
