import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../servicios/api-service';
import { HttpClient } from '@angular/common/http';
import { Clase, Student } from '../../entities';
import { finalize } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialog } from '../dialogo-error/dialogo-error';
import { AuthStateService } from '../../servicios/auth-state.service';

/** Tipado del formulario de clase. Usado en: claseForm. */
type ClaseFormControl={
  nombre: FormControl <string>,
  aula: FormControl <string>,
}

/** Tipado del formulario de alumno. Usado en: studentForm. */
type StudentFormControl={
  nombre: FormControl <string>,
  apellido: FormControl <string>,
  email: FormControl <string>,
  password: FormControl <string>,
  clase_ids: FormControl <number[]>,
}

/** Gestión de clases y alumnos del profesor (CRUD). Usado en: ruta /clases. */
@Component({
  selector: 'app-clases',
  imports: [ReactiveFormsModule,FormsModule],
  templateUrl: './clases.html',
  styleUrl: './clases.css',
})
export class Clases implements OnInit {

  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  /** Permisos para mostrar/ocultar acciones. Usado en: clases.html (botones según permiso). */
  protected readonly auth = inject(AuthStateService);

  /** Lista de clases del profesor. Usado en: clases.html (tabla de clases). */
  public readonly clase = signal<Clase[] | []>([]);
  /** Lista de alumnos del profesor. Usado en: clases.html (tabla de alumnos). */
  public readonly student = signal<Student[] | []>([]);
  /** ID de la clase en edición (null = crear nueva). Usado en: clases.html (modo edición). */
  public readonly claseId = signal<number|null>(null);

  /** Indica carga de clases. Usado en: clases.html (spinner). */
  public readonly loadingClases = signal<boolean>(false);
  /** Indica carga de alumnos. Usado en: clases.html (spinner). */
  public readonly loadingAlumnos = signal<boolean>(false);
  /** ID del alumno en edición (null = crear nuevo). Usado en: clases.html (modo edición). */
  public readonly studentId = signal<number|null>(null);
  /** Mensaje de error. Usado en: clases.html (alerta). */
  public readonly error = signal<string| null>(null);
  /** ID de la clase cuyo código se acaba de copiar. Usado en: clases.html (feedback "copiado"). */
  public readonly copiedCodigoId = signal<number | null>(null);

  /** Formulario reactivo para crear/editar clase. Usado en: clases.html, onCreateClase, onModificateClass. */
  public claseForm=new FormGroup<ClaseFormControl>({
    nombre:new FormControl('',{
      validators:[Validators.required],
      nonNullable:true
    }),
    aula:new FormControl('',{
      validators:[Validators.required],
      nonNullable:true
    })
  })

  /** Formulario reactivo para crear/editar alumno. Usado en: clases.html, onCreateStudent, onModificateStudent. */
  public studentForm=new FormGroup<StudentFormControl>({
    nombre:new FormControl('',{
      validators:[Validators.required],
      nonNullable:true
    }),
    apellido:new FormControl('',{
      validators:[Validators.required],
      nonNullable:true
    }),
    email:new FormControl('',{
      validators:[Validators.required,Validators.email],
      nonNullable:true
    }),
    password:new FormControl('',{
      validators:[Validators.required,Validators.minLength(6)],
      nonNullable:true
    }),
    clase_ids:new FormControl<number[]>([],{
      nonNullable:true
    })
  })

  /** Carga clases y alumnos al entrar. Usado en: arranque del componente. */
  ngOnInit(){
    this.getClases()
    this.getStudent()
  }

  /** Carga las clases del profesor. Usado en: ngOnInit, onCreateClase, onModificateClass, onDeleteClass. */
  getClases(){
    this.loadingClases.set(true)
    this.api.get<Clase[]>('profesor/clases')
    .pipe(finalize(()=>{this.loadingClases.set(false)}))
    .subscribe({
        next: (res) => {
          this.clase.set(res)
        },error:()=>{
          this.clase.set([]);
        }
    })
  }

  /** Carga todos los alumnos del profesor. Usado en: ngOnInit, onCreateStudent, onModificateStudent, onDeleteStudent. */
  getStudent(){
    this.loadingAlumnos.set(true)
    this.api.get<{data:Student[]}>('alumnos')
    .pipe(finalize(()=>{this.loadingAlumnos.set(false)}))
    .subscribe({
      next:(res)=>{
        this.student.set(res.data)
      },error:()=>{
        this.student.set([]);
      }
    })
  }

  /** Crea una nueva clase. Usado en: clases.html (submit formulario clase). */
  onCreateClase(){
    const body=this.claseForm.getRawValue()

    this.api.post('clases',body)
    .pipe(finalize(()=>{this.claseForm.reset()}))
    .subscribe({
      next:(res)=>{
        this.getClases()
      },error:(er:HttpClient)=>{
        ErrorDialog.open(this.dialog, {
          message:
            'No se pudieron crear el clase nuevo. Comprueba tu conexión e inténtalo de nuevo.',
          title: 'Error al crear clase',
        });
      }
    })
  }

