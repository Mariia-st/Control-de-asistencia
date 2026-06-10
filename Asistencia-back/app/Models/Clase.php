<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Clase extends Model
{
    public function alumnos()
    {
        return $this->belongsToMany(Alumno::class, 'alumno_clase');
    }
    public function profesor()
    {
        return $this->belongsTo(Profesor::class, 'profesor_id');
    
    }


    protected $fillable = [
        'nombre',
        'aula',
        'codigo',
        'profesor_id',
    ];

    protected static function booted(): void
    {
        static::creating(function (Clase $clase) {
            if (empty($clase->codigo)) {
                do {
                    $codigo = strtoupper(Str::random(6));
                } while (static::where('codigo', $codigo)->exists());
                $clase->codigo = $codigo;
            }
        });
    }

    public function asistencias()
    {
        return $this->hasMany(Asistencia::class);
    }
}
