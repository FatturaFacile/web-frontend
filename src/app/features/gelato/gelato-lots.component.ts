import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GelatoApiService, GelatoLot, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { gelatoProblem } from './gelato.util';

/** Pasteurization and churning lots with the HACCP thermal log (+85 °C → +4 °C → -18 °C) and the base-to-flavor genealogy. */
@Component({
  selector: 'app-gelato-lots',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'GELATO.LOTS.TITLE' | translate">
      <button nz-button nzType="primary" (click)="start('base')">{{ 'GELATO.LOTS.BASE' | translate }}</button>
      <button nz-button (click)="start('flavor')" [disabled]="!parentId()">
        {{ 'GELATO.LOTS.FLAVOR' | translate }}
      </button>
    </app-page-header>

    <nz-card>
      <label>
        {{ 'GELATO.LOTS.PARENT' | translate }}
        <nz-select [ngModel]="parentId()" (ngModelChange)="parentId.set($event)" nzAllowClear class="lot-parent">
          @for (lot of completedBases(); track lot.id) {
            <nz-option [nzValue]="lot.id" [nzLabel]="lot.lot_code" />
          }
        </nz-select>
      </label>
      <label>
        {{ 'GELATO.GRAMS' | translate }}
        <nz-input-number [ngModel]="drawGrams()" (ngModelChange)="drawGrams.set($event ?? 0)" [nzMin]="0" />
      </label>

      <nz-table #table [nzData]="lots()" nzSize="small" [nzLoading]="loading()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'GELATO.LOTS.TITLE' | translate }}</th>
            <th>{{ 'GELATO.LOTS.PARENT' | translate }}</th>
            <th>HACCP</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (lot of lots(); track lot.id) {
            <tr>
              <td>
                {{ lot.lot_code }}
                <nz-tag>{{ lot.kind === 'base' ? ('GELATO.LOTS.BASE' | translate) : ('GELATO.LOTS.FLAVOR' | translate) }}</nz-tag>
              </td>
              <td>{{ parentCode(lot) }}</td>
              <td>
                @if (lot.haccp_passed === true) {
                  <nz-tag nzColor="green">{{ 'GELATO.HACCP.PASSED' | translate }}</nz-tag>
                } @else if (lot.haccp_passed === false) {
                  <nz-tag nzColor="red">{{ 'GELATO.HACCP.FAILED' | translate }}</nz-tag>
                  @for (finding of lot.haccp_findings ?? []; track finding) {
                    <div>{{ 'GELATO.HACCP.FINDING.' + finding | translate }}</div>
                  }
                }
              </td>
              <td>
                @if (lot.status !== 'completed') {
                  <button nz-button nzSize="small" (click)="addReading(lot)">{{ 'GELATO.HACCP.ADD' | translate }}</button>
                  <button nz-button nzSize="small" nzType="primary" (click)="complete(lot)">
                    {{ 'GELATO.LOTS.COMPLETE' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      <label>
        °C
        <nz-input-number [ngModel]="reading()" (ngModelChange)="reading.set($event ?? 0)" />
      </label>
      <nz-select [ngModel]="phase()" (ngModelChange)="phase.set($event)">
        @for (p of phases; track p) {
          <nz-option [nzValue]="p" [nzLabel]="p" />
        }
      </nz-select>
    </nz-card>
  `,
  styles: `
    .lot-parent { min-width: 220px; }
  `,
})
export class GelatoLotsComponent implements OnInit {
  private readonly api = inject(GelatoApiService);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);

  readonly phases = ['heat', 'cool', 'age', 'harden'] as const;
  readonly lots = signal<GelatoLot[]>([]);
  readonly loading = signal(false);
  readonly parentId = signal<string | null>(null);
  readonly drawGrams = signal(3500);
  readonly reading = signal(85);
  readonly phase = signal<'heat' | 'cool' | 'age' | 'harden'>('heat');
  readonly completedBases = computed(() =>
    this.lots().filter((lot) => lot.kind === 'base' && lot.status === 'completed' && lot.haccp_passed),
  );

  ngOnInit(): void {
    this.reload();
  }

  parentCode(lot: GelatoLot): string {
    return this.lots().find((l) => l.id === lot.parent_lot_id)?.lot_code ?? '';
  }

  reload(): void {
    this.loading.set(true);
    this.api.getLots().subscribe({
      next: (response) => {
        this.lots.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('GELATO.LOAD_ERROR'));
      },
    });
  }

  start(kind: 'base' | 'flavor'): void {
    const parent = kind === 'flavor' ? this.parentId() : null;
    const payload: Record<string, unknown> = { kind, method: parent ? 'two_stage' : 'direct' };
    if (parent) {
      payload['parent_lot_id'] = parent;
      payload['consumptions'] = [{ source_lot_id: parent, grams: this.drawGrams() }];
    }
    this.api.startLot(payload).subscribe({
      next: () => this.reload(),
      error: (error) => this.message.error(gelatoProblem(error, this.translate.instant('GELATO.LOAD_ERROR'))),
    });
  }

  addReading(lot: GelatoLot): void {
    this.api
      .addHaccpReadings(lot.id, [
        { at: new Date().toISOString(), temperature_celsius: this.reading(), phase: this.phase() },
      ])
      .subscribe({
        next: () => this.reload(),
        error: (error) => this.message.error(gelatoProblem(error, this.translate.instant('GELATO.LOAD_ERROR'))),
      });
  }

  complete(lot: GelatoLot): void {
    this.api.completeLot(lot.id, { yield_grams: lot.mix_weight_grams || undefined }).subscribe({
      next: () => this.reload(),
      error: (error) => this.message.error(gelatoProblem(error, this.translate.instant('GELATO.LOAD_ERROR'))),
    });
  }
}
