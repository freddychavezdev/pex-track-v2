import { Injectable } from '@angular/core';
import { AppRole, AuditLogRecord, TeamRecord, TechnicianRecord, UserProfile, VehicleRecord } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

export interface CreateUserRequest { email: string; password: string; fullName: string; role: AppRole; }

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async listUsers(): Promise<UserProfile[]> {
    const { data, error } = await this.supabase.requireClient().functions.invoke('admin-users', { body: { action: 'list' } });
    if (error) throw error;
    return (data?.users ?? []) as UserProfile[];
  }

  async createUser(request: CreateUserRequest): Promise<void> {
    const { error } = await this.supabase.requireClient().functions.invoke('admin-users', { body: { action: 'create', ...request } });
    if (error) throw await this.functionError(error);
  }

  private async functionError(error: any): Promise<Error> {
    try {
      const body = error?.context && typeof error.context.json === 'function' ? await error.context.json() : null;
      const detail = body?.error ?? body?.message;
      if (detail) return new Error(detail);
    } catch { /* conserva el mensaje genérico si la respuesta no es JSON */ }
    return new Error(error?.message || 'No se pudo completar la operación en Supabase.');
  }

  async setUserActive(userId: string, active: boolean): Promise<void> {
    const { error } = await this.supabase.requireClient().functions.invoke('admin-users', { body: { action: 'set-active', userId, active } });
    if (error) throw error;
  }

  async listAuditLogs(): Promise<AuditLogRecord[]> {
    const { data, error } = await this.supabase.requireClient().from('audit_logs')
      .select('id, actor_id, action, entity_type, entity_id, details, ip_address, occurred_at, actor:profiles(full_name)')
      .order('occurred_at', { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({ ...row, actor: row.actor?.[0] ?? null })) as AuditLogRecord[];
  }

  async listTechnicians(): Promise<TechnicianRecord[]> {
    const { data, error } = await this.supabase.requireClient()
      .from('technicians').select('id, profile_id, document_number, phone, availability, active, profiles(full_name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({ ...row, profile: row.profiles, profiles: undefined })) as TechnicianRecord[];
  }

  async saveTechnician(input: Partial<TechnicianRecord> & { id?: string }): Promise<void> {
    const payload = { profile_id: input.profile_id || null, document_number: input.document_number?.trim() || null, phone: input.phone?.trim() || null, availability: input.availability ?? 'available', active: input.active ?? true };
    const query = this.supabase.requireClient().from('technicians');
    const result = input.id ? await query.update(payload).eq('id', input.id) : await query.insert(payload);
    if (result.error) throw result.error;
  }

  async listVehicles(): Promise<VehicleRecord[]> {
    const { data, error } = await this.supabase.requireClient().from('vehicles').select('id, plate, model, vehicle_type, status, active').order('plate');
    if (error) throw error;
    return (data ?? []) as VehicleRecord[];
  }

  async saveVehicle(input: Partial<VehicleRecord> & { id?: string }): Promise<void> {
    const payload = { plate: input.plate?.trim().toUpperCase(), model: input.model?.trim() || null, vehicle_type: input.vehicle_type?.trim() || null, status: input.status ?? 'available', active: input.active ?? true };
    if (!payload.plate) throw new Error('La placa es obligatoria.');
    const query = this.supabase.requireClient().from('vehicles');
    const result = input.id ? await query.update(payload).eq('id', input.id) : await query.insert(payload);
    if (result.error) throw result.error;
  }

  async listTeams(): Promise<TeamRecord[]> {
    const { data, error } = await this.supabase.requireClient().from('teams')
      .select('id, code, technician_one_id, technician_two_id, vehicle_id, active, dispatch_status, technician_one:technicians!teams_technician_one_id_fkey(profiles(full_name)), technician_two:technicians!teams_technician_two_id_fkey(profiles(full_name)), vehicle:vehicles(plate, model)')
      .order('code');
    if (error) throw error;
    return (data ?? []).map((row: any) => {
      return {
        ...row,
        dispatch_status: row.dispatch_status ?? 'available',
        base_label: null,
        base_latitude: null,
        base_longitude: null,
        technician_one: row.technician_one ? { profile: row.technician_one.profiles } : null,
        technician_two: row.technician_two ? { profile: row.technician_two.profiles } : null
      };
    }) as TeamRecord[];
  }

  async saveTeam(input: Partial<TeamRecord> & { id?: string }): Promise<void> {
    if (!input.code?.trim() || !input.technician_one_id || !input.technician_two_id || !input.vehicle_id) throw new Error('Código, dos técnicos y vehículo son obligatorios.');
    if (input.technician_one_id === input.technician_two_id) throw new Error('Los técnicos de una cuadrilla deben ser distintos.');
    const payload = { code: input.code.trim().toUpperCase(), technician_one_id: input.technician_one_id, technician_two_id: input.technician_two_id, vehicle_id: input.vehicle_id, active: input.active ?? true };
    const query = this.supabase.requireClient().from('teams');
    const result = input.id ? await query.update(payload).eq('id', input.id).select('id').single() : await query.insert(payload).select('id').single();
    if (result.error) throw result.error;
    const teamId = input.id ?? result.data?.id;
    if (!teamId) throw new Error('No se pudo identificar la cuadrilla guardada.');
    const { error: profileError } = await this.supabase.requireClient().rpc('set_team_dispatch_profile', {
      p_team_id: teamId,
      p_dispatch_status: input.dispatch_status ?? 'available',
      p_base_label: input.base_label?.trim() || null,
      p_base_latitude: input.base_latitude ?? null,
      p_base_longitude: input.base_longitude ?? null
    });
    if (profileError) throw profileError;
  }
}
