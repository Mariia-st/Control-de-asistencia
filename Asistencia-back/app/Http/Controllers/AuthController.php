<?php

namespace App\Http\Controllers;

use App\Models\Alumno;
use App\Models\Profesor;
use Illuminate\Http\Request;
use App\Models\User;
use Tymon\JWTAuth\Facades\JWTAuth; // Используем этот фасад напрямую
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class AuthController extends Controller
{
    /**
     * Registro público como alumno o profesor (crea User + perfil + JWT).
     * POST /api/register
     */
    public function register(Request $request)
    {
        //validamos los datos 
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'apellido' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'role' => ['required', 'string', 'in:alumno,profesor'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $roleName = $validated['role'];

        //Spatie Permissions
        //web = busca el rol en la tabla donde lo guardamos al hacer seed
        //en role seed lo hecho con web (guard api)
        $role = Role::findByName($roleName, 'web');

        //creamos usuario 
        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role_id' => $role->id,
            'password' => bcrypt($validated['password']),
        ]);
        //asignamos rol a usuario 
        $user->assignRole($role);

       //cremos usuario alumno o profesor para la bd dependiendo de role que viene 

    if ($roleName === 'alumno') {
        //creamos alumno
        Alumno::create([
            'user_id' => $user->id,
            'nombre'   => $validated['name'],
            'apellido' => $validated['apellido'],
            'email'    => $validated['email'],
            'profesor_id' => null,
        ]);
    } elseif ($roleName === 'profesor') {
        //creamos profesor
        Profesor::create([
            'user_id'  => $user->id,
            'nombre'   => $validated['name'],
            'apellido' => $validated['apellido'],
            'email'    => $validated['email'],
    
        ]);
    }
      


    //crea un token sin verificar los datos que acabo de registrar
    //datos ya han sido validados no se falata attempt()
        $token = JWTAuth::fromUser($user);

        return $this->respondWithToken($token);
    }


    /**
     * Login con email y password; devuelve JWT.
     * POST /api/login
     */
    public function login(Request $request)
    {

        $credentials = $request->only('email', 'password');

        // Sacamos el token si no da error
        if (!$token = JWTAuth::attempt($credentials)) {
            return response()->json(['error' => 'Login o contraseña no esta correcto'], 401);
        }
        //devolvemos el token 
        return $this->respondWithToken($token);
    }
    /**
     * Invalida el token actual (logout).
     * POST /api/logout
     */
    public function logout()
    {
        try {
            // invalidamos el token para no poder usarlo 
            JWTAuth::invalidate(JWTAuth::getToken());
    
            return response()->json(['message' => 'Sesión cerrada correctamente']);
        } catch (\Tymon\JWTAuth\Exceptions\JWTException $e) {
            //si el token ya no es valido etc... 
            return response()->json(['error' => 'No se pudo cerrar la sesión, token inválido'], 401);
        }
    }

    /**
     * Renueva el JWT antes de que caduque.
     * POST /api/refresh
     */
    public function refresh()
    {
        // JWTAuth::refresh() coge automatico el token viego 
        try {
            $newToken = JWTAuth::refresh();
            // y refresca
            return $this->respondWithToken($newToken);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error al refrescar el token'], 401);
        }
    }

    /**
     * Datos del usuario logueado con roles y permisos (para guards en Angular).
     * GET /api/me
     */
    public function me(Request $request)
    {
        //user desdse el request 
        $user = $request->user();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role_id' => $user->role_id,
            //nombres de roles
            'roles' => $user->getRoleNames(),
            //permisos pluck solo para sacar solo una columna o campo 
            'permissions' => $user->getAllPermissions()->pluck('name')

        ]);
    }

    // metodo para cambiar contraseña del usuario logueado
    public function changePassword(Request $request)
    {
        // PUT /api/me/password
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        /** @var \App\Models\User $user */
        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json(['message' => 'La contraseña actual no es correcta'], 422);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
        ]);

        return response()->json(['message' => 'Contraseña actualizada correctamente'], 200);
    }


    //metodo para dar respuesta con token 
    protected function respondWithToken($token)
    {
        //toma el token lo decodifica y obtiene el user de la bd
        $user = JWTAuth::setToken($token)->toUser();
        //formamos la respuesta 
        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            //cuanto dura el token
            'expires_in' => config('jwt.ttl') * 60,
            'user' => $user->load('roles'),
        ]);
    }
}
