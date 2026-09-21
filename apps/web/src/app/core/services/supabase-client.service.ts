import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  readonly isConfigured = Boolean(environment.supabaseUrl && environment.supabasePublishableKey);
  readonly client: SupabaseClient | null = this.isConfigured
    ? createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase is not configured. Add the project URL and publishable key to environment.ts.');
    }
    return this.client;
  }
}
