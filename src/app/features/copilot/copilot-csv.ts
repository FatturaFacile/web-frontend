import type { CopilotVisualization } from './copilot.models';

function cell(value: unknown): string {
  let text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) {
    text = `'${text}`;
  }

  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Builds a CSV from the `rows` of a visualization, in the order of its `columns`. */
export function visualizationToCsv(viz: Pick<CopilotVisualization, 'columns' | 'rows'>): string {
  const columns = viz.columns.length > 0 ? viz.columns : Object.keys(viz.rows[0] ?? {});
  const lines = [columns.map(cell).join(',')];
  for (const row of viz.rows) {
    lines.push(columns.map((c) => cell(row[c])).join(','));
  }

  return lines.join('\r\n');
}

/** ECharts option for a bar, line or pie visualization; null for table and KPI types. */
export function visualizationOption(viz: CopilotVisualization): Record<string, unknown> | null {
  const labels = viz.labels ?? viz.rows.map((r) => String(r[viz.x ?? viz.columns[0]] ?? ''));
  const datasets = viz.datasets ?? [];

  if (viz.type === 'pie') {
    const first = datasets[0];

    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{ type: 'pie', radius: '60%', data: labels.map((name, i) => ({ name, value: first?.data[i] ?? 0 })) }],
    };
  }
  if (viz.type === 'bar' || viz.type === 'line') {
    return {
      tooltip: { trigger: 'axis' },
      legend: datasets.length > 1 ? { bottom: 0 } : undefined,
      grid: { left: 48, right: 16, top: 16, bottom: datasets.length > 1 ? 40 : 24 },
      xAxis: { type: 'category', data: labels },
      yAxis: { type: 'value' },
      series: datasets.map((d) => ({ type: viz.type, name: d.name, data: d.data })),
    };
  }

  return null;
}
