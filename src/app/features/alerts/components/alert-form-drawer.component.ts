import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AlertsApiService, AlertResource, AlertSeverity } from '@core';

@Component({
  selector: 'app-alert-form-drawer',
  imports: [
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzDatePickerModule,
    NzButtonModule,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      [nzTitle]="alert() ? 'Modifica Avviso' : 'Crea Nuovo Avviso'"
      [nzWidth]="500"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="title">Titolo Avviso</nz-form-label>
            <nz-form-control nzErrorTip="Il titolo è obbligatorio">
              <input
                nz-input
                id="title"
                formControlName="title"
                placeholder="Es. Scadenza IVA Trimestrale..."
              />
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzFor="severity">Livello di Gravità</nz-form-label>
            <nz-form-control>
              <nz-select id="severity" formControlName="severity">
                <nz-option nzValue="info" nzLabel="Informativo (Blu)" />
                <nz-option nzValue="warning" nzLabel="Attenzione (Arancione)" />
                <nz-option nzValue="critical" nzLabel="Critico / Bloccante (Rosso)" />
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzFor="message">Messaggio Dettagliato</nz-form-label>
            <nz-form-control>
              <textarea
                nz-input
                id="message"
                formControlName="message"
                rows="4"
                placeholder="Inserisci ulteriori dettagli sull'avviso..."
              ></textarea>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzFor="is_active">Stato Attivo</nz-form-label>
            <nz-form-control>
              <nz-switch id="is_active" formControlName="is_active" />
            </nz-form-control>
          </nz-form-item>

          <div class="footer-actions">
            <button nz-button type="button" (click)="open.set(false)">Annulla</button>
            <button nz-button nzType="primary" type="submit" [nzLoading]="isSaving()">
              Salva Avviso
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;
    }
  `,
})
export class AlertFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(AlertsApiService);
  private readonly message = inject(NzMessageService);

  readonly open = model.required<boolean>();
  readonly alert = input<AlertResource | null>(null);
  readonly saved = output<void>();

  protected readonly isSaving = signal(false);

  protected readonly form = this.fb.group({
    title: this.fb.control<string>('', [Validators.required, Validators.maxLength(255)]),
    severity: this.fb.control<AlertSeverity>('info'),
    message: this.fb.control<string>(''),
    is_active: this.fb.control<boolean>(true),
  });

  constructor() {
    effect(() => {
      const a = this.alert();
      if (a) {
        this.form.patchValue({
          title: a.title,
          severity: a.severity || 'info',
          message: a.message || '',
          is_active: a.is_active ?? true,
        });
      } else {
        this.form.reset({
          title: '',
          severity: 'info',
          message: '',
          is_active: true,
        });
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const val = this.form.getRawValue();

    const payload = {
      title: val.title,
      severity: val.severity,
      message: val.message || null,
      is_active: val.is_active,
    };

    const current = this.alert();
    const req$ = current
      ? this.api.updateAlert(current.id, payload)
      : this.api.createAlert(payload);

    req$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.message.success(current ? 'Avviso aggiornato' : 'Avviso creato');
        this.open.set(false);
        this.saved.emit();
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }
}
