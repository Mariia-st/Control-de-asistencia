<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAsistenciaBulkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'fecha' => 'required|date',
            'asistencias' => 'required|array|min:1',
            'asistencias.*.alumno_id' => 'required|integer|exists:alumnos,id',//* significa para cada elementro de array validacion
            'asistencias.*.estado' => 'required|in:presente,ausente',
        ];
    }
}
