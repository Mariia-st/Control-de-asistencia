<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAlumnoRequest;
use App\Models\Alumno;
use App\Models\Asistencia;
use App\Models\Clase;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use Spatie\Permission\Models\Role;

class AlumnoController extends Controller
{
    // Devuelve el perfil alumno del usuario logueado (o null si es solo profesor/admin)
    private function alumnoAutenticado(): ?Alumno
    {
        /** @var \App\Models\User|null $user */
        $user = Auth::user();

        return $user?->alumno;
    }

    /**
     * Lista alumnos visibles para el profesor (creados por él o en sus clases).
     * GET /api/alumnos
     */
    public function index(): JsonResponse
    {
        /** @var \App\Models\User|null $user */
        $user = Auth::user();

        if (!$user?->profesor) {
            return response()->json(['message' => 'Profesor no encontrado'], 403);
        }

        $profesorId = $user->profesor->id;

        // Alumno vinculado al profesor O inscrito en alguna de sus clases
        $alumnos = Alumno::where(function ($query) use ($profesorId) {
            $query->where('profesor_id', $profesorId)
                ->orWhereHas('clases', fn ($q) => $q->where('profesor_id', $profesorId));
        })
            ->with(['clases'])
            ->paginate(10);

        return response()->json($alumnos, 200);
    }

