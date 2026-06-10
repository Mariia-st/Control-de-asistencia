<?php

namespace Database\Seeders;

use App\Models\Alumno;
use App\Models\Profesor;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $adminRole = Role::where('name', 'admin')->firstOrFail();
        $admin = User::create([
            'name' => 'Admin User',
            'email' => 'admin@test.com',
            'password' => Hash::make('password'),
            'role_id' => $adminRole->id,
        ]);
        $admin->assignRole('admin');

        $profesorRole = Role::where('name', 'profesor')->firstOrFail();
        $profesorUser = User::create([
            'name' => 'Helen',
            'email' => 'ph@test.com',
            'password' => Hash::make('password'),
            'role_id' => $profesorRole->id,
        ]);
        $profesorUser->assignRole('profesor');

        $profesor = Profesor::create([
            'user_id' => $profesorUser->id,
            'nombre' => 'Helen',
            'apellido' => 'García',
            'email' => 'ph@test.com',
        ]);

        $alumnoRole = Role::where('name', 'alumno')->firstOrFail();
        $alumnoUser = User::create([
            'name' => 'Mariia',
            'email' => 'a@test.com',
            'password' => Hash::make('password'),
            'role_id' => $alumnoRole->id,
        ]);
        $alumnoUser->assignRole('alumno');

        Alumno::create([
            'user_id' => $alumnoUser->id,
            'nombre' => 'Mariia',
            'apellido' => 'López',
            'email' => 'a@test.com',
            'profesor_id' => $profesor->id,
        ]);
    }
}
