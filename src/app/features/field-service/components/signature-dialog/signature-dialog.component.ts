import { Component, computed, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { SignaturePadComponent, TranslatePipe, IconActionDirective, ModalActionsDirective } from '@shared';

export interface SignatureResult {
  signerName: string;
  signerRole: string;
  signerEmail: string;
  signature: string;
}

/** Modal that collects the signer details and a touchscreen signature. */
@Component({
  selector: 'app-signature-dialog',
  styleUrl: './signature-dialog.component.scss',
  imports: [FormsModule, NzModalModule, NzInputModule, NzButtonModule, SignaturePadComponent, TranslatePipe, IconActionDirective, ModalActionsDirective],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="titleKey() | translate"
      [nzFooter]="footer"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <label class="sd-label" for="sd-name">{{ 'SIGNATURE.SIGNER_NAME' | translate }}</label>
        <input id="sd-name" nz-input maxlength="150" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        @if (withContact()) {
          <label class="sd-label" for="sd-role">{{ 'SIGNATURE.SIGNER_ROLE' | translate }}</label>
          <input id="sd-role" nz-input maxlength="100" [ngModel]="role()" (ngModelChange)="role.set($event)" />
          <label class="sd-label" for="sd-email">{{ 'SIGNATURE.SIGNER_EMAIL' | translate }}</label>
          <input id="sd-email" nz-input type="email" maxlength="180" [ngModel]="email()" (ngModelChange)="email.set($event)" />
        }
        <p class="sd-label">{{ 'SIGNATURE.SIGNATURE' | translate }}</p>
        <app-signature-pad (signatureChange)="signature.set($event)" />
      </ng-container>
      <ng-template #footer>
        <button nz-button type="button" appIconAction="cancel" (click)="open.set(false)"></button>
        <button nz-button nzType="primary" type="button" appIconAction="confirm" [nzLoading]="saving()" [disabled]="!valid()" (click)="confirm()"></button>
      </ng-template>
    </nz-modal>
  `,
})
export class SignatureDialogComponent {
  readonly open = model.required<boolean>();
  readonly titleKey = input('SIGNATURE.TITLE');
  readonly withContact = input(false);
  readonly saving = input(false);
  readonly confirmed = output<SignatureResult>();

  protected readonly name = signal('');
  protected readonly role = signal('');
  protected readonly email = signal('');
  protected readonly signature = signal<string | null>(null);
  protected readonly valid = computed(() => this.name().trim().length > 0 && this.signature() !== null);

  protected confirm(): void {
    const signature = this.signature();
    if (!this.valid() || signature === null) {
      return;
    }
    this.confirmed.emit({
      signerName: this.name().trim(),
      signerRole: this.role().trim(),
      signerEmail: this.email().trim(),
      signature,
    });
  }
}
