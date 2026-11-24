import { Component, computed, effect, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslatePipe, RadioControlDirective } from '@shared';
import { openQuantity } from './sales-workspace.logic';
import { CreateDdtPayload, ResidualMode, WorkspaceOrderLine } from './sales-workspace.models';

/**
 * Partial delivery drawer: the quantity to ship per open line (never above its open quantity), what to do with the
 * residual (backorder with ATP date, keep open or cancel) and one click to generate the DDT.
 */
@Component({
  selector: 'app-create-ddt-drawer',
  imports: [
    RadioControlDirective,
    FormsModule,
    NzButtonModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
    NzTableModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      nzWidth="640"
      [nzTitle]="'SWK.DDT.TITLE' | translate"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        <nz-table nzSize="small" [nzData]="lines()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'SWK.COL.PRODUCT' | translate }}</th>
              <th class="num">{{ 'SWK.COL.OPEN' | translate }}</th>
              <th>{{ 'SWK.DDT.SHIP_QTY' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of lines(); track line.id) {
              <tr>
                <td>{{ line.description }}</td>
                <td class="num">{{ openOf(line) }}</td>
                <td>
                  <nz-input-number
                    [nzMin]="0"
                    [nzMax]="openOf(line)"
                    [nzStep]="1"
                    [ngModel]="quantities()[line.id] ?? 0"
                    (ngModelChange)="setQuantity(line.id, $event)"
                    [attr.aria-label]="'SWK.DDT.SHIP_QTY' | translate"
                  />
                </td>
              </tr>
            }
          </tbody>
        </nz-table>

        <h4 class="section">{{ 'SWK.DDT.RESIDUAL' | translate }}</h4>
        <nz-radio-group [ngModel]="residual()" (ngModelChange)="residual.set($event)">
          <label for="create-ddt-drawer-backorder" appRadioControl nz-radio nzValue="backorder">{{ 'SWK.DDT.RESIDUAL_BACKORDER' | translate }}</label>
          <label for="create-ddt-drawer-keep-open" appRadioControl nz-radio nzValue="keep_open">{{ 'SWK.DDT.RESIDUAL_KEEP' | translate }}</label>
          <label for="create-ddt-drawer-cancel-residual" appRadioControl nz-radio nzValue="cancel_residual">{{
            'SWK.DDT.RESIDUAL_CANCEL' | translate
          }}</label>
        </nz-radio-group>

        <label class="section" for="ddt-carrier">{{ 'SWK.DDT.CARRIER' | translate }}</label>
        <input
          id="ddt-carrier"
          nz-input
          [ngModel]="carrier()"
          (ngModelChange)="carrier.set($event)"
        />

        <div class="footer">
          <button nz-button type="button" (click)="open.set(false)">
            {{ 'SWK.COMMON.CANCEL' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="!hasQuantity() || working()"
            (click)="submit()"
          >
            {{ 'SWK.DDT.GENERATE' | translate }}
          </button>
        </div>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .num {
      text-align: right;
    }
    .section {
      display: block;
      margin: 20px 0 8px;
      font-weight: 600;
    }
    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
    }
  `,
})
export class CreateDdtDrawerComponent {
  readonly open = model(false);
  readonly lines = input<WorkspaceOrderLine[]>([]);
  readonly working = input(false);
  readonly generate = output<CreateDdtPayload>();

  protected readonly quantities = signal<Record<string, number>>({});
  protected readonly residual = signal<ResidualMode>('backorder');
  protected readonly carrier = signal('');
  protected readonly hasQuantity = computed(() =>
    Object.values(this.quantities()).some((q) => q > 0),
  );

  constructor() {
    // Every time the drawer opens, each line proposes its full open quantity.
    effect(() => {
      if (this.open()) {
        this.quantities.set(
          Object.fromEntries(this.lines().map((line) => [line.id, openQuantity(line)])),
        );
      }
    });
  }

  protected openOf(line: WorkspaceOrderLine): number {
    return openQuantity(line);
  }

  protected setQuantity(lineId: string, value: number | null): void {
    this.quantities.update((current) => ({ ...current, [lineId]: Math.max(0, value ?? 0) }));
  }

  protected submit(): void {
    const lines = Object.fromEntries(
      Object.entries(this.quantities()).filter(([, quantity]) => quantity > 0),
    );
    const carrier = this.carrier().trim();
    this.generate.emit({
      lines,
      residual_mode: this.residual(),
      ...(carrier ? { carrier_name: carrier } : {}),
    });
  }
}
