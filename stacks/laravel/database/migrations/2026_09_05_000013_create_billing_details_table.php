<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BillingDetail — 会計の明細。
 *
 * unit_price は未設定（null）がありうる。**0円として合計に入れてはならない**
 * （spec/model.md・spec/acceptance.md 検算2）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('billing_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('billing_id')->constrained('billings');
            $table->unsignedInteger('row_no');
            $table->string('price_code');
            $table->string('name');
            $table->decimal('quantity', 10, 2);
            $table->integer('unit_price')->nullable();
            $table->boolean('is_taxable')->default(true);
            $table->timestamps();

            $table->unique(['billing_id', 'row_no']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_details');
    }
};
