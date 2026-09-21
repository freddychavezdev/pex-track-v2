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

  async downloadWeeklyXlsx(rows: WeeklyReportRow[], startDate: string, endDate: string): Promise<void> {
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
      Cuadrilla: row.team_code,
      'Total OTs': row.total_orders,
      Completadas: row.completed_orders,
      'En ejecución': row.active_orders,
      Pendientes: row.pending_orders,
      Suspendidas: row.suspended_orders,
      'Cumplimiento (%)': row.completion_rate
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte semanal');
    XLSX.writeFile(workbook, `pex-track-reporte-semanal-${startDate}-${endDate}.xlsx`);
  }

  async downloadWeeklyPdf(rows: WeeklyReportRow[], startDate: string, endDate: string): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const columns = ['Cuadrilla', 'Total', 'Completadas', 'En ejecución', 'Pendientes', 'Suspendidas', 'Cumplimiento'];
    const widths = [44, 25, 32, 32, 30, 30, 40];
    const left = 15;
    let y = 18;
    document.setFontSize(16);
    document.text('PEX Track - Reporte semanal', left, y);
    document.setFontSize(9);
    document.text(`Periodo: ${startDate} a ${endDate}`, left, y + 7);
    y += 17;
    document.setFillColor(234, 242, 255);
    document.rect(left, y - 5, widths.reduce((sum, width) => sum + width, 0), 8, 'F');
    document.setFontSize(8);
    let x = left;
    columns.forEach((column, index) => { document.text(column, x + 2, y); x += widths[index]; });
    y += 9;
    rows.forEach((row) => {
      if (y > 190) { document.addPage(); y = 18; }
      const values = [row.team_code, String(row.total_orders), String(row.completed_orders), String(row.active_orders), String(row.pending_orders), String(row.suspended_orders), `${row.completion_rate}%`];
      x = left;
      values.forEach((value, index) => { document.text(value, x + 2, y); x += widths[index]; });
      document.setDrawColor(225, 231, 239);
      document.line(left, y + 3, left + widths.reduce((sum, width) => sum + width, 0), y + 3);
      y += 8;
    });
    document.save(`pex-track-reporte-semanal-${startDate}-${endDate}.pdf`);
  }

  private escapeCsv(value: string | number): string {
    return `"${String(value).replace(/"/g, '""')}"`;
  }
}
