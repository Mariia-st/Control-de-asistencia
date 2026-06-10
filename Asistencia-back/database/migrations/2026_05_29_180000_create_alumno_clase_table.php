<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alumno_clase', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alumno_id')->constrained('alumnos')->cascadeOnDelete();
            $table->foreignId('clase_id')->constrained('clases')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['alumno_id', 'clase_id']);
        });

        if (Schema::hasColumn('alumnos', 'clase_id')) {
            $rows = DB::table('alumnos')
                ->whereNotNull('clase_id')
                ->get(['id', 'clase_id']);

            foreach ($rows as $row) {
                DB::table('alumno_clase')->insertOrIgnore([
                    'alumno_id' => $row->id,
                    'clase_id' => $row->clase_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            Schema::table('alumnos', function (Blueprint $table) {
                $table->dropForeign(['clase_id']);
                $table->dropColumn('clase_id');
            });
        }
    }

    public function down(): void
    {
        Schema::table('alumnos', function (Blueprint $table) {
            $table->foreignId('clase_id')->nullable()->after('user_id')->constrained('clases')->nullOnDelete();
        });

        $rows = DB::table('alumno_clase')->orderBy('id')->get();

        foreach ($rows as $row) {
            DB::table('alumnos')
                ->where('id', $row->alumno_id)
                ->whereNull('clase_id')
                ->update(['clase_id' => $row->clase_id]);
        }

        Schema::dropIfExists('alumno_clase');
    }
};