    /**
     * El profesor da de alta un alumno (User + perfil Alumno + clases opcionales).
     * POST /api/alumnos
     */
    public function store(StoreAlumnoRequest $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            /** @var \App\Models\User $adminProfesor */
            $adminProfesor = Auth::user();

            if (!$adminProfesor?->profesor) {
                return response()->json(['message' => 'Profesor no encontrado'], 403);
            }

            $alumnoRole = Role::findByName('alumno', 'web');

            // Cuenta de login del alumno
            $newUser = User::create([
                'name'     => $request->nombre,
                'email'    => $request->email,
                'password' => Hash::make($request->validated('password')),
                'role_id'  => $alumnoRole->id,
            ]);
            $newUser->assignRole($alumnoRole);

            $alumno = Alumno::create([
                'nombre'      => $request->nombre,
                'apellido'    => $request->apellido,
                'email'       => $request->email,
                'profesor_id' => $adminProfesor->profesor->id,
                'user_id'     => $newUser->id,
            ]);

            // clase_ids opcional: asigna el alumno a varias clases del profesor
            if ($request->filled('clase_ids')) {
                $alumno->clases()->sync($request->clase_ids);
            }

            return response()->json($alumno->load('clases'), 201);
        });
    }

    /**
     * Detalle de un alumno con sus clases.
     * GET /api/alumnos/{alumno}
     */
    public function show(Alumno $alumno): JsonResponse
    {
        if ($denied = $this->denyUnlessProfesorDelAlumno($alumno)) {
            return $denied;
        }

        $alumno->load(['clases']);
        return response()->json($alumno, 200);
    }

    /**
     * Actualiza datos del alumno y sincroniza clases; también actualiza users si tiene login.
     * PUT/PATCH /api/alumnos/{alumno}
     */
    public function update(StoreAlumnoRequest $request, Alumno $alumno): JsonResponse
    {
        if ($denied = $this->denyUnlessProfesorDelAlumno($alumno)) {
            return $denied;
        }

        return DB::transaction(function () use ($request, $alumno) {
            $data = $request->safe()->only(['nombre', 'apellido', 'email']);
            $alumno->update($data);

            // Mantener name/email del User alineados con el perfil alumno
            if ($alumno->user_id) {
                User::whereKey($alumno->user_id)->update([
                    'name'  => $data['nombre'],
                    'email' => $data['email'],
                ]);
            }

            if ($request->has('clase_ids')) {
                $alumno->clases()->sync($request->clase_ids ?? []);
            }

            return response()->json($alumno->load('clases'), 200);
        });
    }

    /**
     * Borra el User del alumno (cascade lógico) o solo el perfil si no tenía login.
     * DELETE /api/alumnos/{alumno}
     */
    public function destroy(Alumno $alumno): JsonResponse
    {
        if ($denied = $this->denyUnlessProfesorDelAlumno($alumno)) {
            return $denied;
        }

        return DB::transaction(function () use ($alumno) {
            if ($alumno->user_id) {
                User::whereKey($alumno->user_id)->delete();
            } else {
                $alumno->delete();
            }

            return response()->json(null, 204);
        });
    }

    /**
     * Clases en las que está inscrito el alumno logueado.
     * GET /api/alumno/clases
     */
    public function misClases(): JsonResponse
    {
        // datos de usuario 
        /** @var \App\Models\User|null $user */
        $user = Auth::user();
        $alumno = $user?->alumno;
        //si no encuentra un alumno da []
        if (!$alumno) {
            return response()->json([], 200);
        }
        //si encuentra devuelve clases ordenados por el nombre 
        return response()->json($alumno->clases()->orderBy('nombre')->get(), 200);
    }

    /**
     * Unirse a una clase con el código del profesor (6 caracteres).
     * POST /api/alumno/unirse  body: { "codigo": "ABC123" }
     */
    public function unirseClase(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'codigo' => 'required|string|max:10',
        ]);

        /** @var \App\Models\User|null $user */
        $user = Auth::user();
        $alumno = $user?->alumno;

        if (!$alumno) {
            return response()->json(['message' => 'No tienes perfil de alumno'], 403);
        }

        $codigo = strtoupper(trim($validated['codigo']));
        $clase = Clase::where('codigo', $codigo)->first();

        if (!$clase) {
            return response()->json(['message' => 'Código no válido'], 404);
        }

        // Ya estaba en la tabla pivote alumno_clase
        if ($alumno->clases()->where('clases.id', $clase->id)->exists()) {
            return response()->json([
                'message' => 'Ya perteneces a esta clase',
                'clase' => $clase,
            ], 200);
        }

        $alumno->clases()->attach($clase->id);

        // Primer profesor de referencia si el alumno se registró solo
        if ($alumno->profesor_id === null) {
            $alumno->update(['profesor_id' => $clase->profesor_id]);
        }

        return response()->json([
            'message' => 'Te has unido a la clase correctamente',
            'clase' => $clase,
        ], 201);
    }

    /**
     * Quita al alumno de la clase (borra fila en alumno_clase).
     * DELETE /api/alumno/clases/{clase}
     */
    public function salirClase(Clase $clase): JsonResponse
    {
        $alumno = $this->alumnoAutenticado();

        if (!$alumno) {
            return response()->json(['message' => 'No tienes perfil de alumno'], 403);
        }

        if (!$alumno->clases()->where('clases.id', $clase->id)->exists()) {
            return response()->json(['message' => 'No perteneces a esta clase'], 404);
        }

        $alumno->clases()->detach($clase->id);

        return response()->json(['message' => 'Has salido de la clase correctamente'], 200);
    }

    /**
     * Asistencia del alumno logueado en un día (por defecto hoy).
     * GET /api/alumno/asistencia/hoy?fecha=2026-05-17
     */
    public function asistenciaHoy(Request $request): JsonResponse
    {
        //se puede tambien enviar una fecha 
        $validated = $request->validate([
            'fecha' => 'sometimes|date',
        ]);

        $alumno = $this->alumnoAutenticado();
        if (!$alumno) {
            return response()->json(['message' => 'No tienes perfil de alumno'], 403);
        }

        // Día a consultar: si la petición trae ?fecha=..., usamos esa fecha;
        // si no trae nada, usamos la de hoy (formato Y-m-d para comparar en BD)
        $fecha = isset($validated['fecha'])
            ? Carbon::parse($validated['fecha'])->toDateString()
            : Carbon::today()->toDateString();

        $clases = $alumno->clases()->orderBy('nombre')->get();

        $asistencias = Asistencia::where('alumno_id', $alumno->id)
            ->whereDate('fecha', $fecha)
            ->get()
            ->keyBy('clase_id');

            //recorre todo y forma el resulado 
        $resultado = $clases->map(function ($clase) use ($asistencias) {
            $registro = $asistencias->get($clase->id);

            return [
                'clase_id' => $clase->id,
                'nombre' => $clase->nombre,
                'aula' => $clase->aula,
                'asistencia' => $registro ? [
                    'id' => $registro->id,
                    'estado' => $registro->estado,
                    'fecha' => $registro->fecha->format('Y-m-d'),
                ] : null,
            ];
        });

        return response()->json([
            'fecha' => $fecha,
            'clases' => $resultado,
        ], 200);
    }

    /**
     * KPIs de asistencia del alumno en los últimos N días (global y por clase).
     * GET /api/alumno/asistencia/resumen?dias=30
     */
    public function asistenciaResumen(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'dias' => 'sometimes|integer|min:1|max:365',
        ]);

        $alumno = $this->alumnoAutenticado();
        if (!$alumno) {
            return response()->json(['message' => 'No tienes perfil de alumno'], 403);
        }

        $dias = $validated['dias'] ?? 30;
        $hoy = Carbon::today();
        $desde = $hoy->copy()->subDays($dias - 1);

        $registros = Asistencia::where('alumno_id', $alumno->id)
            ->whereDate('fecha', '>=', $desde)
            ->whereDate('fecha', '<=', $hoy)
            ->get();

        $presentes = $registros->where('estado', 'presente')->count();
        $ausentes = $registros->where('estado', 'ausente')->count();
        $total = $presentes + $ausentes;
        $tasa = $total > 0 ? (int) round(($presentes / $total) * 100) : 0;

        $clases = $alumno->clases()->orderBy('nombre')->get();
        $porClase = $clases->map(function ($clase) use ($alumno, $desde, $hoy) {
            $delClase = Asistencia::where('alumno_id', $alumno->id)
                ->where('clase_id', $clase->id)
                ->whereDate('fecha', '>=', $desde)
                ->whereDate('fecha', '<=', $hoy)
                ->get();

            $p = $delClase->where('estado', 'presente')->count();
            $a = $delClase->where('estado', 'ausente')->count();
            $t = $p + $a;

            return [
                'clase_id' => $clase->id,
                'nombre' => $clase->nombre,
                'aula' => $clase->aula,
                'presentes' => $p,
                'ausentes' => $a,
                'tasa_asistencia' => $t > 0 ? (int) round(($p / $t) * 100) : 0,
            ];
        });

        return response()->json([
            'dias' => $dias,
            'fecha_desde' => $desde->format('Y-m-d'),
            'fecha_hasta' => $hoy->format('Y-m-d'),
            'total_registros' => $total,
            'presentes' => $presentes,
            'ausentes' => $ausentes,
            'tasa_asistencia' => $tasa,
            'por_clase' => $porClase,
        ], 200);
    }

    /**
     * Historial paginado de asistencia del alumno (solo sus clases).
     * GET /api/alumno/asistencia?clase_id=&fecha_desde=&fecha_hasta=&per_page=
     */
    public function asistenciaHistorial(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'clase_id' => 'sometimes|integer|exists:clases,id',
            'fecha_desde' => 'sometimes|date',
            'fecha_hasta' => 'sometimes|date|after_or_equal:fecha_desde',
            'per_page' => 'sometimes|integer|min:1|max:100',
        ]);

        $alumno = $this->alumnoAutenticado();
        if (!$alumno) {
            return response()->json(['message' => 'No tienes perfil de alumno'], 403);
        }

        $claseIds = $alumno->clases()->pluck('clases.id');

        $query = Asistencia::with('clase')
            ->where('alumno_id', $alumno->id)
            ->whereIn('clase_id', $claseIds);

        if ($request->filled('clase_id')) {
            $claseId = (int) $request->input('clase_id');
            // No puede filtrar por una clase en la que no está inscrito
            if (!$claseIds->contains($claseId)) {
                return response()->json(['message' => 'No perteneces a esta clase'], 403);
            }
            $query->where('clase_id', $claseId);
        }

        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha', '>=', $request->date('fecha_desde'));
        }

        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha', '<=', $request->date('fecha_hasta'));
        }

        $query->orderByDesc('fecha')->orderByDesc('id');

        $perPage = min(max((int) $request->input('per_page', 15), 1), 100);

        return response()->json($query->paginate($perPage), 200);
    }

    // true si el alumno fue creado por este profesor o está en alguna de sus clases
    private function esProfesorDelAlumno(Alumno $alumno): bool
    {
        $profesorId = Auth::user()?->profesor?->id;

        if ($profesorId === null) {
            return false;
        }

        if ((int) $alumno->profesor_id === (int) $profesorId) {
            return true;
        }

        return $alumno->clases()->where('profesor_id', $profesorId)->exists();
    }

    // Devuelve 403 o null para continuar (mismo patrón que AsistenciaController)
    private function denyUnlessProfesorDelAlumno(Alumno $alumno): ?JsonResponse
    {
        if (!$this->esProfesorDelAlumno($alumno)) {
            return response()->json(['message' => 'No tienes permiso para acceder a este alumno'], 403);
        }

        return null;
    }
}
