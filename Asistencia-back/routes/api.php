<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AlumnoController;
use App\Http\Controllers\AsistenciaController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ClaseController;
use App\Http\Controllers\ProfesorController;
use Illuminate\Support\Facades\Route;

// rutas publicas para registrarse o logearse
Route::post('login', [AuthController::class, 'login']);
Route::post('register', [AuthController::class, 'register']);

// rutas protegidas
Route::middleware('auth:api')->group(function () {

    // sesión
    Route::post('refresh', [AuthController::class, 'refresh']);
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [AuthController::class, 'me']);
    Route::put('me/password', [AuthController::class, 'changePassword']);

    // panel admin
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/dashboard', [AdminController::class, 'dashboard']);
        Route::get('/usuarios', [AdminController::class, 'usuarios']);
        Route::get('/roles', [AdminController::class, 'roles']);
        Route::put('/usuarios/{usuario}/rol', [AdminController::class, 'updateRol']);
        Route::delete('/usuarios/{usuario}', [AdminController::class, 'destroy']);
    });

    // panel alumno (rol alumno o admin)
    Route::middleware('role:alumno|admin')->group(function () {
        Route::get('/alumno/clases', [AlumnoController::class, 'misClases']);
        Route::post('/alumno/unirse', [AlumnoController::class, 'unirseClase']);
        Route::delete('/alumno/clases/{clase}', [AlumnoController::class, 'salirClase']);
        Route::get('/alumno/asistencia/hoy', [AlumnoController::class, 'asistenciaHoy']);
        Route::get('/alumno/asistencia/resumen', [AlumnoController::class, 'asistenciaResumen']);
        Route::get('/alumno/asistencia', [AlumnoController::class, 'asistenciaHistorial']);
    });

    // clases del profesor
    Route::middleware('permission:listar clases')->group(function () {
        Route::get('/profesor/clases', [ProfesorController::class, 'getMyClases']);
        Route::get('clases/{clase}', [ClaseController::class, 'show']);
        Route::get('clases/{clase}/alumnos', [ClaseController::class, 'getAlumnosByClase']);
        Route::get('clases/{clase}/asistencias', [ClaseController::class, 'getAsistenciasByClase']);
        Route::get('clases/{clase}/estadisticas', [ClaseController::class, 'getEstadisticasByClase']);
    });

    Route::middleware('permission:modificar clases')->group(function () {
        Route::post('/clases', [ClaseController::class, 'store']);
        Route::put('clases/{clase}', [ClaseController::class, 'update']);
        Route::patch('clases/{clase}', [ClaseController::class, 'update']);
    });

    Route::delete('clases/{clase}', [ClaseController::class, 'destroy'])
        ->middleware('permission:eliminar clases');

    // gestión de alumnos (profesor)
    Route::middleware('permission:listar alumno')->group(function () {
        Route::get('/alumnos', [AlumnoController::class, 'index']);
        Route::get('/alumnos/{alumno}', [AlumnoController::class, 'show']);
    });

    Route::middleware('permission:modificar alumno')->group(function () {
        Route::post('/alumnos', [AlumnoController::class, 'store']);
        Route::put('/alumnos/{alumno}', [AlumnoController::class, 'update']);
        Route::patch('/alumnos/{alumno}', [AlumnoController::class, 'update']);
    });

    Route::delete('/alumnos/{alumno}', [AlumnoController::class, 'destroy'])
        ->middleware('permission:eliminar alumno');

    // asistencia (profesor)
    Route::middleware('permission:listar asistencia')->group(function () {
        Route::get('/asistencias', [AsistenciaController::class, 'index']);
        Route::get('/asistencias/{asistencia}', [AsistenciaController::class, 'show']);
    });

    Route::middleware('permission:modificar asistencia')->group(function () {
        Route::post('/asistencias', [AsistenciaController::class, 'store']);
        Route::put('/asistencias/{asistencia}', [AsistenciaController::class, 'update']);
        Route::patch('/asistencias/{asistencia}', [AsistenciaController::class, 'update']);
        Route::put('clases/{clase}/asistencias', [AsistenciaController::class, 'saveAsistenciasBulk']);
    });

    Route::delete('/asistencias/{asistencia}', [AsistenciaController::class, 'destroy'])
        ->middleware('permission:modificar asistencia');
});
