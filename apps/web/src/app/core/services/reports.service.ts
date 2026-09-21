import { Injectable } from '@angular/core';
import { WeeklyReportRow } from '../models/operations.models';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async weeklySummary(startDate: string, endDate: string): Promise<WeeklyReportRow[]> {
    const { data, error } = await this.supabase.requireClient()
      .rpc('weekly_report_summary', { p_start_day: startDate, p_end_day: endDate });
    if (error) throw error;
    return (data ?? []) as WeeklyReportRow[];
  }

  downloadWeeklyCsv(rows: WeeklyReportRow[], startDate: string, endDate: string): void {
    const headings = ['Cuadrilla', 'Total OTs', 'Completadas', 'En ejecución', 'Pendientes', 'Suspendidas', 'Cumplimiento (%)'];
    const values = rows.map((row) => [
      row.team_code,
      row.total_orders,
      row.completed_orders,
      row.active_orders,
      row.pending_orders,
      row.suspended_orders,
      row.completion_rate
    ]);
    const csv = [headings, ...values].map((line) => line.map((value) => this.escapeCsv(value)).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pex-track-reporte-semanal-${startDate}-${endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private escapeCsv(value: string | number): string {
    return `"${String(value).replace(/"/g, '""')}"`;
  }
}
