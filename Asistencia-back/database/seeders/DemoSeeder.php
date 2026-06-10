<?php

namespace Database\Seeders;

use App\Models\Alumno;
use App\Models\Asistencia;
use App\Models\Clase;
use App\Models\Profesor;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $profesor = Profesor::where('email', 'ph@test.com')->first();
        $alumno = Alumno::where('email', 'a@test.com')->first();

        if (!$profesor || !$alumno) {
            return;
        }

        $matematicas = Clase::create([
            'nombre' => 'Matemáticas',
            'aula' => '101',
            'profesor_id' => $profesor->id,
        ]);

        $lengua = Clase::create([
            'nombre' => 'Lengua',
            'aula' => '202',
            'profesor_id' => $profesor->id,
        ]);

        $alumno->clases()->sync([$matematicas->id, $lengua->id]);

        if ($alumno->profesor_id === null) {
            $alumno->update(['profesor_id' => $profesor->id]);
        }

        $hoy = Carbon::today();

        for ($i = 0; $i < 7; $i++) {
            $fecha = $hoy->copy()->subDays($i);

            Asistencia::updateOrCreate(
                [
                    'alumno_id' => $alumno->id,
                    'clase_id' => $matematicas->id,
                    'fecha' => $fecha->toDateString(),
                ],
                ['estado' => $i % 3 === 0 ? 'ausente' : 'presente'],
            );

            Asistencia::updateOrCreate(
                [
                    'alumno_id' => $alumno->id,
                    'clase_id' => $lengua->id,
                    'fecha' => $fecha->toDateString(),
                ],
                ['estado' => $i % 4 === 0 ? 'ausente' : 'presente'],
            );
        }
    }
}
