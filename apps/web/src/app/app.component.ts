import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from './core/services/auth.service';
import { SupabaseClientService } from './core/services/supabase-client.service';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'PEX Track';
  readonly auth = inject(AuthService);
  readonly supabase = inject(SupabaseClientService);
  showLogin = false;
  submitting = false;
  loginError = '';
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
}
