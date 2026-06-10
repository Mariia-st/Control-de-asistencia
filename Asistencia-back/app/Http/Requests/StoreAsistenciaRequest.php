<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAsistenciaRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'alumno_id'=>'required|integer|exists:alumnos,id',
            'clase_id'=>'required|integer|exists:clases,id',
            'fecha'=>'required|date',
            'estado'=>'required|in:presente,ausente'
        ];
        
    }
}
