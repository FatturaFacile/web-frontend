import { Component, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@shared';
import { BatchVerification } from './digital-preservation.models';

/** Outcome of a live cryptographic verification of a batch: files, Merkle chain, RFC 3161 timestamp, audit chain. */
@Component({
  selector: 'app-verification-result',
  imports: [TranslatePipe, NzAlertModule, NzTagModule],
  template: `
    @let r = result();
    <nz-alert
      data-testid="verification-banner"
      [nzType]="r.ok ? 'success' : 'error'"
      nzShowIcon
      [nzMessage]="(r.ok ? 'PRESERVATION.VERIFY_OK' : 'PRESERVATION.VERIFY_FAILED') | translate"
      [nzDescription]="r.checked_files + ' ' + ('PRESERVATION.FILES_CHECKED' | translate)"
    ></nz-alert>
    <ul class="checks">
      <li>
        {{ 'PRESERVATION.CHECK_CHAIN' | translate }}
        <nz-tag [nzColor]="r.chain.ok ? 'green' : 'red'">{{
          (r.chain.ok ? 'PRESERVATION.OK' : 'PRESERVATION.FAIL') | translate
        }}</nz-tag>
      </li>
      <li>
        {{ 'PRESERVATION.CHECK_TIMESTAMP' | translate }}
        @if (r.timestamp.valid === null) {
          <nz-tag>{{ 'PRESERVATION.NOT_APPLICABLE' | translate }}</nz-tag>
        } @else {
          <nz-tag [nzColor]="r.timestamp.valid ? 'green' : 'red'">{{
            (r.timestamp.valid ? 'PRESERVATION.OK' : 'PRESERVATION.FAIL') | translate
          }}</nz-tag>
        }
      </li>
      <li>
        {{ 'PRESERVATION.CHECK_AUDIT_CHAIN' | translate }}
        <nz-tag [nzColor]="r.audit_chain.ok ? 'green' : 'red'">{{
          (r.audit_chain.ok ? 'PRESERVATION.OK' : 'PRESERVATION.FAIL') | translate
        }}</nz-tag>
      </li>
    </ul>
    @if (r.failures.length > 0) {
      <h4>{{ 'PRESERVATION.FAILURES' | translate }}</h4>
      <ul data-testid="verification-failures">
        @for (f of r.failures; track $index) {
          <li>
            <strong>{{ f.type }}</strong> — {{ f.reference }}<br />
            <code>{{ f.expected }}</code> ≠ <code>{{ f.actual }}</code>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .checks {
      list-style: none;
      padding: 0;
      margin: 12px 0;
    }
    .checks li {
      padding: 4px 0;
    }
    code {
      font-size: 12px;
      word-break: break-all;
    }
  `,
})
export class VerificationResultComponent {
  readonly result = input.required<BatchVerification>();
}
