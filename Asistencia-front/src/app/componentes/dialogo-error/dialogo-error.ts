import { Component, inject, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

/** Datos que recibe el diálogo de error. Usado en: ErrorDialog.open, Clases. */
export interface ErrorDialogData {
  message: string;
  title?: string;
}

/** Clase CSS del panel del diálogo. Usado en: ErrorDialog.open (panelClass). */
export const ERROR_DIALOG_PANEL_CLASS = 'app-error-dialog-panel';

/** Diálogo modal reutilizable para mostrar errores. Usado en: Clases (errores al crear clase/alumno). */
@Component({
  selector: 'app-error-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './dialogo-error.html',
  styleUrl: './dialogo-error.css',
  encapsulation: ViewEncapsulation.None,
})
export class ErrorDialog {
  readonly dialogRef = inject(MatDialogRef<ErrorDialog, boolean>);
  readonly data = inject<ErrorDialogData>(MAT_DIALOG_DATA);

  /** Abre el diálogo con mensaje y título. Usado en: Clases.onCreateClase, Clases.onCreateStudent. */
  static open(dialog: MatDialog, data: ErrorDialogData) {
    return dialog.open(ErrorDialog, {
      panelClass: ERROR_DIALOG_PANEL_CLASS,
      data,
    });
  }

  /** Cierra el diálogo confirmando. Usado en: error-dialog.html (botón Aceptar). */
  onAccept(): void {
    this.dialogRef.close(true);
  }

  /** Cierra el diálogo cancelando. Usado en: error-dialog.html (botón Cancelar). */
  onCancel(): void {
    this.dialogRef.close(false);
  }
}
