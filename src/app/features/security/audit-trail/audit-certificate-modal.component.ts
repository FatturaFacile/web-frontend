import { Component, input, model } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { AuditVerificationCertificate } from '@core';
import { TranslatePipe } from '@shared';

/** The verification in progress, then the signed Forensic Verification Certificate. */
@Component({
  selector: 'app-audit-certificate-modal',
  styleUrl: './audit-trail.scss',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzModalModule,
    NzProgressModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'AUDIT.CERT.TITLE' | translate"
      nzWidth="720px"
      [nzFooter]="footer"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        @if (verifying()) {
          <p>{{ 'AUDIT.INTEGRITY.VERIFYING' | translate }}</p>
          <nz-progress [nzPercent]="100" nzStatus="active" [nzShowInfo]="false"></nz-progress>
        } @else if (certificate(); as cert) {
          <nz-alert
            [nzType]="cert.isValid ? 'success' : 'error'"
            nzShowIcon
            [nzMessage]="
              (cert.isValid ? 'AUDIT.INTEGRITY.VALID' : 'AUDIT.INTEGRITY.BROKEN') | translate
            "
            class="banner"
          ></nz-alert>
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'AUDIT.CERT.CHECKED' | translate">
              <strong>{{ cert.checkedRecords }}</strong>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'AUDIT.CERT.FIRST_SEQUENCE' | translate">{{
              cert.firstSequence ?? '-'
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'AUDIT.CERT.LAST_SEQUENCE' | translate">{{
              cert.lastSequence ?? '-'
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'AUDIT.INTEGRITY.MERKLE_ROOT' | translate">
              <span class="mono">{{ cert.merkleRoot ?? '-' }}</span>
            </nz-descriptions-item>
            @if (!cert.isValid) {
              <nz-descriptions-item [nzTitle]="'AUDIT.CERT.BROKEN_AT' | translate">
                <strong>{{ cert.brokenAtSequence }}</strong>
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'AUDIT.CERT.REASON' | translate">{{
                cert.failureReason
              }}</nz-descriptions-item>
            }
            <nz-descriptions-item [nzTitle]="'AUDIT.CERT.VERIFIED_AT' | translate">
              <span class="mono">{{ cert.verifiedAt }}</span>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'AUDIT.CERT.SIGNATURE' | translate">
              <span class="mono">{{ cert.signature }}</span>
            </nz-descriptions-item>
          </nz-descriptions>
        }
      </ng-container>
      <ng-template #footer>
        <button nz-button nzType="primary" (click)="open.set(false)">
          {{ 'AUDIT.CERT.CLOSE' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class AuditCertificateModalComponent {
  readonly open = model(false);
  readonly verifying = input(false);
  readonly certificate = input<AuditVerificationCertificate | null>(null);
}
