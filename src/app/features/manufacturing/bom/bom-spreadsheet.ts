import { parseCsv } from './bom.utils';

/** Text of a spreadsheet cell: plain values, formula results, rich text and hyperlinks. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    const cell = value as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (cell.richText) {
      return cell.richText.map((part) => part.text).join('');
    }
    if (cell.result !== undefined) {
      return cellText(cell.result);
    }
    if (cell.text !== undefined) {
      return cellText(cell.text);
    }

    return '';
  }

  return String(value);
}

export const isExcelFile = (name: string): boolean => /\.xlsx$/i.test(name);

/** Reads the first sheet of an .xlsx workbook into a matrix of strings. exceljs loads on demand, only for Excel files. */
export async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  const rows: string[][] = [];

  sheet?.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cells[column - 1] = cellText(cell.value);
    });
    const filled = Array.from(cells, (value) => value ?? '');
    if (filled.some((value) => value.trim() !== '')) {
      rows.push(filled);
    }
  });

  return rows;
}

/** Parses an uploaded CSV or XLSX file on the client; nothing is sent to the server until the dry run. */
export async function readSpreadsheetFile(file: File): Promise<string[][]> {
  return isExcelFile(file.name) ? readXlsx(await file.arrayBuffer()) : parseCsv(await file.text());
}
