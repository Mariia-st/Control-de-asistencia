<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreClaseRequest;
use App\Models\Asistencia;
use App\Models\Clase;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ClaseController extends Controller
{
    // Comprueba que la clase pertenezca al profesor logueado
    private function esProfesorDeClase(Clase $clase): bool
    {
        $profesorId = Auth::user()?->profesor?->id;

        return $profesorId !== null && $clase->profesor_id === $profesorId;
    }

    /**
     * Lista alumnos inscritos en una clase.
     * GET /api/clases/{clase}/alumnos
     */
    public function getAlumnosByClase(Clase $clase): JsonResponse
    {
        // Si no es su clase, lista vacía (no revelamos que la clase existe)
        if (!$this->esProfesorDeClase($clase)) {
            return response()->json([], 200);
        }

        return response()->json($clase->alumnos()->get(), 200);
    }

    /**
     * Pasar lista: todos los alumnos de la clase con su estado en una fecha.
     * GET /api/clases/{clase}/asistencias?fecha=2026-05-17
     */
    public function getAsistenciasByClase(Request $request, Clase $clase): JsonResponse
    {
        $validated = $request->validate([
            'fecha' => 'required|date',
        ]);

        $fecha = $validated['fecha'];

        if (!$this->esProfesorDeClase($clase)) {
            return response()->json([
                'clase_id' => $clase->id,
                'fecha' => $fecha,
                'alumnos' => [],
            ], 200);
        }

        $asistencias = Asistencia::with('alumno')
            ->where('clase_id', $clase->id)
            ->whereDate('fecha', $fecha)
            ->get()
            ->keyBy('alumno_id');

            //sacamos todos los alumnos de clase y rellenamos los datos de cada alumno
            //para cada alumno rellenamos el registro
            //function ($alumno) use ($asistencias) se escribe asi por que dentro de esa funcion
            //no se ve variable de asistencia pero la necesitamos para rellenar el registro
        $alumnos = $clase->alumnos()->get()->map(function ($alumno) use ($asistencias, $clase) {
            $registro = $asistencias->get($alumno->id);

            return [
                'id' => $alumno->id,
                'nombre' => $alumno->nombre,
                'apellido' => $alumno->apellido,
                'email' => $alumno->email,
                'clase_id' => $clase->id,
                'asistencia' => $registro ? [
                    'id' => $registro->id,
                    'estado' => $registro->estado,
                    //formateamos la fecha
                    'fecha' => $registro->fecha->format('Y-m-d'),
                ] : null,
            ];
        });

        //devovemos los datos rellenados fecha y clase_id
        return response()->json([
            'clase_id' => $clase->id,
            'fecha' => $fecha,
            'alumnos' => $alumnos,
        ], 200);
    }

    /**
     * Estadísticas de asistencia (hoy + últimos N días) en una sola petición.
     * GET /api/clases/{clase}/estadisticas?dias=7
     */
    public function getEstadisticasByClase(Request $request, Clase $clase): JsonResponse
    {
        $validated = $request->validate([
            'dias' => 'sometimes|integer|min:1|max:30',
        ]);

        $dias = $validated['dias'] ?? 7;
        $hoy = Carbon::today();

        if (!$this->esProfesorDeClase($clase)) {
            return response()->json([
                'clase_id' => $clase->id,
                'total_alumnos' => 0,
                'hoy' => [
                    'fecha' => $hoy->format('Y-m-d'),
                    'presentes' => 0,
                    'ausentes' => 0,
                    'sin_marcar' => 0,
                    'tasa_asistencia' => 0,
                ],
                'por_dia' => [],
            ], 200);
        }

        $totalAlumnos = $clase->alumnos()->count();

        $desde = $hoy->copy()->subDays($dias - 1);

        $asistenciasPorFecha = Asistencia::where('clase_id', $clase->id)
            ->whereDate('fecha', '>=', $desde->toDateString())
            ->whereDate('fecha', '<=', $hoy->toDateString())
            ->get()
            ->groupBy(fn (Asistencia $a) => $a->fecha->format('Y-m-d'));

        $porDia = [];
        $cursor = $desde->copy();

        while ($cursor->lte($hoy)) {
            $fechaStr = $cursor->format('Y-m-d');
            $delDia = $asistenciasPorFecha->get($fechaStr, collect());

            $presentes = $delDia->where('estado', 'presente')->count();
            $ausentes = $delDia->where('estado', 'ausente')->count();
            $sinMarcar = max(0, $totalAlumnos - $presentes - $ausentes);

            $porDia[] = [
                'fecha' => $fechaStr,
                'presentes' => $presentes,
                'ausentes' => $ausentes,
                'sin_marcar' => $sinMarcar,
            ];

            $cursor->addDay();
        }

        $hoyResumen = $porDia[count($porDia) - 1] ?? [
            'fecha' => $hoy->format('Y-m-d'),
            'presentes' => 0,
            'ausentes' => 0,
            'sin_marcar' => $totalAlumnos,
        ];

        $tasaAsistencia = $totalAlumnos > 0
            ? (int) round(($hoyResumen['presentes'] / $totalAlumnos) * 100)
            : 0;

        return response()->json([
            'clase_id' => $clase->id,
            'total_alumnos' => $totalAlumnos,
            'hoy' => [
                'fecha' => $hoyResumen['fecha'],
                'presentes' => $hoyResumen['presentes'],
                'ausentes' => $hoyResumen['ausentes'],
                'sin_marcar' => $hoyResumen['sin_marcar'],
                'tasa_asistencia' => $tasaAsistencia,
            ],
            'por_dia' => $porDia,
        ], 200);
    }

    /**
     * Crea una clase nueva para el profesor logueado (código se genera en el modelo).
     * POST /api/clases
     */
    // StoreClaseRequest: validaciones en el FormRequest, aquí solo validated()
    public function store(StoreClaseRequest $request): JsonResponse
    {

        //nuestro usuario profesor
     /** @var \App\Models\User|null $user */
    $user = Auth::user();

    // Verificamos si nuestro usuario es profesor 
    if (!$user || !$user->profesor) {
        return response()->json([
            'status' => 'error',
            'message' => 'Solo los profesores pueden crear clases o no tienes un perfil de profesor.'
        ], 403);
    } 
    //sacamos id de profesor
    $profesorId = $user->profesor->id; 

    //array_merge se añade array de datos de clase venidos 
    //nombre y aula a id de profesor 
    //se puede hacer de otra forma
    //EJ: $clase = $user->profesor->clases()->create($request->validated());
    $data = array_merge($request->validated(), [
        'profesor_id' => $profesorId
    ]);

    // cremos clase
    $clase = Clase::create($data);

    // cargamos relaciones de asistencia y alumnos
    $clase->load(['asistencias', 'alumnos']);
    
    //devolvemos clase creado
    return response()->json($clase, 201);
    }

    /**
     * Detalle de una clase con alumnos y asistencias cargadas.
     * GET /api/clases/{clase}
     */
    public function show(Clase $clase): JsonResponse
    {
        if ($denied = $this->denyUnlessProfesorDeClase($clase)) {
            return $denied;
        }

        $clase->load(['asistencias', 'alumnos']);
        return response()->json($clase, 200);
    }


    /**
     * Actualiza nombre y aula de la clase.
     * PUT/PATCH /api/clases/{clase}
     */
    public function update(StoreClaseRequest $request, Clase $clase): JsonResponse
    {
        if ($denied = $this->denyUnlessProfesorDeClase($clase)) {
            return $denied;
        }

        $clase->update($request->validated());
        $clase->load(['asistencias', 'alumnos']);
        return response()->json($clase, 200);
    }

    /**
     * Elimina la clase (y relaciones según FK en migraciones).
     * DELETE /api/clases/{clase}
     */
    public function destroy(Clase $clase): JsonResponse
    {
        if ($denied = $this->denyUnlessProfesorDeClase($clase)) {
            return $denied;
        }

        $clase->delete();
        return response()->json(null, 204);
    }

    // 403 si el profesor no es dueño; null si puede seguir
    private function denyUnlessProfesorDeClase(Clase $clase): ?JsonResponse
    {
        if (!$this->esProfesorDeClase($clase)) {
            return response()->json(['message' => 'No tienes permiso para acceder a esta clase'], 403);
        }

        return null;
    }
}
