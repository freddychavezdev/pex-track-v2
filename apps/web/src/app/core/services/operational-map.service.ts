import { Injectable } from '@angular/core';
import { OperationalMapMarker } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class OperationalMapService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async snapshotForDay(date: string): Promise<OperationalMapMarker[]> {
    const { data, error } = await this.supabase.requireClient()
      .rpc('operational_map_snapshot', { p_day: date });
    if (error) throw error;
    return (data ?? []) as OperationalMapMarker[];
  }
}
