import { Injectable } from '@angular/core';
import { AppRole, TeamRecord, TechnicianRecord, UserProfile, VehicleRecord } from '../models/operations.models';
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
    if (error) throw error;
  }

  async setUserActive(userId: string, active: boolean): Promise<void> {
    const { error } = await this.supabase.requireClient().functions.invoke('admin-users', { body: { action: 'set-active', userId, active } });
    if (error) throw error;
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
      .select('id, code, technician_one_id, technician_two_id, vehicle_id, active, technician_one:technicians!teams_technician_one_id_fkey(profiles(full_name)), technician_two:technicians!teams_technician_two_id_fkey(profiles(full_name)), vehicle:vehicles(plate, model)')
      .order('code');
    if (error) throw error;
    return (data ?? []).map((row: any) => ({ ...row, technician_one: row.technician_one ? { profile: row.technician_one.profiles } : null, technician_two: row.technician_two ? { profile: row.technician_two.profiles } : null })) as TeamRecord[];
  }

  async saveTeam(input: Partial<TeamRecord> & { id?: string }): Promise<void> {
    if (!input.code?.trim() || !input.technician_one_id || !input.technician_two_id || !input.vehicle_id) throw new Error('Código, dos técnicos y vehículo son obligatorios.');
    if (input.technician_one_id === input.technician_two_id) throw new Error('Los técnicos de una cuadrilla deben ser distintos.');
    const payload = { code: input.code.trim().toUpperCase(), technician_one_id: input.technician_one_id, technician_two_id: input.technician_two_id, vehicle_id: input.vehicle_id, active: input.active ?? true };
    const query = this.supabase.requireClient().from('teams');
    const result = input.id ? await query.update(payload).eq('id', input.id) : await query.insert(payload);
    if (result.error) throw result.error;
  }
}
