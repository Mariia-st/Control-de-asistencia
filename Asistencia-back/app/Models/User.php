<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;
use Spatie\Permission\Traits\HasRoles;
use App\Models\Alumno;
use App\Models\Profesor;

class User extends Authenticatable implements JWTSubject{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;
    use HasRoles;

    /** Roles/permisos Spatie (seeder usa guard `web`; la API autentica con `api`). */
    protected $guard_name = 'web';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */

     public function alumno()
     {
         return $this->hasOne(Alumno::class);
     }
     public function profesor() {
        return $this->hasOne(Profesor::class,'user_id');
    }
     
   


    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
    // Этот метод возвращает идентификатор пользователя (обычно ID)
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    // Здесь можно добавить кастомные данные в токен (например, роль)
    public function getJWTCustomClaims()
    {
        return [
            'role' => $this->roles()->first()?->name, 
        ];
    }
    
}
