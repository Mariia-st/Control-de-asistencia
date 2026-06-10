<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Asistencia extends Model
{
    public function alumno()
    {
        return $this->belongsTo(Alumno::class);
    }
    public function clase()
    {
        return $this->belongsTo(Clase::class);
    }

    protected $fillable=[
        'alumno_id',
        'clase_id',
        'fecha',
        'estado'
    ];

    protected $casts = [
        'fecha' => 'date',
    ];
}


