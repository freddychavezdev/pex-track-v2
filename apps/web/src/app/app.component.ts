import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { FocusTrapModule } from 'primeng/focustrap';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { AuthService } from './core/services/auth.service';
import { DistributionBoxOption, GlobalSearchResult, NetworkNodeOption, OperationalMapMarker, SuggestedRouteStop, TeamSummary, WorkOrderHistoryRecord, WorkOrderImportResult, WorkOrderImportRow, WorkOrderStatus, WorkOrderSummary } from './core/models/operations.models';
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

interface EmergencyTeamSuggestion {
  team: TeamSummary;
  distanceKm: number | null;
  etaMinutes: number | null;
  pendingOrders: number;
  signalStatus: 'available' | 'active' | 'no_signal';
}

@Component({
  selector: 'app-root',
  imports: [DatePipe, DecimalPipe, FormsModule, ReactiveFormsModule, ButtonDirective, InputText, FocusTrapModule, SelectModule, DatePickerModule, InputNumberModule, CheckboxModule, OperationalMapComponent, AdminPanelComponent],
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
  showPasswordResetRequest = false;
  showImport = false;
  showNewOrder = false;
  showAssignment = false;
  showAdmin = false;
  showOrdersView = false;
  showReportsView = false;
  showOrderTable = true;
  showHistory = false;
  showRouteSuggestion = false;
  mapExpanded = false;
  mobileMenuOpen = false;
  sidebarCollapsed = false;
  isDarkMode = false;
  adminInitialTab: 'users' | 'technicians' | 'vehicles' | 'teams' | 'audit' = 'users';
  savingRoute = false;
  routeError = '';
  routeMessage = '';
  historyLoading = false;
  historyError = '';
  selectedHistoryOrder: WorkOrderSummary | null = null;
  selectedRouteTeam: OperationalMapMarker | null = null;
  readonly orderHistory = signal<WorkOrderHistoryRecord[]>([]);
  readonly suggestedRoute = signal<SuggestedRouteStop[]>([]);
  readonly browserOnline = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  submitting = false;
  resetRequestSubmitting = false;
  passwordRecoverySubmitting = false;
  parsingImport = false;
  importDragActive = false;
  savingImport = false;
  savingAssignment = false;
  generatingReport = false;
  loginError = '';
  resetRequestMessage = '';
  resetRequestError = '';
  passwordRecoveryError = '';
  importError = '';
  importSuccess = '';
  assignmentError = '';
  reportMessage = '';
  importResult: WorkOrderImportResult | null = null;
  importDate = new Date().toISOString().slice(0, 10);
  newOrderDate: Date | null = new Date();
  readonly taskTypeOptions = [
    { label: 'Asistencia técnica', value: 'technical_assistance' },
    { label: 'Instalación nueva', value: 'new_installation' },
    { label: 'Traslado de servicio', value: 'service_transfer' },
    { label: 'Mantenimiento de red', value: 'network_maintenance' }
  ];
  readonly priorityOptions = [
    { label: '1 · Urgente', value: 1 }, { label: '2 · Alta', value: 2 }, { label: '3 · Normal', value: 3 },
    { label: '4 · Baja', value: 4 }, { label: '5 · Programada', value: 5 }
  ];
  newOrder = { code: '', customerName: '', customerPhone: '', address: '', taskType: 'technical_assistance' as WorkOrderImportRow['taskType'], priority: 3, isEmergency: false, scheduledFor: new Date().toISOString().slice(0, 10), latitude: null as number | null, longitude: null as number | null, nodeId: '', boxId: '' };
  readonly networkNodes = signal<NetworkNodeOption[]>([]);
  readonly distributionBoxes = signal<DistributionBoxOption[]>([]);
  activeOrderFilter: 'all' | WorkOrderStatus = 'all';
  assignmentTeamId = '';
  selectedOrder: WorkOrderSummary | null = null;
  readonly emergencySuggestions = signal<EmergencyTeamSuggestion[]>([]);
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
  readonly passwordResetRequestForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] })
  });
  readonly passwordRecoveryForm = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirmation: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });
  private realtimeChannel: RealtimeChannel | null = null;
  private mapRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onlineHandler = () => this.browserOnline.set(true);
  private readonly offlineHandler = () => this.browserOnline.set(false);
  searchTerm = '';
  readonly searchResults = signal<GlobalSearchResult[]>([]);
  readonly searching = signal(false);

  ngOnInit(): void {
    this.isDarkMode = localStorage.getItem('pex-track-theme') === 'dark';
    this.applyTheme();
    if (!this.auth.session()) this.showLogin = true;
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    void this.refreshOperations();
    if (this.auth.session()) this.startRealtime();
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    this.stopMapPolling();
    if (this.realtimeChannel) void this.supabase.client?.removeChannel(this.realtimeChannel);
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('pex-track-theme', this.isDarkMode ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme(): void {
    document.documentElement.classList.toggle('app-dark', this.isDarkMode);
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
      if (!this.submitting) {
        this.loginError = 'Ingresa tu correo y la contraseña que acabas de crear.';
      }
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
    this.stopMapPolling();
    this.orders.set([]);
    this.ordersError.set('');
    this.mapMarkers.set([]);
    this.mapError.set('');
    this.teams.set([]);
    this.searchTerm = '';
    this.searchResults.set([]);
    this.mapExpanded = false;
    this.showLogin = true;
  }

  openTeamManagement(): void {
    // La entrada "Cuadrillas" abre el catálogo administrativo desde su
    // primera pestaña para que el supervisor pueda revisar usuarios antes de
    // vincular técnicos y vehículos.
    this.adminInitialTab = 'users';
    this.showAdmin = true;
  }

  openOrdersView(): void { this.showOrdersView = true; this.mobileMenuOpen = false; }
  openReportsView(): void { this.showReportsView = true; this.mobileMenuOpen = false; }

  openPasswordResetRequest(): void {
    this.showLogin = false;
    this.showPasswordResetRequest = true;
    this.resetRequestMessage = '';
    this.resetRequestError = '';
  }

  async submitPasswordResetRequest(): Promise<void> {
    if (this.passwordResetRequestForm.invalid || this.resetRequestSubmitting) {
      this.passwordResetRequestForm.markAllAsTouched();
      return;
    }
    this.resetRequestSubmitting = true;
    this.resetRequestMessage = '';
    this.resetRequestError = '';
    const error = await this.auth.requestPasswordReset(this.passwordResetRequestForm.getRawValue().email);
    this.resetRequestSubmitting = false;
    if (error) {
      this.resetRequestError = error;
      return;
    }
    this.resetRequestMessage = 'Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.';
  }

  async submitRecoveredPassword(): Promise<void> {
    if (this.passwordRecoveryForm.invalid || this.passwordRecoverySubmitting) {
      this.passwordRecoveryForm.markAllAsTouched();
      return;
    }
    const { password, confirmation } = this.passwordRecoveryForm.getRawValue();
    if (password !== confirmation) {
      this.passwordRecoveryError = 'Las contraseñas no coinciden.';
      return;
    }
    const recoveredEmail = this.auth.session()?.user.email ?? '';
    this.passwordRecoverySubmitting = true;
    this.passwordRecoveryError = '';
    const error = await this.auth.updateRecoveredPassword(password);
    this.passwordRecoverySubmitting = false;
    if (error) {
      this.passwordRecoveryError = error;
      return;
    }
    this.passwordRecoveryForm.reset({ password: '', confirmation: '' });
    this.loginForm.reset({ email: recoveredEmail, password: '' });
    this.loginError = 'Contraseña actualizada. Escribe tu nueva contraseña para ingresar.';
    this.showLogin = true;
  }

  scheduleGlobalSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.runGlobalSearch(), 250);
  }

  clearGlobalSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTerm = '';
    this.searchResults.set([]);
    this.searching.set(false);
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
    this.startMapPolling();
    this.realtimeChannel = this.supabase.client.channel('pex-track-operational-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => void this.refreshOperations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_locations' }, () => void this.loadMapSnapshot())
      .subscribe();
  }

  private startMapPolling(): void {
    if (this.mapRefreshTimer) return;
    this.mapRefreshTimer = setInterval(() => {
      if (this.auth.session() && !document.hidden) void this.loadMapSnapshot();
    }, 15_000);
  }

  private stopMapPolling(): void {
    if (!this.mapRefreshTimer) return;
    clearInterval(this.mapRefreshTimer);
    this.mapRefreshTimer = null;
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
    this.emergencySuggestions.set(this.suggestEmergencyTeams(order));
    this.showAssignment = true;
  }

  selectEmergencyTeam(teamId: string): void {
    this.assignmentTeamId = teamId;
  }

  async openNewOrder(): Promise<void> {
    if (!this.canManageOperations()) return;
    this.importError = '';
    this.importSuccess = '';
    try {
      const references = await this.workOrders.listNetworkReferenceOptions();
      this.networkNodes.set(references.nodes);
      this.distributionBoxes.set(references.boxes);
      this.newOrderDate = new Date(`${this.newOrder.scheduledFor}T12:00:00`);
      this.showNewOrder = true;
      this.mobileMenuOpen = false;
    } catch (error) {
      this.importError = error instanceof Error ? error.message : 'No se pudieron cargar los nodos y cajas.';
      this.showNewOrder = true;
    }
  }

  availableBoxesForNewOrder(): DistributionBoxOption[] {
    return this.distributionBoxes().filter((box) => !this.newOrder.nodeId || box.node_id === this.newOrder.nodeId);
  }

  selectNewOrderNode(): void {
    const box = this.distributionBoxes().find((item) => item.id === this.newOrder.boxId);
    if (box && this.newOrder.nodeId && box.node_id !== this.newOrder.nodeId) this.newOrder.boxId = '';
  }

  updateNewOrderDate(date: Date | null): void {
    this.newOrderDate = date;
    if (date) this.newOrder.scheduledFor = date.toISOString().slice(0, 10);
  }

  async openHistory(order: WorkOrderSummary): Promise<void> {
    if (!this.auth.session()) return;
    this.selectedHistoryOrder = order;
    this.showHistory = true;
    this.historyLoading = true;
    this.historyError = '';
    this.orderHistory.set([]);
    try {
      this.orderHistory.set(await this.workOrders.historyForOrder(order.id));
    } catch (error) {
      this.historyError = error instanceof Error ? error.message : 'No se pudo cargar el historial de la OT.';
    } finally {
      this.historyLoading = false;
    }
  }

  closeHistory(): void {
    this.showHistory = false;
    this.selectedHistoryOrder = null;
    this.orderHistory.set([]);
  }

  openSuggestedRoute(team: OperationalMapMarker): void {
    this.selectedRouteTeam = team;
    this.showRouteSuggestion = true;
    this.routeError = '';
    this.routeMessage = '';
    const coordinates = new Map(this.mapMarkers().filter((marker) => marker.marker_type === 'work_order').map((marker) => [marker.marker_id, marker]));
    const remaining = this.orders().filter((order) =>
      order.assigned_team_id === team.marker_id && !['completed', 'suspended'].includes(order.status)
    );
    const route: SuggestedRouteStop[] = [];
    let current = team;
    while (remaining.length) {
      let nearestIndex = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      remaining.forEach((order, index) => {
        const marker = coordinates.get(order.id);
        if (!marker) return;
        const distance = this.distanceKm(current.latitude, current.longitude, marker.latitude, marker.longitude);
        if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
      });
      if (nearestIndex < 0) {
        remaining.forEach((order) => route.push({ order, distanceFromPreviousKm: null }));
        break;
      }
      const [order] = remaining.splice(nearestIndex, 1);
      const marker = coordinates.get(order.id)!;
      route.push({ order, distanceFromPreviousKm: nearestDistance });
      current = marker;
    }
    this.suggestedRoute.set(route);
  }

  closeSuggestedRoute(): void {
    this.showRouteSuggestion = false;
    this.selectedRouteTeam = null;
    this.suggestedRoute.set([]);
    this.routeError = '';
    this.routeMessage = '';
  }

  moveSuggestedRoute(index: number, direction: -1 | 1): void {
    const target = index + direction;
    const currentRoute = this.suggestedRoute();
    const team = this.selectedRouteTeam;
    if (!team || target < 0 || target >= currentRoute.length) return;

    const reordered = currentRoute.map((stop) => stop.order);
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    this.suggestedRoute.set(this.routeWithDistances(reordered, team));
    this.routeMessage = '';
  }

  async approveSuggestedRoute(): Promise<void> {
    const team = this.selectedRouteTeam;
    const route = this.suggestedRoute();
    if (!team || !route.length || this.savingRoute) return;

    this.savingRoute = true;
    this.routeError = '';
    this.routeMessage = '';
    try {
      await this.workOrders.saveTeamRoute(team.marker_id, this.importDate, route.map((stop) => stop.order.id));
      this.routeMessage = 'Ruta aprobada y enviada a la aplicación móvil de la cuadrilla.';
      await this.refreshOperations();
    } catch (error) {
      this.routeError = error instanceof Error ? error.message : 'No se pudo aprobar la ruta.';
    } finally {
      this.savingRoute = false;
    }
  }

  private routeWithDistances(orders: WorkOrderSummary[], team: OperationalMapMarker): SuggestedRouteStop[] {
    const coordinates = new Map(this.mapMarkers().filter((marker) => marker.marker_type === 'work_order').map((marker) => [marker.marker_id, marker]));
    let current: OperationalMapMarker = team;
    return orders.map((order) => {
      const marker = coordinates.get(order.id);
      if (!marker) return { order, distanceFromPreviousKm: null };
      const distanceFromPreviousKm = this.distanceKm(current.latitude, current.longitude, marker.latitude, marker.longitude);
      current = marker;
      return { order, distanceFromPreviousKm };
    });
  }

  private suggestEmergencyTeams(order: WorkOrderSummary): EmergencyTeamSuggestion[] {
    const markers = new Map(this.mapMarkers().map((marker) => [marker.marker_id, marker]));
    const emergencyMarker = markers.get(order.id)
      ?? (order.box ? this.mapMarkers().find((marker) => marker.marker_type === 'distribution_box' && marker.code === order.box?.code) : undefined)
      ?? (order.node ? this.mapMarkers().find((marker) => marker.marker_type === 'network_node' && marker.code === order.node?.code) : undefined);
    return this.teams().map((team) => {
      const teamMarker = markers.get(team.id);
      const hasSignal = teamMarker?.marker_type === 'team';
      const distanceKm = hasSignal && emergencyMarker
        ? this.distanceKm(teamMarker.latitude, teamMarker.longitude, emergencyMarker.latitude, emergencyMarker.longitude)
        : null;
      const pendingOrders = this.orders().filter((candidate) =>
        candidate.assigned_team_id === team.id && ['pending', 'en_route', 'in_progress'].includes(candidate.status)
      ).length;
      const signalStatus: EmergencyTeamSuggestion['signalStatus'] = !hasSignal ? 'no_signal' : pendingOrders ? 'active' : 'available';
      return {
        team,
        distanceKm,
        etaMinutes: distanceKm === null ? null : Math.ceil(distanceKm / 25 * 60),
        pendingOrders,
        signalStatus
      };
    }).sort((first, second) => {
      const firstDistance = first.distanceKm ?? Number.POSITIVE_INFINITY;
      const secondDistance = second.distanceKm ?? Number.POSITIVE_INFINITY;
      return firstDistance - secondDistance || first.pendingOrders - second.pendingOrders || first.team.code.localeCompare(second.team.code);
    });
  }

  private distanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number): number {
    const radians = (value: number) => value * Math.PI / 180;
    const deltaLatitude = radians(latitudeB - latitudeA);
    const deltaLongitude = radians(longitudeB - longitudeA);
    const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
      const [rows, dictations] = await Promise.all([
        this.reports.weeklySummary(startDate, endDate),
        this.reports.weeklyDictations(startDate, endDate)
      ]);
      if (!rows.length) {
        this.reportMessage = 'No hay OTs registradas en la semana seleccionada.';
        return;
      }
      if (format === 'xlsx') await this.reports.downloadWeeklyXlsx(rows, dictations, startDate, endDate);
      else if (format === 'pdf') await this.reports.downloadWeeklyPdf(rows, dictations, startDate, endDate);
      else this.reports.downloadWeeklyCsv(rows, dictations, startDate, endDate);
      this.reportMessage = `Reporte ${format.toUpperCase()} descargado: ${startDate} a ${endDate}. Incluye ${dictations.length} dictado(s) u observación(es) guardado(s).`;
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

  teamRows(): OperationalMapMarker[] {
    const markersByTeamId = new Map(this.activeTeamMarkers().map((marker) => [marker.marker_id, marker]));
    return this.teams().map((team) => markersByTeamId.get(team.id) ?? {
      marker_type: 'team', marker_id: team.id, code: team.code, label: `Cuadrilla ${team.code}`,
      latitude: Number.NaN, longitude: Number.NaN, status: 'unknown', observed_at: ''
    });
  }

  teamDeviationKm(team: OperationalMapMarker): number | null {
    if (team.status !== 'in_progress') return null;
    const assignedOrderIds = new Set(this.orders()
      .filter((order) => order.assigned_team_id === team.marker_id && order.status === 'in_progress')
      .map((order) => order.id));
    const assignedMarkers = this.mapMarkers().filter((marker) =>
      marker.marker_type === 'work_order' && assignedOrderIds.has(marker.marker_id));
    if (!assignedMarkers.length) return null;
    const distance = Math.min(...assignedMarkers.map((order) =>
      this.distanceKm(team.latitude, team.longitude, order.latitude, order.longitude)));
    return distance > 0.75 ? distance : null;
  }

  signalLabel(observedAt: string): string {
    if (!observedAt) return 'Sin señal';
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(observedAt).getTime()) / 1000));
    if (elapsedSeconds < 60) return `Hace ${elapsedSeconds} s`;
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    return elapsedMinutes >= 1 ? `Hace ${elapsedMinutes} min` : 'Sin señal';
  }

  orderCount(status?: WorkOrderStatus): number {
    return status ? this.orders().filter((order) => order.status === status).length : this.orders().length;
  }

  alertCount(): number {
    const suspendedOrders = this.orders().filter((order) => order.status === 'suspended').length;
    return suspendedOrders + this.teamRows().filter((team) =>
      this.isStale(team.observed_at) || this.teamDeviationKm(team) !== null).length;
  }

  isStale(observedAt: string): boolean {
    // La APK emite cada 15 s. Un minuto sin nuevos puntos indica que el
    // seguimiento se detuvo o que el teléfono perdió la conexión.
    return !observedAt || Date.now() - new Date(observedAt).getTime() > 60 * 1000;
  }

  teamStatusLabel(team: OperationalMapMarker): string {
    if (this.isStale(team.observed_at)) return team.observed_at ? 'Seguimiento detenido' : 'Sin seguimiento';
    return team.status === 'available' ? 'Seguimiento activo' : this.statusLabel(team.status);
  }

  statusLabel(status: WorkOrderStatus | string): string {
    return {
      pending: 'Pendiente',
      en_route: 'En camino',
      in_progress: 'En progreso',
      completed: 'Completada',
      suspended: 'Suspendida',
      available: 'Disponible',
      active: 'Activo',
      unknown: 'Sin seguimiento',
      no_signal: 'Sin señal'
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
    return `${order.is_emergency ? 'EMERGENCIA · ' : ''}${taskType} · ${order.address}${order.customer_name ? ` · ${order.customer_name}` : ''}${references ? ` · ${references}` : ''}`;
  }

  async readImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await this.processImportFile(file);
    input.value = '';
  }

  onImportDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.importDragActive = true;
  }

  onImportDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.parsingImport) this.importDragActive = true;
  }

  onImportDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.importDragActive = false;
  }

  onImportDrop(event: DragEvent): void {
    event.preventDefault();
    this.importDragActive = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.processImportFile(file);
  }

  private async processImportFile(file: File): Promise<void> {
    if (this.parsingImport) return;
    this.parsingImport = true;
    this.importError = '';
    this.importResult = null;
    try {
      this.importResult = await this.importService.parse(file, this.importDate);
    } catch (error) {
      this.importError = error instanceof Error ? error.message : 'No se pudo leer el archivo.';
    } finally {
      this.parsingImport = false;
    }
  }

  async saveImportedOrders(): Promise<void> {
    if (!this.importResult?.valid.length || this.savingImport) return;
    this.savingImport = true;
    this.importError = '';
    this.importSuccess = '';
    try {
      const result = await this.workOrders.importRows(this.importResult.valid);
      this.importResult = null;
      await this.refreshOperations();
      this.showImport = false;
      this.showOrderTable = true;
      this.importSuccess = result.locationWarningCount
        ? `Se guardaron ${result.savedCount} OT(s). ${result.locationWarningCount} ubicación(es) no se pudieron registrar; las OTs sí fueron guardadas.`
        : `Se guardaron ${result.savedCount} OT(s) correctamente. La tabla se actualizó.`;
    } catch (error) {
      this.importError = `No se guardó ninguna OT. ${this.errorMessage(error, 'Revisa las referencias de nodo/caja y tus permisos de supervisor o coordinador.')}`;
    } finally {
      this.savingImport = false;
    }
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
    return fallback;
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
      this.newOrder = { code: '', customerName: '', customerPhone: '', address: '', taskType: 'technical_assistance', priority: 3, isEmergency: false, scheduledFor: this.importDate, latitude: null, longitude: null, nodeId: '', boxId: '' };
      this.newOrderDate = new Date(`${this.importDate}T12:00:00`);
      await this.refreshOperations();
    } catch (error) {
      this.importError = error instanceof Error ? error.message : 'No se pudo crear la OT.';
    } finally {
      this.savingImport = false;
    }
  }
}