  /** Crea un nuevo alumno. Usado en: clases.html (submit formulario alumno). */
  onCreateStudent(){
    const body = this.buildStudentPayload()

    this.api.post('alumnos', body)
    .pipe(finalize(()=>{this.studentForm.reset()}))
    .subscribe({
      next: () => {
        this.getStudent()
      },error:()=>{
        ErrorDialog.open(this.dialog, {
          message:
            'No se pudieron crear el alumno nuevo. Comprueba tu conexión e inténtalo de nuevo.',
          title: 'Error al crear alumno',
        });
      }
    })
  }

  /** Elimina un alumno por ID. Usado en: clases.html (botón eliminar alumno). */
  onDeleteStudent(id:number|string){
    this.api.delete(`alumnos/${id}`)
    .pipe(finalize(()=>{this.getStudent()}))
    .subscribe({
      next: () => {},
      error: () => {
        this.error.set('Error al eliminar alumno');
      },
    })
  }

  /** Actualiza un alumno existente. Usado en: clases.html (submit en modo edición). */
  onModificateStudent(id:number){
    const body = this.buildStudentPayload()
    this.api.put(`alumnos/${id}`, body)
    .subscribe({
      next: () => {
        this.getStudent()
        this.studentId.set(null);
        this.cancelStudentEdit();
      },error:()=>{
        this.error.set("Error al actualizar alumno")
      }
    })
  }

  /** Actualiza una clase existente. Usado en: clases.html (submit en modo edición). */
  onModificateClass(id:number){
    const body=this.claseForm.getRawValue() as Clase
    this.api.put<Clase>(`clases/${id}`,body)
    .subscribe({
      next: () => {
        this.getClases()
        this.claseId.set(null);
        this.claseForm.reset()
      },error:()=>{
        this.error.set("Error al actualizar clase")
      }
    })
  }

  /** Elimina una clase por ID. Usado en: clases.html (botón eliminar clase). */
  onDeleteClass(id:number|string){
    this.api.delete(`clases/${id}`)
    .pipe(finalize(()=>{this.getClases()}))
    .subscribe({
      next: () => {},
      error: () => {
        this.error.set('Error al eliminar clase');
      },
    })
  }

  /** Cancela la edición de alumno y restaura validadores. Usado en: clases.html (botón Cancelar). */
  cancelStudentEdit(): void {
    this.studentId.set(null);
    this.studentForm.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.studentForm.controls.password.updateValueAndValidity();
    this.studentForm.reset();
  }

  /** Entra en modo edición de un alumno y rellena el formulario. Usado en: clases.html (botón Editar). */
  startEditStudent(alumno: Student) {
    this.studentId.set(alumno.id);
    this.studentForm.controls.password.clearValidators();
    this.studentForm.controls.password.updateValueAndValidity();

    this.studentForm.patchValue({
      nombre: alumno.nombre,
      apellido: alumno.apellido,
      email: alumno.email,
      password: '',
      clase_ids: (alumno.clases ?? []).map((c) => c.id),
    });
  }

  /** Entra en modo edición de una clase y rellena el formulario. Usado en: clases.html (botón Editar). */
  startEditClass(clase: any) {
    this.claseId.set(clase.id);
    this.claseForm.patchValue({
      nombre: clase.nombre,
      aula: clase.aula,
    });
  }

  /** Copia el código de la clase al portapapeles. Usado en: clases.html (botón copiar código). */
  copyCodigo(codigo: string, claseId: number): void {
    navigator.clipboard.writeText(codigo).then(() => {
      this.copiedCodigoId.set(claseId);
      setTimeout(() => {
        if (this.copiedCodigoId() === claseId) {
          this.copiedCodigoId.set(null);
        }
      }, 2000);
    });
  }

  /** true si la clase está seleccionada en el formulario de alumno. Usado en: clases.html (checkbox de clase). */
  isClaseSelected(claseId: number): boolean {
    return this.studentForm.controls.clase_ids.value.includes(claseId);
  }

  /** Añade o quita una clase del alumno en el formulario. Usado en: clases.html (checkbox de clase). */
  toggleClaseSelected(claseId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.studentForm.controls.clase_ids.value;

    if (checked) {
      this.studentForm.controls.clase_ids.setValue([...current, claseId]);
    } else {
      this.studentForm.controls.clase_ids.setValue(current.filter((id) => id !== claseId));
    }
  }

  /** Construye el payload del alumno (con password solo al crear). Usado en: onCreateStudent, onModificateStudent. */
  private buildStudentPayload(): {
    nombre: string;
    apellido: string;
    email: string;
    clase_ids: number[];
    password?: string;
  } {
    const raw = this.studentForm.getRawValue();
    const payload = {
      nombre: raw.nombre,
      apellido: raw.apellido,
      email: raw.email,
      clase_ids: raw.clase_ids ?? [],
    };

    if (!this.studentId() && raw.password) {
      return { ...payload, password: raw.password };
    }

    return payload;
  }
}
