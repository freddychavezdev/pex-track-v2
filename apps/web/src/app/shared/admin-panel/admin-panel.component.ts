import { Component, EventEmitter, inject, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppRole, AuditLogRecord, AvailabilityStatus, TeamRecord, TechnicianRecord, UserProfile, VehicleRecord } from '../../core/models/operations.models';
import { AdminService } from '../../core/services/admin.service';

type AdminTab = 'users' | 'technicians' | 'vehicles' | 'teams' | 'audit';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.scss'
})
export class AdminPanelComponent implements OnInit {
  @Output() readonly closed = new EventEmitter<void>();
  private readonly service = inject(AdminService);
  readonly users = signal<UserProfile[]>([]);
  readonly technicians = signal<TechnicianRecord[]>([]);
  readonly vehicles = signal<VehicleRecord[]>([]);
  readonly teams = signal<TeamRecord[]>([]);
  readonly auditLogs = signal<AuditLogRecord[]>([]);
  readonly loading = signal(false);
  activeTab: AdminTab = 'users';
  message = '';
  error = '';
  editingTechnician: Partial<TechnicianRecord> | null = null;
  editingVehicle: Partial<VehicleRecord> | null = null;
  editingTeam: Partial<TeamRecord> | null = null;
  userForm = { fullName: '', email: '', password: '', role: 'technician' as AppRole };

  ngOnInit(): void { void this.reload(); }

  async reload(): Promise<void> {
    this.loading.set(true); this.error = '';
    try {
      const [users, technicians, vehicles, teams, auditLogs] = await Promise.all([
        this.service.listUsers(), this.service.listTechnicians(), this.service.listVehicles(), this.service.listTeams(), this.service.listAuditLogs()
      ]);
      this.users.set(users); this.technicians.set(technicians); this.vehicles.set(vehicles); this.teams.set(teams); this.auditLogs.set(auditLogs);
    } catch (e) { this.error = this.messageOf(e); }
    finally { this.loading.set(false); }
  }

  async createUser(): Promise<void> {
    this.message = ''; this.error = '';
    try {
      await this.service.createUser(this.userForm);
      this.message = 'Usuario creado y habilitado para iniciar sesión.';
      this.userForm = { fullName: '', email: '', password: '', role: 'technician' };
      this.users.set(await this.service.listUsers());
    } catch (e) { this.error = this.messageOf(e); }
  }

  async toggleUser(user: UserProfile): Promise<void> {
    this.message = ''; this.error = '';
    try { await this.service.setUserActive(user.id, !user.active); this.users.set(await this.service.listUsers()); }
    catch (e) { this.error = this.messageOf(e); }
  }

  newTechnician(): void { this.editingTechnician = { availability: 'available', active: true }; }
  newVehicle(): void { this.editingVehicle = { status: 'available', active: true }; }
  newTeam(): void { this.editingTeam = { active: true }; }
  editTechnician(value: TechnicianRecord): void { this.editingTechnician = { ...value }; }
  editVehicle(value: VehicleRecord): void { this.editingVehicle = { ...value }; }
  editTeam(value: TeamRecord): void { this.editingTeam = { ...value }; }

  async saveTechnician(): Promise<void> { await this.runSave(() => this.service.saveTechnician(this.editingTechnician ?? {}), 'Técnico guardado.'); }
  async saveVehicle(): Promise<void> { await this.runSave(() => this.service.saveVehicle(this.editingVehicle ?? {}), 'Vehículo guardado.'); }
  async saveTeam(): Promise<void> { await this.runSave(() => this.service.saveTeam(this.editingTeam ?? {}), 'Cuadrilla guardada.'); }

  private async runSave(save: () => Promise<void>, success: string): Promise<void> {
    this.message = ''; this.error = '';
    try { await save(); this.message = success; this.editingTechnician = null; this.editingVehicle = null; this.editingTeam = null; await this.reload(); }
    catch (e) { this.error = this.messageOf(e); }
  }

  technicianName(id: string): string { return this.technicians().find((item) => item.id === id)?.profile?.full_name ?? 'Seleccionar técnico'; }
  vehicleLabel(id: string): string { const value = this.vehicles().find((item) => item.id === id); return value ? `${value.plate}${value.model ? ` · ${value.model}` : ''}` : 'Seleccionar vehículo'; }
  roleLabel(role: AppRole): string { return { supervisor: 'Supervisor', coordinator: 'Coordinador', technician: 'Técnico' }[role]; }
  availabilityLabel(value: AvailabilityStatus): string { return { available: 'Disponible', unavailable: 'No disponible', on_service: 'En servicio' }[value]; }
  auditDetails(log: AuditLogRecord): string { return Object.entries(log.details ?? {}).filter(([key]) => key !== 'operation').map(([key, value]) => `${key}: ${String(value)}`).join(' · '); }
  auditDate(value: string): string { return new Date(value).toLocaleString('es-BO'); }
  private messageOf(error: unknown): string { return error instanceof Error ? error.message : 'No se pudo completar la operación.'; }
}
