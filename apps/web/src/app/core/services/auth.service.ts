import { Injectable, signal } from '@angular/core';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { UserProfile } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly profile = signal<UserProfile | null>(null);
  readonly ready = signal(false);
  readonly passwordRecovery = signal(false);
  private initialized = false;

  constructor(private readonly supabase: SupabaseClientService) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.supabase.client) {
      this.ready.set(true);
      return;
    }

    this.supabase.client.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      this.session.set(session);
      if (event === 'PASSWORD_RECOVERY') this.passwordRecovery.set(true);
      if (event === 'SIGNED_OUT') this.passwordRecovery.set(false);
      void this.loadProfile();
    });
    const { data } = await this.supabase.client.auth.getSession();
    this.session.set(data.session);
    await this.loadProfile();
    await this.rejectInactiveSession();
    this.ready.set(true);
  }

  async signIn(email: string, password: string): Promise<string | null> {
    const client = this.supabase.requireClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    this.session.set((await client.auth.getSession()).data.session);
    await this.loadProfile();
    if (this.profile()?.active === false) {
      await client.auth.signOut();
      this.session.set(null);
      this.profile.set(null);
      return 'La cuenta está inactiva. Solicita al supervisor que la habilite.';
    }
    return null;
  }

  async signOut(): Promise<void> {
    if (this.supabase.client) {
      await this.supabase.client.auth.signOut();
    }
  }

  async requestPasswordReset(email: string): Promise<string | null> {
    const client = this.supabase.requireClient();
    const redirectTo = typeof window === 'undefined' ? undefined : `${window.location.origin}/`;
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return error?.message ?? null;
  }

  async updateRecoveredPassword(password: string): Promise<string | null> {
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    const client = this.supabase.requireClient();
    const { error } = await client.auth.updateUser({ password });
    if (error) return error.message;
    await client.auth.signOut();
    this.passwordRecovery.set(false);
    return null;
  }

  private async loadProfile(): Promise<void> {
    const client = this.supabase.client;
    const userId = this.session()?.user.id;
    if (!client || !userId) {
      this.profile.set(null);
      return;
    }
    const { data } = await client.from('profiles').select('id, full_name, role, active').eq('id', userId).maybeSingle();
    this.profile.set(data as UserProfile | null);
  }

  private async rejectInactiveSession(): Promise<void> {
    if (!this.session() || this.profile()?.active !== false || !this.supabase.client) return;
    await this.supabase.client.auth.signOut();
    this.session.set(null);
    this.profile.set(null);
  }
}
