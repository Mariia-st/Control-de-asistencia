<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Alumno extends Model
{
    public function clases()
    {
        return $this->belongsToMany(Clase::class, 'alumno_clase');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function profesor()
    {
        return $this->belongsTo(Profesor::class, 'profesor_id');
    }

    public function asistencias()
    {
        return $this->hasMany(Asistencia::class);
    }

    protected $fillable = [
        'user_id',
        'nombre',
        'apellido',
        'email',
        'profesor_id',
    ];
}
