<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Используем foreignId для краткости, она делает то же самое, что и unsignedBigInteger
            $table->foreignId('role_id')
                  ->after('password')
                  ->default(3)
                  ->constrained('roles') // Laravel сам найдет таблицу 'roles' и колонку 'id'
                  ->onDelete('restrict'); 
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Сначала удаляем связь, потом колонку
            $table->dropForeign(['role_id']);
            $table->dropColumn('role_id');
        });
    }
};
