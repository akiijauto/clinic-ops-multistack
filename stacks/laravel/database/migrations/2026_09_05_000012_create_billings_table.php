<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Billing — 会計伝票。
 *
 * 合計金額は保存しない（data/README.md「Billingに合計金額を保存するフィールドは無い」）。
 * 都度 billing_details から App\Services\BillingCalculator が計算する。
 * 物理削除しない対象（Owner/Patient/Visit）には含まれないので deleted_at は持たない。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('billings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients');
            $table->foreignId('owner_id')->constrained('owners');
            // draft の伝票は確定するまで採番されない（空にする実装もありうるため）。
            // SQLiteのUNIQUE索引はNULLどうしを別物として扱うので、null許容にしておけば
            // 複数のdraft伝票が同時に存在してもユニーク制約に触れない
            // （2026-09-06実測：空文字('')で埋めると2件目からUNIQUE違反で500になった）。
            $table->string('slip_no')->nullable()->unique();
            $table->enum('status', ['draft', 'confirmed'])->default('draft');
            $table->date('billed_on');
            $table->foreignId('staff_id')->nullable()->constrained('staff');
            $table->foreignId('cashier_staff_id')->nullable()->constrained('staff');
            $table->integer('paid_amount')->nullable();
            $table->string('payment_method')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billings');
    }
};
