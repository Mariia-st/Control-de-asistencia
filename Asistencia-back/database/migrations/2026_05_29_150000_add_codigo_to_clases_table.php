<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use App\Models\Clase;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('clases', 'codigo')) {
            Schema::table('clases', function (Blueprint $table) {
                $table->string('codigo', 12)->nullable()->unique()->after('aula');
            });
        }

        Clase::query()
            ->whereNull('codigo')
            ->orWhere('codigo', '')
            ->each(function (Clase $clase) {
                $clase->update(['codigo' => static::generarCodigoUnico()]);
            });
    }

    public function down(): void
    {
        if (Schema::hasColumn('clases', 'codigo')) {
            Schema::table('clases', function (Blueprint $table) {
                $table->dropColumn('codigo');
            });
        }
    }

    private static function generarCodigoUnico(): string
    {
        do {
            $codigo = strtoupper(Str::random(6));
        } while (Clase::where('codigo', $codigo)->exists());

        return $codigo;
    }
};
