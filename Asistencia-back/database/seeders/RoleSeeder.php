<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Permission::create(['name' => 'modificar asistencia']);
        Permission::create(['name' => 'listar asistencia']);
        Permission::create(['name' => 'listar clases']);
        Permission::create(['name' => 'modificar clases']);
        Permission::create(['name' => 'eliminar clases']);
        Permission::create(['name' => 'listar alumno']);
        Permission::create(['name' => 'modificar alumno']);
        Permission::create(['name' => 'eliminar alumno']);

        $admin = Role::create(['name' => 'admin']);
        $profesor = Role::create(['name' => 'profesor']);
        $alumno = Role::create(['name' => 'alumno']);

        $admin->givePermissionTo(Permission::all()); // Админ может всё
        $profesor->givePermissionTo(['modificar asistencia','listar asistencia','eliminar alumno','eliminar clases','listar clases','modificar clases','listar alumno','modificar alumno']);
        // El panel alumno usa middleware por rol, no por permiso Spatie.
        // Sin permisos de profesor evita acceder a estadísticas/historial del docente.
    }
}
