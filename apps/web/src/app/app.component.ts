import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { AuthService } from './core/services/auth.service';
import { OperationalMapMarker, WorkOrderImportResult, WorkOrderStatus, WorkOrderSummary } from './core/models/operations.models';
import { OperationalMapService } from './core/services/operational-map.service';
import { SupabaseClientService } from './core/services/supabase-client.service';
import { WorkOrderImportService } from './core/services/work-order-import.service';
import { WorkOrdersService } from './core/services/work-orders.service';
import { OperationalMapComponent } from './shared/operational-map/operational-map.component';

@Component({
  selector: 'app-root',
  imports: [FormsModule, ReactiveFormsModule, ButtonDirective, InputText, OperationalMapComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'PEX Track';
  readonly auth = inject(AuthService);
  readonly supabase = inject(SupabaseClientService);
  private readonly importService = inject(WorkOrderImportService);
  private readonly workOrders = inject(WorkOrdersService);
  private readonly operationalMap = inject(OperationalMapService);
  showLogin = false;
  showImport = false;
  submitting = false;
  parsingImport = false;
  savingImport = false;
  loginError = '';
  importError = '';
  importResult: WorkOrderImportResult | null = null;
  importDate = new Date().toISOString().slice(0, 10);
  activeOrderFilter: 'all' | WorkOrderStatus = 'all';
  readonly orders = signal<WorkOrderSummary[]>([]);
  readonly ordersLoading = signal(false);
  readonly ordersError = signal('');
  readonly mapMarkers = signal<OperationalMapMarker[]>([]);
  readonly mapLoading = signal(false);
  readonly mapError = signal('');
  readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] })
  });

  ngOnInit(): void {
    void this.refreshOperations();
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
    await this.refreshOperations();
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    this.orders.set([]);
    this.ordersError.set('');
    this.mapMarkers.set([]);
    this.mapError.set('');
  }

  async refreshOperations(): Promise<void> {
    await Promise.all([this.loadWorkOrders(), this.loadMapSnapshot()]);
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

  mapEmptyMessage(): string {
    if (!this.auth.session()) return 'Inicia sesión para consultar el mapa operativo.';
    if (this.mapLoading()) return 'Actualizando ubicaciones y OTs…';
    if (this.mapError()) return this.mapError();
    return 'No hay coordenadas registradas para la fecha operativa.';
  }

  visibleOrders(): WorkOrderSummary[] {
    const orders = this.orders();
    return this.activeOrderFilter === 'all'
      ? orders
      : orders.filter((order) => order.status === this.activeOrderFilter);
  }

  orderCount(status?: WorkOrderStatus): number {
    return status ? this.orders().filter((order) => order.status === status).length : this.orders().length;
  }

  statusLabel(status: WorkOrderStatus): string {
    return {
      pending: 'Pendiente',
      en_route: 'En camino',
      in_progress: 'En progreso',
      completed: 'Completada',
      suspended: 'Suspendida'
    }[status];
  }

  taskLabel(order: WorkOrderSummary): string {
    const taskType = {
      technical_assistance: 'Asistencia',
      new_installation: 'Instalación',
      service_transfer: 'Traslado',
      network_maintenance: 'Mantenimiento'
    }[order.task_type];
    return `${taskType} · ${order.address}${order.customer_name ? ` · ${order.customer_name}` : ''}`;
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
}
