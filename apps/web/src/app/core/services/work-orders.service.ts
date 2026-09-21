import { Injectable } from '@angular/core';
import { WorkOrderImportRow, WorkOrderSummary } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class WorkOrdersService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async listForDay(date: string): Promise<WorkOrderSummary[]> {
    const { data, error } = await this.supabase.requireClient()
      .from('work_orders')
      .select('id, code, customer_name, address, task_type, status, priority, scheduled_for, assigned_team_id')
      .eq('scheduled_for', date)
      .order('priority', { ascending: true })
      .order('code');

    if (error) throw error;
    return (data ?? []) as WorkOrderSummary[];
  }

  async importRows(rows: WorkOrderImportRow[]): Promise<void> {
    if (!rows.length) return;
    const payload = rows.map((row) => ({
      code: row.code,
      customer_code: row.customerCode,
      customer_name: row.customerName,
      customer_phone: row.customerPhone,
      address: row.address,
      task_type: row.taskType,
      priority: row.priority,
      scheduled_for: row.scheduledFor
    }));
    const { error } = await this.supabase.requireClient().from('work_orders').upsert(payload, { onConflict: 'code' });
    if (error) throw error;
  }

  async assignTeam(workOrderId: string, teamId: string): Promise<void> {
    const { error } = await this.supabase.requireClient()
      .from('work_orders')
      .update({ assigned_team_id: teamId })
      .eq('id', workOrderId);
    if (error) throw error;
  }
}
