import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { AuthService } from './core/services/auth.service';
import { GlobalSearchResult, OperationalMapMarker, TeamSummary, WorkOrderImportResult, WorkOrderImportRow, WorkOrderStatus, WorkOrderSummary } from './core/models/operations.models';
import { OperationalMapService } from './core/services/operational-map.service';
import { ReportsService } from './core/services/reports.service';
import { SupabaseClientService } from './core/services/supabase-client.service';
import { WorkOrderImportService } from './core/services/work-order-import.service';
import { WorkOrdersService } from './core/services/work-orders.service';
import { TeamsService } from './core/services/teams.service';
import { GlobalSearchService } from './core/services/global-search.service';
import { OperationalMapComponent } from './shared/operational-map/operational-map.component';
import { AdminPanelComponent } from './shared/admin-panel/admin-panel.component';
import { RealtimeChannel } from '@supabase/supabase-js';

@Component({
  selector: 'app-root',
  imports: [FormsModule, ReactiveFormsModule, ButtonDirective, InputText, OperationalMapComponent, AdminPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnDestroy, OnInit {
  title = 'PEX Track';
  readonly auth = inject(AuthService);
  readonly supabase = inject(SupabaseClientService);
  private readonly importService = inject(WorkOrderImportService);
  private readonly workOrders = inject(WorkOrdersService);
  private readonly operationalMap = inject(OperationalMapService);
  private readonly reports = inject(ReportsService);
  private readonly teamsService = inject(TeamsService);
  private readonly globalSearch = inject(GlobalSearchService);
  showLogin = false;
  showImport = false;
  showNewOrder = false;
  showAssignment = false;
  showAdmin = false;
  showOrderTable = true;
  readonly browserOnline = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  submitting = false;
  parsingImport = false;
  savingImport = false;
  savingAssignment = false;
  generatingReport = false;
  loginError = '';
  importError = '';
  assignmentError = '';
  reportMessage = '';
  importResult: WorkOrderImportResult | null = null;
  importDate = new Date().toISOString().slice(0, 10);
  newOrder = { code: '', customerName: '', customerPhone: '', address: '', taskType: 'technical_assistance' as WorkOrderImportRow['taskType'], priority: 3, scheduledFor: new Date().toISOString().slice(0, 10), latitude: null as number | null, longitude: null as number | null };
  activeOrderFilter: 'all' | WorkOrderStatus = 'all';
  assignmentTeamId = '';
  selectedOrder: WorkOrderSummary | null = null;
  readonly orders = signal<WorkOrderSummary[]>([]);
  readonly ordersLoading = signal(false);
  readonly ordersError = signal('');
  readonly mapMarkers = signal<OperationalMapMarker[]>([]);
  readonly mapLoading = signal(false);
  readonly mapError = signal('');
  readonly teams = signal<TeamSummary[]>([]);
  readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] })
  });
  private realtimeChannel: RealtimeChannel | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onlineHandler = () => this.browserOnline.set(true);
  private readonly offlineHandler = () => this.browserOnline.set(false);
  searchTerm = '';
  readonly searchResults = signal<GlobalSearchResult[]>([]);
  readonly searching = signal(false);

  ngOnInit(): void {
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    void this.refreshOperations();
    if (this.auth.session()) this.startRealtime();
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    if (this.realtimeChannel) void this.supabase.client?.removeChannel(this.realtimeChannel);
  }

  userInitials(): string {
    const name = this.auth.profile()?.full_name?.trim() || this.auth.session()?.user.email || 'Usuario';
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  }

  roleLabel(): string {
    const role = this.auth.profile()?.role;
    return role ? { supervisor: 'Supervisor', coordinator: 'Coordinador', technician: 'Técnico' }[role] : 'Sin sesión';
  }

  async submitLogin(): Promise<void> {
    if (this.loginForm.invalid || this.submitting) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.loginError = '';
    const { email, password } = this.loginForm.getRawValue();
    const error = await this.auth.signIn(email, password);
    this.submitting = false;
    if (error) {
      this.loginError = error;
      return;
    }
    this.showLogin = false;
    this.loginForm.reset({ email: '', password: '' });
    this.startRealtime();
    await this.refreshOperations();
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    if (this.realtimeChannel) {
      void this.supabase.client?.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    this.orders.set([]);
    this.ordersError.set('');
    this.mapMarkers.set([]);
    this.mapError.set('');
    this.teams.set([]);
    this.searchTerm = '';
    this.searchResults.set([]);
  }

  scheduleGlobalSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.runGlobalSearch(), 250);
  }

  async runGlobalSearch(): Promise<void> {
    if (!this.auth.session() || this.searchTerm.trim().length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searching.set(true);
    try { this.searchResults.set(await this.globalSearch.search(this.searchTerm)); }
    catch { this.searchResults.set([]); }
    finally { this.searching.set(false); }
  }

  private startRealtime(): void {
    if (!this.supabase.client || this.realtimeChannel || !this.auth.session()) return;
    this.realtimeChannel = this.supabase.client.channel('pex-track-operational-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => void this.refreshOperations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_locations' }, () => void this.loadMapSnapshot())
      .subscribe();
  }

  async refreshOperations(): Promise<void> {
    await Promise.all([this.loadWorkOrders(), this.loadMapSnapshot(), this.loadTeams()]);
  }

  async loadWorkOrders(): Promise<void> {
    if (!this.supabase.isConfigured || !this.auth.session() || this.ordersLoading()) return;
    this.ordersLoading.set(true);
    this.ordersError.set('');
    try {
      this.orders.set(await this.workOrders.listForDay(this.importDate));
    } catch (error) {
      this.ordersError.set(error instanceof Error ? error.message : 'No se pudieron cargar las órdenes de trabajo.');
    } finally {
      this.ordersLoading.set(false);
    }
  }

  async loadMapSnapshot(): Promise<void> {
    if (!this.supabase.isConfigured || !this.auth.session() || this.mapLoading()) return;
    this.mapLoading.set(true);
    this.mapError.set('');
    try {
      this.mapMarkers.set(await this.operationalMap.snapshotForDay(this.importDate));
    } catch (error) {
      this.mapError.set(error instanceof Error ? error.message : 'No se pudo cargar el mapa operativo.');
    } finally {
      this.mapLoading.set(false);
    }
  }

  async loadTeams(): Promise<void> {
    if (!this.supabase.isConfigured || !this.auth.session()) return;
    try {
      this.teams.set(await this.teamsService.listActive());
    } catch {
      this.teams.set([]);
    }
  }

  canManageOperations(): boolean {
    const role = this.auth.profile()?.role;
    return role === 'supervisor' || role === 'coordinator';
  }

  canManageCatalogs(): boolean {
    return this.auth.profile()?.role === 'supervisor';
  }

  openAssignment(order: WorkOrderSummary): void {
    if (!this.canManageOperations()) return;
    this.selectedOrder = order;
    this.assignmentTeamId = order.assigned_team_id ?? '';
    this.assignmentError = '';
    this.showAssignment = true;
  }

  async saveAssignment(): Promise<void> {
    if (!this.selectedOrder || !this.assignmentTeamId || this.savingAssignment) return;
    this.savingAssignment = true;
    this.assignmentError = '';
    try {
      await this.workOrders.assignTeam(this.selectedOrder.id, this.assignmentTeamId);
      this.showAssignment = false;
      this.selectedOrder = null;
      await this.refreshOperations();
    } catch (error) {
      this.assignmentError = error instanceof Error ? error.message : 'No se pudo asignar la cuadrilla.';
    } finally {
      this.savingAssignment = false;
    }
  }

  mapEmptyMessage(): string {
    if (!this.auth.session()) return 'Inicia sesión para consultar el mapa operativo.';
    if (this.mapLoading()) return 'Actualizando ubicaciones y OTs…';
    if (this.mapError()) return this.mapError();
    return 'No hay coordenadas registradas para la fecha operativa.';
  }

  async generateWeeklyReport(format: 'csv' | 'xlsx' | 'pdf' = 'csv'): Promise<void> {
    if (!this.auth.session() || this.generatingReport) {
      this.reportMessage = 'Inicia sesión con un rol operativo para generar el reporte.';
      return;
    }
    this.generatingReport = true;
    this.reportMessage = '';
    const { startDate, endDate } = this.currentWeekRange();
    try {
      const rows = await this.reports.weeklySummary(startDate, endDate);
      if (!rows.length) {
        this.reportMessage = 'No hay OTs registradas en la semana seleccionada.';
        return;
      }
      if (format === 'xlsx') await this.reports.downloadWeeklyXlsx(rows, startDate, endDate);
      else if (format === 'pdf') await this.reports.downloadWeeklyPdf(rows, startDate, endDate);
      else this.reports.downloadWeeklyCsv(rows, startDate, endDate);
      this.reportMessage = `Reporte ${format.toUpperCase()} descargado: ${startDate} a ${endDate}.`;
    } catch (error) {
      this.reportMessage = error instanceof Error ? error.message : 'No se pudo generar el reporte semanal.';
    } finally {
      this.generatingReport = false;
    }
  }

  private currentWeekRange(): { startDate: string; endDate: string } {
    const reference = new Date(`${this.importDate}T12:00:00`);
    const day = reference.getDay();
    reference.setDate(reference.getDate() + (day === 0 ? -6 : 1 - day));
    const startDate = reference.toISOString().slice(0, 10);
    reference.setDate(reference.getDate() + 6);
    return { startDate, endDate: reference.toISOString().slice(0, 10) };
  }

  visibleOrders(): WorkOrderSummary[] {
    const orders = this.orders();
    return this.activeOrderFilter === 'all'
      ? orders
      : orders.filter((order) => order.status === this.activeOrderFilter);
  }

  activeTeamMarkers(): OperationalMapMarker[] {
    return this.mapMarkers().filter((marker) => marker.marker_type === 'team');
  }

  signalLabel(observedAt: string): string {
    if (!observedAt) return 'Sin señal';
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(observedAt).getTime()) / 1000));
    if (elapsedSeconds < 60) return `Hace ${elapsedSeconds} s`;
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    return `Hace ${elapsedMinutes} min`;
  }

  orderCount(status?: WorkOrderStatus): number {
    return status ? this.orders().filter((order) => order.status === status).length : this.orders().length;
  }

  alertCount(): number {
    return this.orders().filter((order) => order.status === 'suspended').length;
  }

  statusLabel(status: WorkOrderStatus | string): string {
    return {
      pending: 'Pendiente',
      en_route: 'En camino',
      in_progress: 'En progreso',
      completed: 'Completada',
      suspended: 'Suspendida'
    }[status as WorkOrderStatus] ?? status;
  }

  taskLabel(order: WorkOrderSummary): string {
    const taskType = {
      technical_assistance: 'Asistencia',
      new_installation: 'Instalación',
      service_transfer: 'Traslado',
      network_maintenance: 'Mantenimiento'
    }[order.task_type];
    const references = [order.zone?.code, order.node?.code, order.box?.code].filter(Boolean).join(' · ');
    return `${taskType} · ${order.address}${order.customer_name ? ` · ${order.customer_name}` : ''}${references ? ` · ${references}` : ''}`;
  }

  async readImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.parsingImport) return;
    this.parsingImport = true;
    this.importError = '';
    this.importResult = null;
    try {
      this.importResult = await this.importService.parse(file, this.importDate);
    } catch (error) {
      this.importError = error instanceof Error ? error.message : 'No se pudo leer el archivo.';
    } finally {
      this.parsingImport = false;
      input.value = '';
    }
  }

  async saveImportedOrders(): Promise<void> {
    if (!this.importResult?.valid.length || this.savingImport) return;
    this.savingImport = true;
    this.importError = '';
    try {
      await this.workOrders.importRows(this.importResult.valid);
      this.showImport = false;
      this.importResult = null;
      await this.refreshOperations();
    } catch (error) {
      this.importError = error instanceof Error ? error.message : 'No se pudieron guardar las OTs.';
    } finally {
      this.savingImport = false;
    }
  }

  async saveNewOrder(): Promise<void> {
    this.importError = '';
    if (!this.newOrder.code.trim() || !this.newOrder.address.trim() || !this.newOrder.scheduledFor) {
      this.importError = 'Código, dirección y fecha programada son obligatorios.';
      return;
    }
    if ((this.newOrder.latitude === null) !== (this.newOrder.longitude === null)) {
      this.importError = 'La latitud y la longitud deben enviarse juntas.';
      return;
    }
    this.savingImport = true;
    try {
      await this.workOrders.createManual(this.newOrder);
      this.showNewOrder = false;
      this.newOrder = { code: '', customerName: '', customerPhone: '', address: '', taskType: 'technical_assistance', priority: 3, scheduledFor: this.importDate, latitude: null, longitude: null };
      await this.refreshOperations();
    } catch (error) {
      this.importError = error instanceof Error ? error.message : 'No se pudo crear la OT.';
    } finally {
      this.savingImport = false;
    }
  }
}
