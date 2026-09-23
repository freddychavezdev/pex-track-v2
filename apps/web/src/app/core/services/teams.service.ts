import { Injectable } from '@angular/core';
import { TeamSummary } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async listActive(): Promise<TeamSummary[]> {
    const { data, error } = await this.supabase.requireClient().rpc('operation_team_catalog');
    if (error) throw error;
    return (data ?? [])
      .filter((team: TeamSummary) => team.active && (team.dispatch_status ?? 'available') === 'available')
      .map((team: TeamSummary) => team as TeamSummary);
  }
}
