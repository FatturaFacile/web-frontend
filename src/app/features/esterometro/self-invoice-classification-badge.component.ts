import { Component, OnChanges, SimpleChanges, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { EsterometroApiService } from '../../core/api/esterometro-api.service';
import { ClassificationPreviewResult, SelfInvoice } from '../../core/models/esterometro.model';
import { docTypeColor, statusColor } from './esterometro.util';

@Component({
  selector: 'app-self-invoice-classification-badge',
  imports: [
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzSpinModule,
    NzTagModule,
  ],
  template: `
    <nz-card nzSize="small" [nzTitle]="'ESTEROMETRO.BADGE.TITLE' | translate">
      <nz-spin [nzSpinning]="loading()">
        @if (linkedSelfInvoice(); as si) {
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <nz-tag [nzColor]="docTypeColor(si.document_type)">{{ si.document_type }}</nz-tag>
              <strong>{{ si.document_number }}</strong>
              <nz-tag [nzColor]="statusColor(si.sdi_status)">
                {{ 'ESTEROMETRO.STATUS.' + si.sdi_status | translate }}
              </nz-tag>
            </div>
            <button nz-button nzType="link" nzSize="small" (click)="openWorkspace()">
              {{ 'ESTEROMETRO.BADGE.ALREADY_GENERATED' | translate }} →
            </button>
          </div>
        } @else if (preview(); as p) {
          @if (p.requires_self_invoice && p.document_type) {
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <nz-tag [nzColor]="docTypeColor(p.document_type)">{{ p.document_type }}</nz-tag>
                <span>{{ p.legal_reference }}</span>
              </div>
              <button
                nz-button
                nzType="primary"
                nzSize="small"
                [nzLoading]="generating()"
                (click)="generate()"
              >
                {{ 'ESTEROMETRO.ACTIONS.GENERATE_FROM_PASSIVE' | translate }}
              </button>
            </div>
            @for (warn of p.compliance_warnings; track warn.code) {
              <nz-alert
                style="margin-top:8px;"
                nzType="warning"
                nzShowIcon
                [nzMessage]="warn.message"
              />
            }
          } @else {
            <span style="color:#64748b;">{{ 'ESTEROMETRO.BADGE.NOT_REQUIRED' | translate }}</span>
          }
        }
      </nz-spin>
    </nz-card>
  `,
})
export class SelfInvoiceClassificationBadgeComponent implements OnChanges {
  private readonly api = inject(EsterometroApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly passiveInvoiceId = input.required<string>();
  readonly generated = output<SelfInvoice>();

  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly linkedSelfInvoice = signal<SelfInvoice | null>(null);
  readonly preview = signal<ClassificationPreviewResult | null>(null);

  protected readonly docTypeColor = docTypeColor;
  protected readonly statusColor = statusColor;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['passiveInvoiceId'] && this.passiveInvoiceId()) {
      void this.loadState();
    }
  }

  async loadState(): Promise<void> {
    const id = this.passiveInvoiceId();
    if (!id) return;
    this.loading.set(true);
    try {
      const listRes = await firstValueFrom(
        this.api.listSelfInvoices({ passive_invoice_id: id, per_page: 1 }),
      );
      if (listRes.data.length > 0) {
        this.linkedSelfInvoice.set(listRes.data[0]);
        this.preview.set(null);
      } else {
        this.linkedSelfInvoice.set(null);
        const prevRes = await firstValueFrom(this.api.classifyPreview({ passive_invoice_id: id }));
        this.preview.set(prevRes.data);
      }
    } catch {
      this.preview.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async generate(): Promise<void> {
    const id = this.passiveInvoiceId();
    if (!id) return;
    this.generating.set(true);
    try {
      const res = await firstValueFrom(this.api.generateFromPassive(id, {}));
      this.linkedSelfInvoice.set(res.data);
      this.message.success(this.translate.instant('ESTEROMETRO.MESSAGES.CREATED'));
      this.generated.emit(res.data);
    } catch (err: unknown) {
      this.message.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      this.generating.set(false);
    }
  }

  openWorkspace(): void {
    void this.router.navigate(['/italian-vat/esterometro']);
  }
}
