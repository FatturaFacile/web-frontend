import { Component, computed, input, output } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  TND_ENVELOPES,
  TndEdgue,
  TndEnvelopeItem,
  TndEnvelopeKey,
  TndIssue,
  TndJurisdiction,
  TndReadiness,
} from '@core';
import { TranslatePipe } from '@shared';
import { envelopeProgress, issueKey, validateEnvelope } from './tender-management.util';

export interface EnvelopeUpload {
  envelope: TndEnvelopeKey;
  docKey: string;
  file: File;
}

/**
 * The three envelopes of a tender (Mod 169), strictly separated: the administrative, the technical and the economic
 * checklist, each with its own upload, its digital signature badge (.p7m / PAdES), its progress and its findings; the eDGUE
 * trigger of the Italian tenders and the readiness gate that enables the submission.
 */
@Component({
  selector: 'app-tnd-envelopes-panel',
  imports: [NzAlertModule, NzButtonModule, NzEmptyModule, NzProgressModule, NzTagModule, TranslatePipe],
  template: `
    @if (readiness(); as state) {
      <nz-alert
        class="gate"
        [nzType]="state.ready ? 'success' : 'warning'"
        nzShowIcon
        [nzMessage]="(state.ready ? 'tenderManagement.envelopes.ready' : 'tenderManagement.envelopes.notReady') | translate"
      ></nz-alert>

      @if (isItalian()) {
        <section class="edgue">
          <h3>eDGUE</h3>
          <button nz-button type="button" [disabled]="busy()" (click)="generateEdgue.emit()">
            {{ 'tenderManagement.action.generateEdgue' | translate }}
          </button>
          <button nz-button type="button" [disabled]="busy()" (click)="downloadEdgue.emit('xml')">
            {{ 'tenderManagement.action.downloadEdgueXml' | translate }}
          </button>
          <button nz-button type="button" [disabled]="busy()" (click)="downloadEdgue.emit('pdf')">
            {{ 'tenderManagement.action.downloadEdguePdf' | translate }}
          </button>
          @if (edgue(); as generated) {
            <nz-tag nzColor="green">{{ 'tenderManagement.envelopes.edgueGenerated' | translate: { version: generated.version } }}</nz-tag>
          }
        </section>
      }

      @for (key of envelopes; track key) {
        <section class="envelope" [attr.aria-labelledby]="'tnd-env-' + key">
          <header>
            <h3 [id]="'tnd-env-' + key">{{ 'tenderManagement.enum.envelope.' + key | translate }}</h3>
            <nz-progress [nzPercent]="progress(key).percent" nzSize="small" [nzShowInfo]="true"></nz-progress>
            <nz-tag [nzColor]="validation(key).complete ? 'green' : 'orange'">
              {{ (validation(key).complete ? 'tenderManagement.envelopes.complete' : 'tenderManagement.envelopes.incomplete') | translate }}
            </nz-tag>
            @if (items(key).length === 0) {
              <button nz-button nzSize="small" type="button" [disabled]="busy()" (click)="seed.emit(key)">
                {{ 'tenderManagement.action.seedChecklist' | translate }}
              </button>
            }
          </header>

          @for (issue of issuesOf(key); track $index) {
            <nz-alert class="issue" nzShowIcon [nzType]="issue.severity === 'blocking' ? 'error' : 'warning'" [nzMessage]="issueText(issue) | translate: issue.params ?? {}"></nz-alert>
          }

          <ul class="items">
            @for (item of items(key); track item.key) {
              <li class="item">
                <div class="label">
                  <strong>{{ item.label ?? ('tenderManagement.envelopeItem.' + item.key | translate) }}</strong>
                  @if (item.required) {
                    <nz-tag nzColor="blue">{{ 'tenderManagement.envelopes.required' | translate }}</nz-tag>
                  }
                  @if (item.signature_required) {
                    <nz-tag nzColor="purple">{{ 'tenderManagement.envelopes.signatureRequired' | translate }}</nz-tag>
                  }
                </div>
                <div class="state">
                  <nz-tag [nzColor]="itemColor(item)">{{ 'tenderManagement.enum.itemStatus.' + item.status | translate }}</nz-tag>
                  @if (item.signature; as signature) {
                    <nz-tag [nzColor]="signatureColor(signature.status)" [attr.title]="signature.signer ?? ''">
                      {{ 'tenderManagement.enum.signatureFormat.' + signature.format | translate }} ·
                      {{ 'tenderManagement.enum.signatureStatus.' + signature.status | translate }}
                    </nz-tag>
                  }
                  @if (item.file_name) {
                    <span class="file">{{ item.file_name }}</span>
                  }
                </div>
                <div class="actions">
                  <input
                    #picker
                    type="file"
                    class="visually-hidden"
                    [attr.accept]="item.signature_required ? '.p7m,.pdf' : null"
                    [attr.aria-label]="'tenderManagement.action.upload' | translate"
                    (change)="pick(key, item.key, picker)"
                  />
                  <button nz-button nzSize="small" type="button" [disabled]="busy()" (click)="picker.click()">
                    {{ (item.file_name ? 'tenderManagement.action.replace' : 'tenderManagement.action.upload') | translate }}
                  </button>
                  @if (item.file_name) {
                    <button nz-button nzSize="small" nzDanger type="button" [disabled]="busy()" (click)="remove.emit({ envelope: key, docKey: item.key })">
                      {{ 'tenderManagement.action.remove' | translate }}
                    </button>
                  }
                </div>
              </li>
            } @empty {
              <li><nz-empty [nzNotFoundContent]="'tenderManagement.empty.checklist' | translate"></nz-empty></li>
            }
          </ul>
        </section>
      }

      @if (generalIssues().length > 0) {
        <section class="envelope">
          @for (issue of generalIssues(); track $index) {
            <nz-alert class="issue" nzShowIcon [nzType]="issue.severity === 'blocking' ? 'error' : 'warning'" [nzMessage]="issueText(issue) | translate: issue.params ?? {}"></nz-alert>
          }
        </section>
      }
    } @else {
      <nz-empty></nz-empty>
    }
  `,
  styles: `
    .gate,
    .issue {
      margin-bottom: 8px;
    }
    .edgue {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .envelope {
      border: 1px solid rgba(127, 127, 127, 0.3);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .envelope header {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .envelope h3 {
      margin: 0;
    }
    .envelope nz-progress {
      min-width: 160px;
      flex: 1;
    }
    .items {
      list-style: none;
      padding: 0;
      margin: 8px 0 0;
    }
    .item {
      display: grid;
      grid-template-columns: 2fr 2fr auto;
      gap: 8px;
      padding: 8px 0;
      border-top: 1px solid rgba(127, 127, 127, 0.15);
      align-items: center;
    }
    .file {
      font-size: 12px;
      opacity: 0.7;
    }
    .actions {
      display: flex;
      gap: 6px;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  `,
})
export class EnvelopesPanelComponent {
  readonly readiness = input<TndReadiness | null>(null);
  readonly jurisdiction = input<TndJurisdiction | null>(null);
  readonly edgue = input<TndEdgue | null>(null);
  readonly busy = input(false);

