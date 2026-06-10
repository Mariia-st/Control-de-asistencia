<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Auth;


class ProfesorController extends Controller
{
    /**
     * Clases del profesor logueado con sus alumnos (árbol para el panel inicio).
     * GET /api/profesor/clases
     */
    public function getMyClases(){

        // se rellena la variable de user 
        /** @var \App\Models\User $user */
        $user=Auth::user();

        //si user no existe significa que no autorizado
        if (!$user) {
            return response()->json(['message' => 'No autorizado'], 401);
        }
        
        //desde bbdd  desde modelo user metodo profesor(),
        //llama para obtener el perfil de profesor,con todas las clases y alumnos dentro de clase
        //first se devuelve o primer registro o null si no hay 
        //profesor hasmany clases,clases hasmany alumnos

        $profesor = $user->profesor()->with('clases.alumnos')->first();

        return response()->json($profesor?->clases ?? []);

    }
  
}
