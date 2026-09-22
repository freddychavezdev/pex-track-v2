import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = 'outputs/network-assets-pilot';
const nodes = [
  ['PRUEBA-NODO-LP-01', 'Miraflores', 'La Paz', -16.5002, -68.1268],
  ['PRUEBA-NODO-LP-02', 'Sopocachi', 'La Paz', -16.5116, -68.1295],
  ['PRUEBA-NODO-LP-03', 'Obrajes', 'La Paz', -16.5294, -68.1023],
  ['PRUEBA-NODO-LP-04', 'San Miguel', 'La Paz', -16.5418, -68.0836],
  ['PRUEBA-NODO-LP-05', 'Villa Fátima', 'La Paz', -16.4833, -68.1177],
  ['PRUEBA-NODO-EA-01', 'Ciudad Satélite', 'El Alto', -16.5201, -68.1946],
  ['PRUEBA-NODO-EA-02', '12 de Octubre', 'El Alto', -16.5006, -68.1910],
  ['PRUEBA-NODO-EA-03', 'Villa Adela', 'El Alto', -16.5483, -68.2064],
  ['PRUEBA-NODO-EA-04', 'Senkata', 'El Alto', -16.5564, -68.2332],
  ['PRUEBA-NODO-EA-05', 'Río Seco', 'El Alto', -16.4763, -68.1908]
];
const boxes = nodes.flatMap(([nodeCode, zone, city, latitude, longitude]) => [
  [`PRUEBA-CAJA-${nodeCode.includes('-LP-') ? 'LP' : 'EA'}-${nodeCode.slice(-2)}A`, nodeCode, zone, city, latitude - 0.0006, longitude - 0.0007],
  [`PRUEBA-CAJA-${nodeCode.includes('-LP-') ? 'LP' : 'EA'}-${nodeCode.slice(-2)}B`, nodeCode, zone, city, latitude + 0.0007, longitude + 0.0009]
]);

const workbook = Workbook.create();
const summary = workbook.worksheets.add('Resumen');
const nodeSheet = workbook.worksheets.add('Nodos');
const boxSheet = workbook.worksheets.add('Cajas');
for (const sheet of [summary, nodeSheet, boxSheet]) { sheet.showGridLines = false; }

summary.getRange('A1:F1').merge();
summary.getRange('A1').values = [['Inventario piloto de red PEX Track']];
summary.getRange('A3:B6').values = [
  ['Concepto', 'Cantidad'],
  ['Nodos piloto', nodes.length],
  ['Cajas de distribución piloto', boxes.length],
  ['Cobertura', 'La Paz y El Alto']
];
summary.getRange('A8').values = [['Uso previsto']];
summary.getRange('A9:F10').merge();
summary.getRange('A9').values = [['Datos de prueba para activar “Mostrar nodos/cajas” en el mapa operativo. No representan infraestructura real.']];

nodeSheet.getRange('A1:F1').values = [['Código', 'Zona', 'Ciudad', 'Latitud', 'Longitud', 'Estado']];
nodeSheet.getRange(`A2:F${nodes.length + 1}`).values = nodes.map(([code, zone, city, latitude, longitude]) => [code, zone, city, latitude, longitude, 'PRUEBA']);
boxSheet.getRange('A1:G1').values = [['Código', 'Nodo asociado', 'Zona', 'Ciudad', 'Latitud', 'Longitud', 'Estado']];
boxSheet.getRange(`A2:G${boxes.length + 1}`).values = boxes.map(([code, nodeCode, zone, city, latitude, longitude]) => [code, nodeCode, zone, city, latitude, longitude, 'PRUEBA']);

const titleFormat = { fill: '#183B61', font: { name: 'Arial', size: 16, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'left', verticalAlignment: 'center' };
summary.getRange('A1:F1').format = titleFormat;
summary.getRange('A1:F1').format.rowHeight = 28;
summary.getRange('A3:B3').format = { fill: '#2D74DF', font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center', borders: { preset: 'all', style: 'thin', color: '#D7E3F4' } };
summary.getRange('A4:B6').format = { font: { name: 'Arial', size: 10, color: '#22354D' }, borders: { preset: 'all', style: 'thin', color: '#D7E3F4' } };
summary.getRange('A8').format = { font: { name: 'Arial', size: 11, bold: true, color: '#183B61' } };
summary.getRange('A9:F10').format = { fill: '#EDF5FF', font: { name: 'Arial', size: 10, color: '#415D7A', italic: true }, wrapText: true, verticalAlignment: 'center' };
summary.getRange('A1:F10').format.font = { name: 'Arial', size: 10 };
summary.getRange('A1').format.font = { name: 'Arial', size: 16, bold: true, color: '#FFFFFF' };

for (const [sheet, columns] of [[nodeSheet, 'A1:F11'], [boxSheet, 'A1:G21']]) {
  sheet.getRange(columns).format.font = { name: 'Arial', size: 10, color: '#22354D' };
  sheet.getRange(columns.replace(/\d+$/, '1')).format = { fill: '#183B61', font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center' };
  sheet.getRange(columns).format.borders = { preset: 'insideHorizontal', style: 'thin', color: '#E1EAF4' };
  sheet.freezePanes.freezeRows(1);
}
nodeSheet.getRange(`D2:E${nodes.length + 1}`).format.numberFormat = '0.000000';
boxSheet.getRange(`E2:F${boxes.length + 1}`).format.numberFormat = '0.000000';
nodeSheet.getRange(`F2:F${nodes.length + 1}`).format = { fill: '#E7F8F0', font: { name: 'Arial', size: 10, bold: true, color: '#16855D' }, horizontalAlignment: 'center' };
boxSheet.getRange(`G2:G${boxes.length + 1}`).format = { fill: '#FFF3DF', font: { name: 'Arial', size: 10, bold: true, color: '#A86917' }, horizontalAlignment: 'center' };

summary.getRange('A1:F10').format.autofitColumns();
nodeSheet.getRange('A1:F11').format.autofitColumns();
boxSheet.getRange('A1:G21').format.autofitColumns();
summary.getRange('A1:A10').format.columnWidth = 30;
summary.getRange('B1:B10').format.columnWidth = 18;
nodeSheet.getRange('A1:A11').format.columnWidth = 22;
boxSheet.getRange('A1:B21').format.columnWidth = 24;

workbook.recalculate();
const check = await workbook.inspect({ kind: 'table', range: 'Nodos!A1:F11', include: 'values,formulas', tableMaxRows: 12, tableMaxCols: 6 });
if (!check.ndjson.includes('PRUEBA-NODO-LP-01') || !check.ndjson.includes('PRUEBA-NODO-EA-05')) throw new Error('No se verificaron los nodos piloto.');
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 20 }, summary: 'formula error scan' });
if (errors.ndjson.includes('#REF!') || errors.ndjson.includes('#DIV/0!')) throw new Error('Se detectaron errores de fórmula.');
const preview = await workbook.render({ sheetName: 'Resumen', range: 'A1:F10', scale: 2, format: 'png' });
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/inventario-red-piloto-pex-track.xlsx`);
