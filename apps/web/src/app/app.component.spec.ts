import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { AppComponent } from './app.component';
import { WorkOrderSummary } from './core/models/operations.models';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideNoopAnimations(), providePrimeNG({ theme: { preset: Aura } })]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'PEX Track' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('PEX Track');
  });

  it('should render the monitoring center', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Centro de monitoreo');
  });

  it('should mark a team signal as stale after ten minutes', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;

    expect(app.isStale(new Date(Date.now() - 10 * 60 * 1000 - 1).toISOString())).toBeTrue();
    expect(app.isStale(new Date(Date.now() - 2 * 60 * 1000).toISOString())).toBeFalse();
  });

  it('should label emergency work orders explicitly', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    const order: WorkOrderSummary = {
      id: 'order-1',
      code: 'OT-001',
      customer_name: null,
      address: 'Av. Principal 123',
      task_type: 'technical_assistance',
      status: 'pending',
      priority: 1,
      is_emergency: true,
      scheduled_for: '2026-09-21',
      assigned_team_id: null
    };

    expect(app.taskLabel(order)).toContain('EMERGENCIA · Asistencia');
  });

  it('should flag an in-progress team far from its assigned work order', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    const order: WorkOrderSummary = {
      id: 'order-1', code: 'OT-001', customer_name: null, address: 'Av. Principal 123',
      task_type: 'technical_assistance', status: 'in_progress', priority: 2,
      is_emergency: false, scheduled_for: '2026-09-22', assigned_team_id: 'team-1'
    };
    const team = {
      marker_type: 'team' as const, marker_id: 'team-1', code: 'CUADRILLA-01',
      label: 'Cuadrilla 01', latitude: -16.5, longitude: -68.15,
      status: 'in_progress', observed_at: '2026-09-22T00:00:00Z'
    };
    app.orders.set([order]);
    app.mapMarkers.set([
      team,
      { marker_type: 'work_order', marker_id: 'order-1', code: 'OT-001', label: 'Av. Principal 123', latitude: -16.51, longitude: -68.15, status: 'in_progress', observed_at: '2026-09-22T00:00:00Z' }
    ]);

    expect(app.teamDeviationKm(team)).toBeGreaterThan(0.75);
  });
});
