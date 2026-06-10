<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('alumnos', function (Blueprint $table) {
            $table->dropForeign(['profesor_id']);
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE alumnos MODIFY profesor_id BIGINT UNSIGNED NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE alumnos ALTER COLUMN profesor_id DROP NOT NULL');
        }

        Schema::table('alumnos', function (Blueprint $table) {
            $table->foreign('profesor_id')->references('id')->on('profesor')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('alumnos', function (Blueprint $table) {
            $table->dropForeign(['profesor_id']);
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE alumnos MODIFY profesor_id BIGINT UNSIGNED NOT NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE alumnos ALTER COLUMN profesor_id SET NOT NULL');
        }

        Schema::table('alumnos', function (Blueprint $table) {
            $table->foreign('profesor_id')->references('id')->on('profesor')->cascadeOnDelete();
        });
    }
};
