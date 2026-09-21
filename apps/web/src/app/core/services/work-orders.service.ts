import { Injectable } from '@angular/core';
import { WorkOrderSummary } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class WorkOrdersService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async listForDay(date: string): Promise<WorkOrderSummary[]> {
    const { data, error } = await this.supabase.requireClient()
      .from('work_orders')
      .select('id, code, customer_name, address, status, priority, scheduled_for, assigned_team_id')
      .eq('scheduled_for', date)
      .order('priority', { ascending: true })
      .order('code');

    if (error) throw error;
    return (data ?? []) as WorkOrderSummary[];
  }
}
