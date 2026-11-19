import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FpaDocumentsApiService,
  I18nService,
  PreflightResult,
  SdiTransmissionsApiService,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError } from '../hr/shared/hr-http.util';
import { SdiHtmlPreviewComponent } from '../sdi-transmissions/sdi-html-preview.component';

type PreflightView = 'checks' | 'xml' | 'preview';

/** Pre-flight before sending: generates the XML, runs the XSD and Sogei checks, previews it and sends when it is clean. */
@Component({
  selector: 'app-sdi-preflight-drawer',
  imports: [
    FormsModule,
    NzButtonModule,
    NzDrawerModule,
    NzSegmentedModule,
    NzTagModule,
    SdiHtmlPreviewComponent,
    TranslatePipe,
  ],
  styles: [
    '.issue { margin-bottom: var(--space-2); } pre { max-height: 60vh; overflow: auto; background: var(--surface-muted, #f5f5f5); padding: var(--space-3); font-size: 12px; }',
    '.actions { margin-top: var(--space-3); display: flex; gap: var(--space-2); }',
  ],
  template: `
    <nz-drawer
      [nzVisible]="invoiceId() !== null"
      nzWidth="640"
      [nzTitle]="'sdiPreflight.title' | translate"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        <nz-segmented
          [nzOptions]="views()"
          [ngModel]="view()"
          (ngModelChange)="view.set($event)"
          data-testid="preflight-views"
        />
        @if (loading()) {
          <p>{{ 'sdiPreflight.running' | translate }}</p>
        } @else if (result(); as r) {
          @switch (view()) {
            @case ('checks') {
              @if (r.valid && r.warnings.length === 0) {
                <nz-tag nzColor="success" data-testid="preflight-ok">{{
                  'sdiPreflight.allGood' | translate
                }}</nz-tag>
              }
              @for (issue of r.errors; track $index) {
                <div class="issue" data-testid="preflight-error">
                  <nz-tag nzColor="error">{{ issue.code }}</nz-tag>{{
                    'sdiPreflight.issue.' + issue.code | translate
                  }}
                  @if (issue.path) {
                    <small> — {{ issue.path }}</small>
                  }
                  @if (issue.params['message']) {
                    <small> — {{ issue.params['message'] }}</small>
                  }
                </div>
              }
              @for (issue of r.warnings; track $index) {
                <div class="issue" data-testid="preflight-warning">
                  <nz-tag nzColor="warning">{{ issue.code }}</nz-tag>{{
                    'sdiPreflight.issue.' + issue.code | translate
                  }}
                  @if (issue.path) {
                    <small> — {{ issue.path }}</small>
                  }
                </div>
              }
            }
            @case ('xml') {
              <pre data-testid="preflight-xml">{{ r.xml }}</pre>
            }
            @case ('preview') {
              <app-sdi-html-preview [content]="preview()" />
            }
          }
          <div class="actions">
            <button
              nz-button
              nzType="primary"
              type="button"
              [disabled]="!r.valid || sending()"
              (click)="send()"
              data-testid="preflight-send"
            >
              {{ 'sdiPreflight.send' | translate }}
            </button>
            @if (!r.valid) {
              <span>{{ 'sdiPreflight.blocked' | translate }}</span>
            }
          </div>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class SdiPreflightDrawerComponent {
  private readonly api = inject(FpaDocumentsApiService);
  private readonly transmissions = inject(SdiTransmissionsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** The invoice to check; the drawer is open while it is set. */
  readonly invoiceId = input<string | null>(null);
  readonly closed = output<void>();
  readonly sent = output<void>();

  protected readonly loading = signal(false);
  protected readonly sending = signal(false);
  protected readonly result = signal<PreflightResult | null>(null);
  protected readonly preview = signal<Blob | null>(null);
  protected readonly view = signal<PreflightView>('checks');
  protected readonly views = computed(() =>
    (['checks', 'xml', 'preview'] as const).map((value) => ({
      value,
      label: this.i18n.translate('sdiPreflight.view.' + value),
    })),
  );

  constructor() {
    effect(() => {
      const id = this.invoiceId();
      this.result.set(null);
      this.preview.set(null);
      this.view.set('checks');
      if (id !== null) {
        this.run(id);
      }
    });
  }

  protected send(): void {
    const id = this.invoiceId();
    if (id === null) {
      return;
    }
    this.sending.set(true);
    this.api.send(id).subscribe({
      next: () => {
        this.sending.set(false);
        this.message.success(this.i18n.translate('sdiPreflight.sentOk'));
        this.sent.emit();
        this.closed.emit();
      },
      error: (error) => {
        this.sending.set(false);
        reportHttpError(error, this.message, this.i18n);
      },
    });
  }

  private run(id: string): void {
    this.loading.set(true);
    this.api.preflight(id).subscribe({
      next: (res) => {
        this.result.set(res.data);
        this.loading.set(false);
        this.transmissions.previewHtml(id).subscribe({
          next: (blob) => this.preview.set(blob),
          error: () => this.preview.set(null),
        });
      },
      error: (error) => {
        this.loading.set(false);
        reportHttpError(error, this.message, this.i18n);
      },
    });
  }
}
