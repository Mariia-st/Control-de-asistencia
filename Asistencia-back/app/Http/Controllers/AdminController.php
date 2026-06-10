<?php

namespace App\Http\Controllers;

use App\Models\Alumno;
use App\Models\Asistencia;
use App\Models\Clase;
use App\Models\Profesor;
use App\Models\User;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;

class AdminController extends Controller
{
    /**
     * Métricas globales del sistema (solo rol admin).
     * GET /api/admin/dashboard
     */
    public function dashboard()
    {
        return response()->json([
            'usuarios' => User::count(),
            'usuarios_por_rol' => [
                'admin' => User::role('admin')->count(),
                'profesor' => User::role('profesor')->count(),
                'alumno' => User::role('alumno')->count(),
            ],
            'clases' => Clase::count(),
            'asistencias' => Asistencia::count(),
        ]);
    }

    /**
     * Listado paginado de usuarios con roles y perfiles.
     * GET /api/admin/usuarios?per_page=15
     */
    public function usuarios(Request $request)
    {
        $perPage = min(max((int) $request->get('per_page', 15), 5), 50);

        $users = User::with(['roles', 'profesor', 'alumno'])
            ->orderBy('name')
            ->paginate($perPage);

        // Formato plano para el panel admin del frontend
        $users->getCollection()->transform(fn (User $user) => $this->formatUser($user));

        return response()->json($users);
    }

    /**
     * Roles y permisos Spatie (para selects en el panel).
     * GET /api/admin/roles
     */
    public function roles()
    {
        $roles = Role::with('permissions')
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name')->values(),
            ]);

        return response()->json($roles);
    }

    /**
     * Cambia el rol de un usuario y crea perfil profesor/alumno si hace falta.
     * PUT /api/admin/usuarios/{usuario}/rol  body: { "role": "profesor" }
     */
    public function updateRol(Request $request, User $usuario)
    {
        $validated = $request->validate([
            'role' => ['required', 'string', 'in:admin,profesor,alumno'],
        ]);

        // Evita que el admin se quite su propio rol admin por error
        if ($request->user()->id === $usuario->id && $validated['role'] !== 'admin') {
            return response()->json([
                'message' => 'No podés quitarte el rol de administrador.',
            ], 422);
        }
        //busca en la table role a rol que viene de request
        //el segundo parametro web es la guaed
        $role = Role::findByName($validated['role'], 'web');
        //actualiza la relacion many to many, quita los roles anteriores 
        //asigna solo el rol nuevo 
        $usuario->syncRoles([$validated['role']]);
        //actualiza la coñumna de bbdd role_id
        $usuario->update(['role_id' => $role->id]);

        //recarga resultado y llama al metodo para crear usuario dependiendo de role
        $this->ensureProfile($usuario->fresh(), $validated['role']);

        return response()->json([
            'message' => 'Rol actualizado.',
            'user' => $this->formatUser($usuario->fresh(['roles', 'profesor', 'alumno'])),
        ]);
    }

    /**
     * Elimina un usuario (no puede borrarse a sí mismo).
     * DELETE /api/admin/usuarios/{usuario}
     */
    public function destroy(Request $request, User $usuario)
    {
        if ($request->user()->id === $usuario->id) {
            return response()->json([
                'message' => 'No podés eliminar tu propia cuenta.',
            ], 422);
        }

        $usuario->delete();

        return response()->json(['message' => 'Usuario eliminado.']);
    }

    // Si cambia a profesor/alumno y no tiene fila en profesors/alumnos, la crea
    private function ensureProfile(User $user, string $roleName): void
    {
        if ($roleName === 'profesor' && ! $user->profesor) {
            Profesor::create([
                'user_id' => $user->id,
                'nombre' => $user->name,
                'apellido' => '',
                'email' => $user->email,
            ]);
        }

        if ($roleName === 'alumno' && ! $user->alumno) {
            Alumno::create([
                'user_id' => $user->id,
                'nombre' => $user->name,
                'apellido' => '',
                'email' => $user->email,
                'profesor_id' => null,
            ]);
        }
    }

    // DTO para la tabla de usuarios en el panel admin
    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->pluck('name')->values(),
            'created_at' => $user->created_at?->toIso8601String(),
            'tiene_perfil_profesor' => (bool) $user->profesor,
            'tiene_perfil_alumno' => (bool) $user->alumno,
        ];
    }
}
