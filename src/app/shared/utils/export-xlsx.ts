import { downloadBlob } from './download-blob';

export interface XlsxColumn {
  header: string;
  /** Ready-to-write cell value for the column. */
  values: unknown[];
  width?: number;
}

function toCell(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
    return value;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Builds a real `.xlsx` workbook (exceljs, loaded lazily) and offers it as a download. */
export async function exportXlsx(
  columns: XlsxColumn[],
  fileName: string,
  sheetName = 'Export',
): Promise<void> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Export');

  sheet.columns = columns.map((column) => ({
    header: column.header,
    width: column.width ?? Math.min(Math.max(column.header.length + 4, 14), 50),
  }));
  const rowCount = Math.max(0, ...columns.map((c) => c.values.length));
  for (let i = 0; i < rowCount; i++) {
    sheet.addRow(columns.map((c) => toCell(c.values[i])));
  }
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { horizontal: 'center' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`,
  );
}
