<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff', function (Blueprint $table) {
            $table->id();
            $table->string('staff_code')->unique();
            $table->string('name');
            $table->enum('role', ['vet', 'nurse', 'office']);
            $table->boolean('is_active')->default(true);
            // 平文で持たない（spec/model.md）。ログインはこの企画では扱わない
            // （coordination/DECISIONS.md 第4節）が、フィールドは種として持つ。
            $table->string('password_hash')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff');
    }
};
