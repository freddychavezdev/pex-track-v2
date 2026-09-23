import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = 'D:/UNI/6to_Semestre/01_Ingenieria_Software/Proyecto_PT/outputs/ot-import-pilot';
const outputPath = `${outputDir}/ot-simuladas-pex-track-sin-referencias.xlsx`;

const headers = [
  'Código OT', 'Código cliente', 'Cliente', 'Teléfono', 'Dirección', 'Tipo',
  'Prioridad', 'Fecha programada', 'Zona', 'Nodo', 'Caja', 'Latitud', 'Longitud'
];

const orders = [
  ['SIM-OT-001', 'CLI-1001', 'Ana Quispe', '76543210', 'Av. 6 de Marzo, zona 16 de Julio, El Alto', 'Asistencia técnica', 2, '2026-09-22', '', '', '', -16.50848, -68.16354],
  ['SIM-OT-002', 'CLI-1002', 'Carlos Mamani', '71234567', 'Calle 3, Villa Adela, El Alto', 'Instalación nueva', 3, '2026-09-22', '', '', '', -16.53574, -68.19235],
  ['SIM-OT-003', 'CLI-1003', 'María Choque', '69876543', 'Av. Juan Pablo II, Ciudad Satélite, El Alto', 'Mantenimiento de red', 1, '2026-09-22', '', '', '', -16.52017, -68.18281],
  ['SIM-OT-004', 'CLI-1004', 'Jorge Huanca', '77788990', 'Calle Bolívar, Villa Dolores, El Alto', 'Traslado de servicio', 4, '2026-09-22', '', '', '', -16.49656, -68.18076],
  ['SIM-OT-005', 'CLI-1005', 'Lucía Flores', '72001122', 'Av. Tiahuanaco, zona Villa Bolívar A, El Alto', 'Asistencia técnica', 2, '2026-09-22', '', '', '', -16.50431, -68.19493],
  ['SIM-OT-006', 'CLI-1006', 'Pedro Apaza', '73445566', 'Av. Mariscal Santa Cruz, Centro, La Paz', 'Instalación nueva', 3, '2026-09-22', '', '', '', -16.49502, -68.13545],
  ['SIM-OT-007', 'CLI-1007', 'Sofía Vargas', '70112233', 'Calle Bueno, Sopocachi, La Paz', 'Asistencia técnica', 2, '2026-09-22', '', '', '', -16.51034, -68.12694],
  ['SIM-OT-008', 'CLI-1008', 'Diego Condori', '75566778', 'Av. del Poeta, Obrajes, La Paz', 'Mantenimiento de red', 1, '2026-09-22', '', '', '', -16.52678, -68.10361],
  ['SIM-OT-009', 'CLI-1009', 'Elena Fernández', '78990011', 'Av. Ballivián, Calacoto, La Paz', 'Traslado de servicio', 4, '2026-09-22', '', '', '', -16.54068, -68.08533],
  ['SIM-OT-010', 'CLI-1010', 'Roberto Ticona', '76655443', 'Av. Montenegro, San Miguel, La Paz', 'Instalación nueva', 3, '2026-09-22', '', '', '', -16.53917, -68.07796]
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add('OTs para importar');
sheet.showGridLines = false;
sheet.getRange('A1:M11').values = [headers, ...orders];
sheet.getRange('A1:M1').format = {
  fill: '#1D5DBA',
  font: { name: 'Arial', bold: true, color: '#FFFFFF', size: 10 },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
  wrapText: true,
  borders: { preset: 'all', style: 'thin', color: '#FFFFFF' }
};
sheet.getRange('A2:M11').format = {
  font: { name: 'Arial', size: 10, color: '#17253A' },
  verticalAlignment: 'center',
  borders: { preset: 'inside', style: 'thin', color: '#DCE5F0' }
};
sheet.getRange('A2:A11').format.font = { name: 'Arial', bold: true, color: '#1D5DBA', size: 10 };
sheet.getRange('G2:G11').format.horizontalAlignment = 'center';
sheet.getRange('H2:H11').format.horizontalAlignment = 'center';
sheet.getRange('L2:M11').format.numberFormat = '0.000000';
sheet.getRange('A1:M11').format.autofitColumns();
sheet.getRange('A1:M1').format.rowHeight = 32;
sheet.getRange('A2:M11').format.rowHeight = 27;
sheet.getRange('A1:A11').format.columnWidth = 15;
sheet.getRange('B1:B11').format.columnWidth = 16;
sheet.getRange('C1:C11').format.columnWidth = 20;
sheet.getRange('D1:D11').format.columnWidth = 14;
sheet.getRange('E1:E11').format.columnWidth = 42;
sheet.getRange('F1:F11').format.columnWidth = 22;
sheet.getRange('G1:K11').format.columnWidth = 15;
sheet.getRange('L1:M11').format.columnWidth = 14;
sheet.freezePanes.freezeRows(1);

workbook.recalculate();
const preview = await workbook.render({ sheetName: 'OTs para importar', range: 'A1:M11', scale: 1.5, format: 'png' });
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(`${outputDir}/ot-simuladas-pex-track-preview.png`, new Uint8Array(await preview.arrayBuffer()));
const file = await SpreadsheetFile.exportXlsx(workbook);
await file.save(outputPath);

const check = await workbook.inspect({ kind: 'table', range: 'OTs para importar!A1:M11', include: 'values,formulas', tableMaxRows: 12, tableMaxCols: 13 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 20 } });
console.log(errors.ndjson);
