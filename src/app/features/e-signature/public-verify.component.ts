import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { EsigAssurance } from '@core';
import { TranslatePipe } from '@shared';
import { levelColor } from './e-signature.util';
import { PublicVerifyStore } from './public-verify.store';

/** The kind of alert each assurance level gets. */
const ASSURANCE_TYPE: Record<EsigAssurance, 'success' | 'info' | 'warning' | 'error'> = {
  qualified: 'success',
  advanced: 'success',
  simple: 'info',
  sandbox: 'warning',
  incomplete: 'warning',
  invalid: 'error',
  unknown: 'error',
};

/**
 * The public verification page (`/verify-signature`, no login, no application shell). Anybody with a signed document can
 * check it: by the verification code printed on it, by dropping the file (its SHA-256 is computed in the browser and only
 * the hash is sent), or by uploading the file for a deeper check of the signatures embedded in the PDF.
 */
@Component({
  selector: 'app-public-verify',
  providers: [PublicVerifyStore],
  imports: [
    DatePipe,
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <main class="page">
      <h1>{{ 'signatures.verify.title' | translate }}</h1>
      <p class="muted">{{ 'signatures.verify.intro' | translate }}</p>

      <div class="options">
        <nz-card [nzTitle]="'signatures.verify.byCode' | translate">
          <label class="field" for="esig-verify-code">
            <span>{{ 'signatures.verify.codeLabel' | translate }}</span>
            <input
              nz-input
              id="esig-verify-code"
              autocomplete="off"
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              [ngModel]="code()"
              (ngModelChange)="code.set($event)"
              (keyup.enter)="verifyCode()"
            />
          </label>
          <button
            nz-button
            nzType="primary"
            type="button"
            data-test="verify-code"
            [disabled]="code().trim().length < 10 || store.loading()"
            (click)="verifyCode()"
          >
            {{ 'signatures.verify.check' | translate }}
          </button>
        </nz-card>

        <nz-card [nzTitle]="'signatures.verify.byFile' | translate">
          <div
            class="drop"
            role="button"
            tabindex="0"
            [class.over]="dragging()"
            [attr.aria-label]="'signatures.verify.dropHint' | translate"
            (dragover)="onDragOver($event)"
            (dragleave)="dragging.set(false)"
            (drop)="onDrop($event)"
            (click)="picker.click()"
            (keydown.enter)="picker.click()"
          >
            {{ (store.file() ? store.file()!.name : 'signatures.verify.dropHint') | translate }}
          </div>
          <input #picker class="hidden" type="file" (change)="onPick($event)" />
          @if (store.fileHash(); as hash) {
            <p class="hash">
              <code>SHA-256 {{ hash }}</code>
            </p>
            <div class="buttons">
              <button
                nz-button
                nzType="primary"
                type="button"
                data-test="verify-hash"
                [disabled]="store.loading()"
                (click)="store.verifyHash()"
              >
                {{ 'signatures.verify.checkHash' | translate }}
              </button>
              <button
                nz-button
                type="button"
                data-test="verify-file"
                [disabled]="store.loading()"
                (click)="store.verifyFile()"
              >
                {{ 'signatures.verify.checkFile' | translate }}
              </button>
            </div>
            <p class="muted">{{ 'signatures.verify.privacy' | translate }}</p>
          }
        </nz-card>
      </div>

      <nz-spin [nzSpinning]="store.loading()">
        @if (store.error(); as error) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
        }

        @if (store.result(); as result) {
          <nz-alert
            data-test="assurance"
            class="gap"
            nzShowIcon
            [nzType]="assuranceType(result.assurance)"
            [nzMessage]="'signatures.assurance.' + result.assurance | translate"
            [nzDescription]="'signatures.assuranceHint.' + result.assurance | translate"
          ></nz-alert>

          @if (result.found) {
            <nz-card class="gap" [nzTitle]="result.title ?? ''">
              <dl class="facts">
                <dt>{{ 'signatures.cert.code' | translate }}</dt>
                <dd>{{ result.code }}</dd>
                <dt>{{ 'signatures.field.level' | translate }}</dt>
                <dd>
                  <nz-tag [nzColor]="levelColor(result.level!)">{{ result.level }}</nz-tag>
                  {{ 'signatures.jurisdictionBadge.' + result.jurisdiction | translate }}
                </dd>
                <dt>{{ 'signatures.field.provider' | translate }}</dt>
                <dd>{{ 'signatures.provider.' + result.provider | translate }}</dd>
                <dt>{{ 'signatures.field.status' | translate }}</dt>
                <dd>{{ 'signatures.status.' + result.status | translate }}</dd>
                @if (result.completed_at) {
                  <dt>{{ 'signatures.cert.completed' | translate }}</dt>
                  <dd>{{ result.completed_at | date: 'dd.MM.yyyy HH:mm' }}</dd>
                }
                <dt>{{ 'signatures.cert.chain' | translate }}</dt>
                <dd>
                  <nz-tag [nzColor]="result.audit_chain_valid ? 'green' : 'red'">{{
                    (result.audit_chain_valid
                      ? 'signatures.cert.chainValid'
                      : 'signatures.cert.chainBroken'
                    ) | translate
                  }}</nz-tag>
                </dd>
                @if (result.document_intact !== null && result.document_intact !== undefined) {
                  <dt>{{ 'signatures.verify.integrity' | translate }}</dt>
                  <dd>
                    <nz-tag [nzColor]="result.document_intact ? 'green' : 'red'">{{
                      (result.document_intact
                        ? 'signatures.verify.intact'
                        : 'signatures.verify.tampered'
                      ) | translate
                    }}</nz-tag>
                  </dd>
                }
                @if (result.timestamp) {
                  <dt>{{ 'signatures.audit.timestamp' | translate }}</dt>
                  <dd>
                    {{ result.timestamp.provider }}
                    @if (result.timestamp.issued_at) {
                      · {{ result.timestamp.issued_at | date: 'dd.MM.yyyy HH:mm' }}
                    }
                    <nz-tag [nzColor]="result.timestamp.qualified ? 'green' : 'default'">{{
                      (result.timestamp.qualified
                        ? 'signatures.verify.qualifiedTimestamp'
                        : 'signatures.verify.simpleTimestamp'
                      ) | translate
                    }}</nz-tag>
                  </dd>
                }
                @if (result.document_sha256) {
                  <dt>SHA-256</dt>
                  <dd>
                    <code>{{ result.document_sha256 }}</code>
                  </dd>
                }
              </dl>
            </nz-card>

            @if (result.signers && result.signers.length > 0) {
              <nz-card class="gap" [nzTitle]="'signatures.cert.signers' | translate">
                <nz-table nzSize="small" [nzData]="result.signers" [nzShowPagination]="false">
                  <thead>
                    <tr>
                      <th scope="col">{{ 'signatures.field.name' | translate }}</th>
                      <th scope="col">{{ 'signatures.field.role' | translate }}</th>
                      <th scope="col">{{ 'signatures.field.status' | translate }}</th>
                      <th scope="col">{{ 'signatures.cert.when' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (signer of result.signers; track signer.name + signer.signed_at) {
                      <tr>
                        <th scope="row">{{ signer.name }}</th>
                        <td>{{ 'signatures.role.' + signer.role | translate }}</td>
                        <td>{{ 'signatures.recipientStatus.' + signer.status | translate }}</td>
                        <td>
                          {{
                            signer.signed_at ? (signer.signed_at | date: 'dd.MM.yyyy HH:mm') : ''
                          }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              </nz-card>
            }
          }

          @if (result.pdf_signatures && result.pdf_signatures.length > 0) {
            <nz-card class="gap" [nzTitle]="'signatures.verify.pdfSignatures' | translate">
              @for (signature of result.pdf_signatures; track signature.index) {
                <div class="sig">
                  <nz-tag [nzColor]="signature.intact ? 'green' : 'red'">{{
                    (signature.intact ? 'signatures.verify.intact' : 'signatures.verify.tampered')
                      | translate
                  }}</nz-tag>
                  <strong>{{ signature.signer_name ?? '—' }}</strong>
                  @if (!signature.covers_whole_document) {
                    <nz-tag nzColor="gold">{{
                      'signatures.verify.laterChanges' | translate
                    }}</nz-tag>
                  }
                  <div class="muted">
                    {{ signature.certificate_subject }}
                    @if (signature.certificate_issuer) {
                      · {{ 'signatures.verify.issuer' | translate }}:
                      {{ signature.certificate_issuer }}
                    }
                  </div>
                  @if (signature.signing_time) {
                    <div class="muted">{{ signature.signing_time | date: 'dd.MM.yyyy HH:mm' }}</div>
                  }
                </div>
              }
            </nz-card>
          }
        }
      </nz-spin>
    </main>
  `,
  styles: `
    .page {
      max-width: 960px;
      margin: 0 auto;
      padding: 16px;
    }

    .muted {
      color: var(--ant-color-text-secondary, #6b7280);
      font-size: 13px;
    }

    .options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    }

    .drop {
      border: 2px dashed var(--ant-color-border, #d9d9d9);
      border-radius: 8px;
      padding: 28px 12px;
      text-align: center;
      cursor: pointer;
    }

    .drop.over {
      border-color: #1e407c;
      background: rgb(30 64 124 / 8%);
    }

    .hidden {
      display: none;
    }

    .hash {
      word-break: break-all;
      font-size: 12px;
    }

    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .gap {
      margin-top: 16px;
    }

    .facts {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 6px 16px;
      margin: 0;
    }

    .facts dt {
      font-weight: 600;
    }

    .facts dd {
      margin: 0;
      word-break: break-all;
    }

    .sig {
      margin-bottom: 12px;
    }
  `,
})
export class PublicVerifyComponent {
  protected readonly store = inject(PublicVerifyStore);
  private readonly route = inject(ActivatedRoute);

  protected readonly code = signal('');
  protected readonly dragging = signal(false);
  protected readonly levelColor = levelColor;
  protected readonly assuranceType = (assurance: EsigAssurance) => ASSURANCE_TYPE[assurance];

  constructor() {
    // A verification link printed on a signed document carries the code.
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code !== null && code.trim() !== '') {
      this.code.set(code);
      void this.store.verifyCode(code);
    }
  }

  protected verifyCode(): void {
    void this.store.verifyCode(this.code());
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    void this.store.chooseFile(event.dataTransfer?.files.item(0) ?? null);
  }

  protected onPick(event: Event): void {
    void this.store.chooseFile((event.target as HTMLInputElement).files?.item(0) ?? null);
  }
}
