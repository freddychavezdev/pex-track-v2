import { Injectable } from '@angular/core';
import { TeamSummary } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async listActive(): Promise<TeamSummary[]> {
    const { data, error } = await this.supabase.requireClient().from('teams')
      .select('id, code, active, dispatch_status')
      .eq('active', true)
      .order('code');
    if (error) throw error;
    return (data ?? [])
      .filter((team: TeamSummary) => team.active && (team.dispatch_status ?? 'available') === 'available')
      .map((team: TeamSummary) => team as TeamSummary);
  }
}