  readonly upload = output<EnvelopeUpload>();
  readonly remove = output<{ envelope: TndEnvelopeKey; docKey: string }>();
  readonly seed = output<TndEnvelopeKey>();
  readonly generateEdgue = output<void>();
  readonly downloadEdgue = output<'xml' | 'pdf'>();

  protected readonly envelopes = TND_ENVELOPES;
  protected readonly isItalian = computed(() => this.jurisdiction() === 'IT_Dlgs36_2023_ANAC');
  protected readonly generalIssues = computed(() =>
    (this.readiness()?.issues ?? []).filter((issue) => !issue.envelope),
  );

  protected items(key: TndEnvelopeKey): TndEnvelopeItem[] {
    return this.readiness()?.envelopes[key]?.items ?? [];
  }

  protected validation(key: TndEnvelopeKey) {
    return validateEnvelope(this.items(key));
  }

  protected progress(key: TndEnvelopeKey) {
    return envelopeProgress(this.items(key));
  }

  protected issuesOf(key: TndEnvelopeKey): TndIssue[] {
    return (this.readiness()?.issues ?? []).filter((issue) => issue.envelope === key);
  }

  protected issueText(issue: TndIssue): string {
    return issueKey(issue);
  }

  protected itemColor(item: TndEnvelopeItem): string {
    switch (item.status) {
      case 'ok':
        return 'green';
      case 'uploaded':
        return 'blue';
      case 'signature_invalid':
        return 'red';
      default:
        return 'default';
    }
  }

  protected signatureColor(status: string): string {
    return status === 'valid' ? 'green' : status === 'invalid' ? 'red' : status === 'unsigned' ? 'orange' : 'default';
  }

  protected pick(envelope: TndEnvelopeKey, docKey: string, element: HTMLInputElement): void {
    const file = element.files?.item(0);
    if (file) {
      this.upload.emit({ envelope, docKey, file });
    }
    element.value = '';
  }
}
