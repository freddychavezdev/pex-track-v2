import { Injectable, signal } from '@angular/core';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { UserProfile } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly profile = signal<UserProfile | null>(null);
  readonly ready = signal(false);

  constructor(private readonly supabase: SupabaseClientService) {}

  async initialize(): Promise<void> {
    if (!this.supabase.client) {
      this.ready.set(true);
      return;
    }

    const { data } = await this.supabase.client.auth.getSession();
    this.session.set(data.session);
    await this.loadProfile();
    this.supabase.client.auth.onAuthStateChange((_event: AuthChangeEvent, session) => {
      this.session.set(session);
      void this.loadProfile();
    });
    this.ready.set(true);
  }

  async signIn(email: string, password: string): Promise<string | null> {
    const { error } = await this.supabase.requireClient().auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async signOut(): Promise<void> {
    if (this.supabase.client) {
      await this.supabase.client.auth.signOut();
    }
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
}
