import { Injectable } from '@angular/core';
import { GlobalSearchResult } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async search(term: string): Promise<GlobalSearchResult[]> {
    const value = term.trim();
    if (value.length < 2) return [];
    const pattern = `%${value.replace(/[%_]/g, '')}%`;
    const client = this.supabase.requireClient();
    const [orders, technicians, vehicles, teams] = await Promise.all([
      client.from('work_orders').select('id, code, address, customer_name, status').or(`code.ilike.${pattern},address.ilike.${pattern},customer_name.ilike.${pattern}`).limit(8),
      client.from('technicians').select('id, document_number, phone, profiles(full_name)').or(`document_number.ilike.${pattern},phone.ilike.${pattern}`).limit(8),
      client.from('vehicles').select('id, plate, model, vehicle_type').or(`plate.ilike.${pattern},model.ilike.${pattern}`).limit(8),
      client.from('teams').select('id, code').ilike('code', pattern).limit(8)
    ]);
    const firstError = [orders, technicians, vehicles, teams].find((result) => result.error)?.error;
    if (firstError) throw firstError;
    return [
      ...(orders.data ?? []).map((item: any) => ({ kind: 'work_order' as const, id: item.id, title: item.code, subtitle: `${item.address}${item.customer_name ? ` · ${item.customer_name}` : ''}` })),
      ...(technicians.data ?? []).map((item: any) => ({ kind: 'technician' as const, id: item.id, title: item.profiles?.full_name ?? item.document_number ?? 'Técnico', subtitle: item.document_number ?? item.phone ?? 'Sin datos adicionales' })),
      ...(vehicles.data ?? []).map((item: any) => ({ kind: 'vehicle' as const, id: item.id, title: item.plate, subtitle: `${item.model ?? 'Sin modelo'}${item.vehicle_type ? ` · ${item.vehicle_type}` : ''}` })),
      ...(teams.data ?? []).map((item: any) => ({ kind: 'team' as const, id: item.id, title: item.code, subtitle: 'Cuadrilla operativa' }))
    ].slice(0, 20);
  }
}
