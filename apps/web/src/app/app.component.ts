import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { AuthService } from './core/services/auth.service';
import { WorkOrderImportResult } from './core/models/operations.models';
import { SupabaseClientService } from './core/services/supabase-client.service';
import { WorkOrderImportService } from './core/services/work-order-import.service';
import { WorkOrdersService } from './core/services/work-orders.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule, ReactiveFormsModule, ButtonDirective, InputText],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'PEX Track';
  readonly auth = inject(AuthService);
  readonly supabase = inject(SupabaseClientService);
  private readonly importService = inject(WorkOrderImportService);
  private readonly workOrders = inject(WorkOrdersService);
  showLogin = false;
  showImport = false;
  submitting = false;
  parsingImport = false;
  savingImport = false;
  loginError = '';
  importError = '';
  importResult: WorkOrderImportResult | null = null;
  importDate = new Date().toISOString().slice(0, 10);
  readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] })
  });

  async submitLogin(): Promise<void> {
    if (this.loginForm.invalid || this.submitting) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.loginError = '';
    const { email, password } = this.loginForm.getRawValue();
    const error = await this.auth.signIn(email, password);
    this.submitting = false;
    if (error) {
      this.loginError = error;
      return;
    }
    this.showLogin = false;
    this.loginForm.reset({ email: '', password: '' });
  }

  async readImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.parsingImport) return;
    this.parsingImport = true;
    this.importError = '';
    this.importResult = null;
    try {
      this.importResult = await this.importService.parse(file, this.importDate);
    } catch (error) {
      this.importError = error instanceof Error ? error.message : 'No se pudo leer el archivo.';
    } finally {
      this.parsingImport = false;
      input.value = '';
    }
  }

  async saveImportedOrders(): Promise<void> {
    if (!this.importResult?.valid.length || this.savingImport) return;
    this.savingImport = true;
    this.importError = '';
    try {
      await this.workOrders.importRows(this.importResult.valid);
      this.showImport = false;
      this.importResult = null;
    } catch (error) {
      this.importError = error instanceof Error ? error.message : 'No se pudieron guardar las OTs.';
    } finally {
      this.savingImport = false;
    }
  }
}
