<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Profesor extends Model
{
    protected $table = 'profesor';
    protected $fillable = ['user_id',  'nombre', 'apellido', 'email'];

public function user() {
    return $this->belongsTo(User::class);
}

public function clases() {
    return $this->hasMany(Clase::class);
}
}
