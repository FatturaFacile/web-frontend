import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import type { CopilotMessage } from './copilot.models';
import { CopilotStore } from './copilot.store';
import { coerceLike, getByPath } from './copilot-action-path';

/** Human-in-the-loop card: review, edit the allowed fields, then confirm and execute or cancel a proposed action. */
@Component({
  selector: 'app-copilot-action-card',
  imports: [NzButtonModule, NzInputModule, NzTagModule, TranslatePipe],
  template: `
    @if (action(); as a) {
      <section class="cp-action" data-testid="copilot-action-card" [attr.aria-label]="'COPILOT.ACTION.TITLE' | translate">
        <header>
          <nz-tag [nzColor]="statusColor()" data-testid="copilot-action-status">{{ statusKey() | translate }}</nz-tag>
          <strong>{{ a.summary }}</strong>
        </header>
        @if (detailEntries().length > 0) {
          <dl class="cp-details">
            @for (d of detailEntries(); track d[0]) {
              <dt>{{ d[0] }}</dt>
              <dd>{{ d[1] }}</dd>
            }
          </dl>
        }
        @if (isPending() && fields().length > 0) {
          <div class="cp-fields">
            @for (f of fields(); track f.path) {
              <label>
                <span>{{ f.path }}</span>
                <input
                  nz-input
                  nzSize="small"
                  [value]="f.draft"
                  [disabled]="busy()"
                  (input)="edit(f.path, $any($event.target).value)"
                  [attr.data-testid]="'copilot-field-' + f.path"
                />
              </label>
            }
          </div>
        }
        @if (a.error) {
          <p class="cp-error" role="alert">{{ a.error }}</p>
        }
        @if (isPending()) {
          <div class="cp-buttons">
            <button nz-button nzType="primary" type="button" [nzLoading]="busy()" [disabled]="busy() || hasInvalid()" (click)="confirm()" data-testid="copilot-confirm">
              {{ 'COPILOT.ACTION.CONFIRM' | translate }}
            </button>
            <button nz-button type="button" [disabled]="busy()" (click)="cancel()" data-testid="copilot-cancel">{{ 'COPILOT.ACTION.CANCEL' | translate }}</button>
          </div>
        }
        @if (a.result; as r) {
          <p class="cp-result" data-testid="copilot-action-result">
            @if (r.route) {
              <a [href]="r.route" (click)="open($event, r.route)">{{ r.label ?? ('COPILOT.ACTION.OPEN_RESULT' | translate) }}</a>
            } @else {
              {{ r.label }}
            }
          </p>
        }
      </section>
    }
  `,
  styles: `
    .cp-action { margin-top: 8px; padding: 8px; border: 1px solid var(--ff-color-border-subtle); border-radius: 8px; background: var(--ff-color-surface-raised); }
    header { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .cp-details { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; margin: 8px 0; font-size: 12px; }
    dt { opacity: 0.7; } dd { margin: 0; overflow-wrap: anywhere; }
    .cp-fields { display: grid; gap: 4px; margin: 8px 0; }
    .cp-fields label { display: grid; gap: 2px; font-size: 12px; }
    .cp-buttons { display: flex; gap: 8px; }
    .cp-error { margin: 8px 0 0; color: var(--ff-color-danger, #cf1322); }
  `,
})
export class CopilotActionCardComponent {
  readonly message = input.required<CopilotMessage>();
  private readonly store = inject(CopilotStore);
  private readonly router = inject(Router);

  private readonly drafts = signal<Record<string, string>>({});

  protected readonly action = computed(() => this.message().proposed_action);
  protected readonly status = computed(() => this.message().action_status ?? this.action()?.status ?? 'pending');
  protected readonly isPending = computed(() => this.status() === 'pending');
  protected readonly busy = computed(() => this.store.busyActionIds().has(this.message().id));
  protected readonly statusKey = computed(() => `COPILOT.ACTION.STATUS_${this.status().toUpperCase()}`);
  protected readonly statusColor = computed(() => {
    switch (this.status()) {
      case 'executed':
        return 'green';
      case 'failed':
      case 'rejected':
        return 'red';
      default:
        return 'gold';
    }
  });

  protected readonly detailEntries = computed(() =>
    Object.entries(this.action()?.details ?? {}).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)] as const),
  );

  protected readonly fields = computed(() => {
    const a = this.action();
    const drafts = this.drafts();

    return (a?.editable_fields ?? []).map((path) => {
      const original = getByPath(a?.arguments, path);

      return { path, original, draft: drafts[path] ?? String(original ?? '') };
    });
  });

  protected readonly overrides = computed(() => {
    const out: Record<string, unknown> = {};
    for (const f of this.fields()) {
      if (f.draft !== String(f.original ?? '')) {
        out[f.path] = coerceLike(f.original, f.draft);
      }
    }

    return out;
  });

  protected readonly hasInvalid = computed(() => Object.values(this.overrides()).some((v) => typeof v === 'number' && Number.isNaN(v)));

  edit(path: string, value: string): void {
    this.drafts.update((d) => ({ ...d, [path]: value }));
  }

  confirm(): void {
    if (this.busy() || this.hasInvalid()) return;
    void this.store.confirmAction(this.message().id, this.overrides());
  }

  cancel(): void {
    if (this.busy()) return;
    void this.store.rejectAction(this.message().id);
  }

  open(event: Event, route: string): void {
    event.preventDefault();
    void this.router.navigateByUrl(route);
  }
}
