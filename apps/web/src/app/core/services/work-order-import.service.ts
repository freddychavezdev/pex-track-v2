import { Injectable } from '@angular/core';
import { ImportRowError, WorkOrderImportResult, WorkOrderImportRow, WorkOrderType } from '../models/operations.models';

type RawRow = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class WorkOrderImportService {
  private readonly aliases: Record<string, string[]> = {
    code: ['codigo ot', 'código ot', 'ot', 'nro ot', 'numero ot', 'número ot', 'orden de trabajo'],
    customerCode: ['codigo cliente', 'código cliente', 'cliente codigo', 'cliente código'],
    customerName: ['cliente', 'nombre cliente', 'nombre del cliente'],
    customerPhone: ['telefono', 'teléfono', 'celular', 'telefono cliente', 'teléfono cliente'],
    address: ['direccion', 'dirección', 'direccion cliente', 'dirección cliente', 'domicilio'],
    taskType: ['tipo', 'tipo tarea', 'tipo de tarea', 'actividad', 'servicio'],
    priority: ['prioridad', 'nivel prioridad', 'nivel de prioridad'],
    scheduledFor: ['fecha', 'fecha programada', 'programado para', 'fecha ot'],
    zoneCode: ['zona', 'codigo zona', 'código zona'],
    nodeCode: ['nodo', 'codigo nodo', 'código nodo'],
    boxCode: ['caja', 'codigo caja', 'código caja']
  };

  async parse(file: File, defaultDate: string): Promise<WorkOrderImportResult> {
    this.assertSupportedFile(file);
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error('El archivo no contiene hojas con datos.');

    const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], { defval: '', raw: true });
    if (rows.length === 0) throw new Error('El archivo no contiene filas de órdenes de trabajo.');
    if (rows.length > 1_000) throw new Error('La importación admite hasta 1.000 OTs por archivo.');

    const headers = Object.keys(rows[0] ?? {});
    const valid: WorkOrderImportRow[] = [];
    const invalid: ImportRowError[] = [];

    rows.forEach((rawRow, index) => {
      const sourceRow = index + 2;
      const code = this.valueFor(rawRow, 'code');
      const address = this.valueFor(rawRow, 'address');
      const taskType = this.toTaskType(this.valueFor(rawRow, 'taskType'));
      const errors: string[] = [];

      if (!code) errors.push('Falta el código de OT.');
      if (!address) errors.push('Falta la dirección del cliente.');
      if (!taskType) errors.push('El tipo de tarea no es válido.');
      const priority = this.toPriority(this.valueFor(rawRow, 'priority'), errors);
      const scheduledFor = this.toIsoDate(this.rawValueFor(rawRow, 'scheduledFor'), XLSX) ?? defaultDate;
      if (!scheduledFor) errors.push('Falta la fecha programada.');

      if (errors.length) {
        invalid.push({ sourceRow, code: code || null, errors });
        return;
      }

      valid.push({
        sourceRow,
        code,
        customerCode: this.valueFor(rawRow, 'customerCode') || null,
        customerName: this.valueFor(rawRow, 'customerName') || null,
        customerPhone: this.valueFor(rawRow, 'customerPhone') || null,
        address,
        taskType: taskType!,
        priority,
        scheduledFor,
        zoneCode: this.valueFor(rawRow, 'zoneCode') || null,
        nodeCode: this.valueFor(rawRow, 'nodeCode') || null,
        boxCode: this.valueFor(rawRow, 'boxCode') || null
      });
    });

    const duplicateCodes = new Set<string>();
    const seenCodes = new Set<string>();
    valid.forEach((row) => seenCodes.has(row.code.toLocaleLowerCase()) ? duplicateCodes.add(row.code.toLocaleLowerCase()) : seenCodes.add(row.code.toLocaleLowerCase()));
    const deduplicated = valid.filter((row) => {
      if (!duplicateCodes.has(row.code.toLocaleLowerCase())) return true;
      invalid.push({ sourceRow: row.sourceRow, code: row.code, errors: ['El código de OT está duplicado en el archivo.'] });
      return false;
    });

    return { valid: deduplicated, invalid, headers };
  }

  private assertSupportedFile(file: File): void {
    const extension = file.name.split('.').pop()?.toLocaleLowerCase();
    if (!extension || !['xlsx', 'xls', 'csv'].includes(extension)) {
      throw new Error('Selecciona un archivo CSV, XLS o XLSX.');
    }
    if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera el límite de 10 MB.');
  }

  private valueFor(row: RawRow, field: string): string {
    const raw = this.rawValueFor(row, field);
    return raw === undefined || raw === null ? '' : String(raw).trim();
  }

  private rawValueFor(row: RawRow, field: string): unknown {
    const candidateHeaders = this.aliases[field] ?? [];
    const header = Object.keys(row).find((current) => candidateHeaders.includes(this.normalize(current)));
    return header ? row[header] : undefined;
  }

  private toTaskType(value: string): WorkOrderType | null {
    const normalized = this.normalize(value);
    if (['asistencia', 'asistencia tecnica', 'asistencia técnica', 'soporte tecnico', 'soporte técnico'].includes(normalized)) return 'technical_assistance';
    if (['instalacion', 'instalación', 'instalacion nueva', 'instalación nueva'].includes(normalized)) return 'new_installation';
    if (['traslado', 'traslado de servicio'].includes(normalized)) return 'service_transfer';
    if (['mantenimiento', 'mantenimiento de red', 'preventivo', 'correctivo'].includes(normalized)) return 'network_maintenance';
    return null;
  }

  private toPriority(value: string, errors: string[]): number {
    if (!value) return 3;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      errors.push('La prioridad debe ser un entero entre 1 y 5.');
      return 3;
    }
    return parsed;
  }

  private toIsoDate(value: unknown, xlsx: typeof import('xlsx')): string | null {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
    if (typeof value === 'number') {
      const parsed = xlsx.SSF.parse_date_code(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    const text = String(value).trim();
    const bolivianDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (bolivianDate) {
      const year = bolivianDate[3].length === 2 ? `20${bolivianDate[3]}` : bolivianDate[3];
      const date = new Date(`${year}-${bolivianDate[2].padStart(2, '0')}-${bolivianDate[1].padStart(2, '0')}T00:00:00`);
      return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
    }
    const date = new Date(text);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  }
}
