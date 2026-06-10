<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAlumnoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('clase_id') && !$this->has('clase_ids')) {
            $this->merge([
                'clase_ids' => [$this->input('clase_id')],
            ]);
        }
    }

    public function rules(): array
    {
        $alumnoId = $this->route('alumno') ? $this->route('alumno')->id : null;
        $userId = $this->route('alumno') ? $this->route('alumno')->user_id : null;

        return [
            'clase_ids' => 'nullable|array',
            'clase_ids.*' => 'integer|exists:clases,id',
            'nombre'   => 'required|string|max:255',
            'apellido' => 'required|string|max:255',
            'email'    => [
                'required',
                'email',
                'unique:users,email,' . $userId,
                'unique:alumnos,email,' . $alumnoId,
            ],
            'password' => [
                Rule::requiredIf($this->isMethod('POST')),
                'nullable',
                'string',
                'min:6',
            ],
        ];
    }
}
