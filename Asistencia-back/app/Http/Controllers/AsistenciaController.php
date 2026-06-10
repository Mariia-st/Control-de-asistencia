<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAsistenciaBulkRequest;
use App\Http\Requests\StoreAsistenciaRequest;
use App\Models\Asistencia;
use App\Models\Clase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class AsistenciaController extends Controller
{
    /**
     * Lista asistencias del profesor con filtros opcionales.
     * GET /api/asistencias?clase_id=&fecha=&fecha_desde=&fecha_hasta=&nombre=&per_page=
     */
    public function index(Request $request): JsonResponse
    {
        // Cargamos alumno y clase en cada fila para la respuesta JSON
        $query = Asistencia::with(['alumno', 'clase']);

        // Filtros opcionales por query string
        if ($request->filled('clase_id')) {
            $query->where('clase_id', $request->integer('clase_id'));
        }

        if ($request->filled('fecha')) {
            $query->whereDate('fecha', $request->date('fecha'));
        }

        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha', '>=', $request->date('fecha_desde'));
        }

        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha', '<=', $request->date('fecha_hasta'));
        }

        // Buscar por nombre o apellido del alumno (LIKE %termino%)
        if ($request->filled('nombre')) {
            $termino = '%' . trim($request->input('nombre')) . '%';
            $query->whereHas('alumno', function ($q) use ($termino) {
                $q->where(function ($q) use ($termino) {
                    $q->where('nombre', 'like', $termino)
                        ->orWhere('apellido', 'like', $termino);
                });
            });
        }

        $query->orderByDesc('fecha');

        // per_page entre 1 y 500 (por defecto 10)
        $perPage = min(max((int) $request->input('per_page', 10), 1), 500);

        $profesorId = Auth::user()?->profesor?->id;
        // Si no hay perfil profesor, devolvemos lista vacía paginada (no error 403)
        if ($profesorId === null) {
            return response()->json(Asistencia::where('id', 0)->paginate($perPage), 200);
        }

        // Solo asistencias de clases que pertenecen a este profesor
        $query->whereHas('clase', fn ($q) => $q->where('profesor_id', $profesorId));

        return response()->json($query->paginate($perPage), 200);
    }

    /**
     * Crea o actualiza un registro de asistencia (un alumno, una clase, un día).
     * POST /api/asistencias
     */
    public function store(StoreAsistenciaRequest $request) :JsonResponse
    {
     // Datos validados por StoreAsistenciaRequest (alumno_id, clase_id, fecha, estado)
     $data = $request->validated();

     // El profesor logueado debe ser dueño de la clase
     if (!$this->esProfesorDeClaseId((int) $data['clase_id'])) {
         return response()->json(['message' => 'No tienes permiso para modificar esta clase'], 403);
     }

     // updateOrCreate evita duplicados para la misma combinación alumno+clase+fecha
     $asistencia = Asistencia::updateOrCreate(
         [
             'alumno_id' => $data['alumno_id'],
             'clase_id' => $data['clase_id'],
             'fecha' => $data['fecha'],
         ],
         ['estado' => $data['estado']]
     );

     $asistencia->load(['alumno', 'clase']);

     // 201 si se creó fila nueva, 200 si solo se actualizó el estado
     return response()->json(
         $asistencia,
         $asistencia->wasRecentlyCreated ? 201 : 200
     );
    }

    /**
     * Guarda la asistencia de todos los alumnos de una clase en un día.
     * PUT /api/clases/{clase}/asistencias
     */
    public function saveAsistenciasBulk(StoreAsistenciaBulkRequest $request, Clase $clase): JsonResponse
    {
        // $clase viene de la URL (ej: PUT /clases/5/asistencias → Clase con id 5)
        // $request ya pasó StoreAsistenciaBulkRequest (fecha + array asistencias válidos)
        $user = Auth::user();

        // Solo el profesor dueño de esta clase puede guardar su asistencia
        if (!$user?->profesor || $clase->profesor_id !== $user->profesor->id) {
            return response()->json(['message' => 'No tienes permiso para modificar esta clase'], 403);
        }

        // Datos del body ya validados por el FormRequest
        $fecha = $request->validated('fecha');           // ej: "2026-05-17"
        $items = $request->validated('asistencias');       // ej: [{ alumno_id, estado }, ...]

        // IDs de todos los alumnos que pertenecen a ESTA clase (para comprobar después)
        $alumnoIdsDeLaClase = $clase->alumnos()->pluck('alumnos.id');

        // Comprobar que cada alumno del body es de esta clase (no de otra)
        foreach ($items as $item) {
            if (!$alumnoIdsDeLaClase->contains($item['alumno_id'])) {
                return response()->json([
                    'message' => 'El alumno no pertenece a esta clase',
                    'alumno_id' => $item['alumno_id'],
                ], 422);
            }
        }

        // Obligar a enviar un registro por cada alumno de la clase (no solo algunos)
        if (count($items) !== $alumnoIdsDeLaClase->count()) {
            return response()->json([
                'message' => 'Debes marcar la asistencia de todos los alumnos de la clase',
            ], 422);
        }

        // Transacción: si falla un insert/update, se revierte todo (no queda a medias)
        $guardados = DB::transaction(function () use ($items, $clase, $fecha) {
            $resultado = [];

            foreach ($items as $item) {
                // Busca por alumno + clase + fecha; si existe actualiza estado, si no crea fila nueva
                $asistencia = Asistencia::updateOrCreate(
                    [
                        'alumno_id' => $item['alumno_id'],
                        'clase_id' => $clase->id,  // id de la clase de la URL, no del body
                        'fecha' => $fecha,
                    ],
                    [
                        'estado' => $item['estado'],  // 'presente' o 'ausente'
                    ]
                );

                // Incluye datos del alumno en la respuesta
                $resultado[] = $asistencia->load('alumno');
            }

            return $resultado;
        });

        return response()->json([
            'clase_id' => $clase->id,
            'fecha' => $fecha,
            'guardados' => count($guardados),
            'asistencias' => $guardados,
        ], 200);
    }

    /**
     * Devuelve un registro de asistencia con alumno y clase.
     * GET /api/asistencias/{asistencia}
     */
    public function show(Asistencia $asistencia): JsonResponse
    {
    // Comprueba que la asistencia sea de una clase del profesor logueado
    if ($denied = $this->denyUnlessProfesorDeAsistencia($asistencia)) {
        return $denied;
    }

    $asistencia->load(['alumno', 'clase']);

    return response()->json($asistencia, 200);
    }


    /**
     * Actualiza estado (y datos permitidos) de una asistencia existente.
     * PUT/PATCH /api/asistencias/{asistencia}
     */
    public function update(StoreAsistenciaRequest $request,Asistencia $asistencia): JsonResponse
    {
        if ($denied = $this->denyUnlessProfesorDeAsistencia($asistencia)) {
            return $denied;
        }

        $asistencia->update($request->validated());
        $asistencia->load(['alumno','clase']);
        return response()->json($asistencia,200);
        
    }

    /**
     * Elimina un registro de asistencia.
     * DELETE /api/asistencias/{asistencia}
     */
    public function destroy( Asistencia $asistencia) :JsonResponse
    {
        if ($denied = $this->denyUnlessProfesorDeAsistencia($asistencia)) {
            return $denied;
        }

        $asistencia->delete();
        return response()->json(null,204);
    }

    // Comprueba si el profesor logueado es dueño de la clase (por clase_id)
    private function esProfesorDeClaseId(int $claseId): bool
    {
        $clase = Clase::find($claseId);
        if (!$clase) {
            return false;
        }

        $profesorId = Auth::user()?->profesor?->id;

        return $profesorId !== null && $clase->profesor_id === $profesorId;
    }

    // Si no es su clase, devuelve respuesta 403; si ok, devuelve null para seguir el método
    private function denyUnlessProfesorDeAsistencia(Asistencia $asistencia): ?JsonResponse
    {
        if (!$this->esProfesorDeClaseId((int) $asistencia->clase_id)) {
            return response()->json(['message' => 'No tienes permiso para acceder a esta asistencia'], 403);
        }

        return null;
    }
}
