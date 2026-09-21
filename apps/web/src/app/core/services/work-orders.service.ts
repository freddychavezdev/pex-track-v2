import { Injectable } from '@angular/core';
import { WorkOrderImportRow, WorkOrderSummary } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class WorkOrdersService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async listForDay(date: string): Promise<WorkOrderSummary[]> {
    const { data, error } = await this.supabase.requireClient()
      .from('work_orders')
      .select('id, code, customer_name, address, task_type, status, priority, scheduled_for, assigned_team_id, zone:zones(code), node:network_nodes(code), box:distribution_boxes(code)')
      .eq('scheduled_for', date)
      .order('priority', { ascending: true })
      .order('code');

    if (error) throw error;
    return (data ?? []).map((row: any) => ({ ...row, zone: row.zone?.[0] ?? null, node: row.node?.[0] ?? null, box: row.box?.[0] ?? null })) as WorkOrderSummary[];
  }

  async importRows(rows: WorkOrderImportRow[]): Promise<void> {
    if (!rows.length) return;
    const references = await this.resolveNetworkReferences(rows);
    const payload = rows.map((row) => ({
      code: row.code,
      customer_code: row.customerCode,
      customer_name: row.customerName,
      customer_phone: row.customerPhone,
      address: row.address,
      task_type: row.taskType,
      priority: row.priority,
      scheduled_for: row.scheduledFor,
      zone_id: row.zoneCode ? references.zones.get(row.zoneCode.toLowerCase()) ?? null : null,
      node_id: row.nodeCode ? references.nodes.get(row.nodeCode.toLowerCase()) ?? null : null,
      box_id: row.boxCode ? references.boxes.get(row.boxCode.toLowerCase()) ?? null : null
    }));
    const { data, error } = await this.supabase.requireClient().from('work_orders').upsert(payload, { onConflict: 'code' }).select('id, code');
    if (error) throw error;
    await Promise.all(rows.filter((row) => row.latitude !== null && row.longitude !== null).map((row) => {
      const saved = (data ?? []).find((item) => item.code === row.code);
      return saved ? this.setLocation(saved.id, row.latitude!, row.longitude!) : Promise.resolve();
    }));
  }

  async assignTeam(workOrderId: string, teamId: string): Promise<void> {
    const { error } = await this.supabase.requireClient()
      .from('work_orders')
      .update({ assigned_team_id: teamId })
      .eq('id', workOrderId);
    if (error) throw error;
  }

  async createManual(input: { code: string; customerName: string; customerPhone: string; address: string; taskType: WorkOrderImportRow['taskType']; priority: number; scheduledFor: string; latitude: number | null; longitude: number | null }): Promise<void> {
    const { data, error } = await this.supabase.requireClient().from('work_orders').insert({
      code: input.code.trim(), customer_name: input.customerName.trim() || null, customer_phone: input.customerPhone.trim() || null,
      address: input.address.trim(), task_type: input.taskType, priority: input.priority, scheduled_for: input.scheduledFor
    }).select('id').single();
    if (error) throw error;
    if (input.latitude !== null && input.longitude !== null) await this.setLocation(data.id, input.latitude, input.longitude);
  }

  private async setLocation(id: string, latitude: number, longitude: number): Promise<void> {
    const { error } = await this.supabase.requireClient().rpc('set_work_order_location', {
      p_work_order_id: id, p_latitude: latitude, p_longitude: longitude
    });
    if (error) throw error;
  }

  private async resolveNetworkReferences(rows: WorkOrderImportRow[]): Promise<{
    zones: Map<string, string>;
    nodes: Map<string, string>;
    boxes: Map<string, string>;
  }> {
    const client = this.supabase.requireClient();
    const zoneCodes = [...new Set(rows.map((row) => row.zoneCode?.trim().toLowerCase()).filter(Boolean))] as string[];
    const nodeCodes = [...new Set(rows.map((row) => row.nodeCode?.trim().toLowerCase()).filter(Boolean))] as string[];
    const boxCodes = [...new Set(rows.map((row) => row.boxCode?.trim().toLowerCase()).filter(Boolean))] as string[];
    const [zonesResult, nodesResult, boxesResult] = await Promise.all([
      zoneCodes.length ? client.from('zones').select('id, code').in('code', zoneCodes) : Promise.resolve({ data: [], error: null }),
      nodeCodes.length ? client.from('network_nodes').select('id, code').in('code', nodeCodes) : Promise.resolve({ data: [], error: null }),
      boxCodes.length ? client.from('distribution_boxes').select('id, code').in('code', boxCodes) : Promise.resolve({ data: [], error: null })
    ]);
    const referenceError = zonesResult.error ?? nodesResult.error ?? boxesResult.error;
    if (referenceError) throw referenceError;
    const zones = new Map((zonesResult.data ?? []).map((item: { id: string; code: string }) => [item.code.toLowerCase(), item.id]));
    const nodes = new Map((nodesResult.data ?? []).map((item: { id: string; code: string }) => [item.code.toLowerCase(), item.id]));
    const boxes = new Map((boxesResult.data ?? []).map((item: { id: string; code: string }) => [item.code.toLowerCase(), item.id]));
    const missing = [
      ...zoneCodes.filter((code) => !zones.has(code)).map((code) => `zona ${code}`),
      ...nodeCodes.filter((code) => !nodes.has(code)).map((code) => `nodo ${code}`),
      ...boxCodes.filter((code) => !boxes.has(code)).map((code) => `caja ${code}`)
    ];
    if (missing.length) throw new Error(`No existen estas referencias de red: ${missing.join(', ')}.`);
    return { zones, nodes, boxes };
  }
}
