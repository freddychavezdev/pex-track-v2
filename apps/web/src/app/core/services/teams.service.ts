import { Injectable } from '@angular/core';
import { TeamSummary } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async listActive(): Promise<TeamSummary[]> {
    const { data, error } = await this.supabase.requireClient()
      .from('teams')
      .select('id, code, active')
      .eq('active', true)
      .order('code');
    if (error) throw error;
    return (data ?? []) as TeamSummary[];
  }
}
