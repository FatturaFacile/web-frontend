const fs = require('fs');
const f = 'src/app/features/treasury/treasury.component.html';
let s = fs.readFileSync(f, 'utf8');
const crlf = s.includes('\r\n');
s = s.replace(/\r\n/g, '\n');
function rep(a, b) {
  if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 80));
  s = s.replace(a, b);
}
function between(startMarker, endMarker, replacement) {
  const a = s.indexOf(startMarker);
  if (a < 0) throw new Error('no start ' + startMarker);
  const b = s.indexOf(endMarker, a);
  if (b < 0) throw new Error('no end ' + endMarker);
  s = s.slice(0, a) + replacement + s.slice(b + endMarker.length);
}
rep(`[ngModel]="tableState.search()"`, `[ngModel]="txGrid.filterParams().search ?? ''"`);
rep(`      <app-base-table
        [data]="transactions()"
        [columns]="txColumns()"
        [loading]="tableState.loading()"
        [total]="tableState.total()"
        [pageIndex]="tableState.pageIndex()"
        [pageSize]="tableState.pageSize()"
        (paramsChange)="onParamsChange($event)"
      />`, `      <app-base-table [grid]="txGrid" [columns]="txColumns()" />`);
rep(`      <app-base-table
        [data]="bankAccounts()"
        [columns]="accountColumns()"
        [loading]="loadingAccounts()"
        [total]="bankAccounts().length"
        [scroll]="{ x: '900px' }"
        [actionsTemplate]="accountActionsTpl"
      />`, `      <app-base-table
        [grid]="accountsGrid"
        [columns]="accountColumns()"
        [scroll]="{ x: '900px' }"
        [actionsTemplate]="accountActionsTpl"
      />`);
rep(`      <app-base-table
        [data]="statements()"
        [columns]="statementColumns()"
        [loading]="loadingStatements()"
        [total]="statements().length"
        [scroll]="{ x: '1000px' }"
        [actionsTemplate]="statementActionsTpl"
      />`, `      <app-base-table
        [grid]="statementsGrid"
        [columns]="statementColumns()"
        [scroll]="{ x: '1000px' }"
        [actionsTemplate]="statementActionsTpl"
      />`);
between(`      <nz-table #pbTable`, `      </nz-table>
`, `      <app-base-table
        [grid]="batchesGrid"
        [columns]="batchColumns()"
        [scroll]="{ x: '800px' }"
        [actionsTemplate]="batchActionsTpl"
      />

      <ng-template #batchActionsTpl let-b>
        <div class="row-actions">
          @if (b.status === 'draft') {
            <button nz-button nzSize="small" nzType="default" (click)="submitBatchApproval(b)">
              {{ 'treasury.lblInviaAppr' | translate }}
            </button>
          }
          @if (b.status === 'pending_approval') {
            <button nz-button nzSize="small" nzType="primary" (click)="approveBatch(b)">
              {{ 'treasury.lblApprova' | translate }}
            </button>
          }
          @if (b.status === 'approved') {
            <button nz-button nzSize="small" nzType="default" (click)="exportBatchXml(b)">
              <nz-icon nzType="upload" /> {{ 'treasury.lblGeneraXml' | translate }}
            </button>
          }
          @if (b.status === 'exported' || b.status === 'approved') {
            <button nz-button nzSize="small" nzType="primary" (click)="downloadBatchXml(b)">
              <nz-icon nzType="download" /> {{ 'treasury.lblScaricaXml' | translate }}
            </button>
          }
          @if (b.status !== 'cancelled' && b.status !== 'executed') {
            <button nz-button nzSize="small" nzDanger nzType="text" (click)="cancelBatch(b)">
              {{ 'treasury.lblAnnulla' | translate }}
            </button>
          }
        </div>
      </ng-template>
`);
between(`      <nz-table #cfTable`, `      </nz-table>
`, `      <app-base-table [grid]="forecastsGrid" [columns]="forecastColumns()" [scroll]="{ x: '800px' }" />
`);
rep(`<ng-template #reconciledTpl let-val="value">
  <nz-tag [nzColor]="val ? 'success' : 'warning'">
    {{ (val ? 'treasury.reconciled.yes' : 'treasury.reconciled.no') | translate }}
  </nz-tag>
</ng-template>`, `<ng-template #txStatusTpl let-item>
  <nz-tag [nzColor]="item.status === 'unmatched' ? 'warning' : item.status === 'ignored' ? 'default' : 'success'">
    {{ transactionStatusLabel(item.status) }}
  </nz-tag>
</ng-template>

<ng-template #batchRefTpl let-val="value"><strong>{{ val }}</strong></ng-template>

<ng-template #batchMethodTpl let-val="value"><code>{{ val }}</code></ng-template>

<ng-template #batchAmountTpl let-item><strong>{{ item.total_amount | money: item.currency }}</strong></ng-template>

<ng-template #batchStatusTpl let-item>
  <nz-tag [nzColor]="batchStatusColor(item.status)">{{ item.status }}</nz-tag>
</ng-template>

<ng-template #forecastAmountTpl let-val="value">{{ val | money }}</ng-template>

<ng-template #forecastRiskTpl let-item>
  <nz-tag [nzColor]="item.deficit_detected ? 'error' : 'success'">
    {{ forecastRiskLabel(item.deficit_detected ? 'deficit' : 'covered') }}
  </nz-tag>
</ng-template>`);
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
