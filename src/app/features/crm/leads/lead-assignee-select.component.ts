import { Component, computed, inject, input, model, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { LeadAssigneeDirectory } from './lead-assignee-directory';

/**
 * Assignee picker backed by the tenant users list; falls back to a free-text
 * user id (comma separated in multiple mode) when users cannot be listed.
 */
@Component({
  selector: 'app-lead-assignee-select',
  imports: [FormsModule, NzSelectModule, NzInputModule],
  template: `
    @if (directory.available()) {
      <nz-select
        class="full"
        nzShowSearch
        nzAllowClear
        [nzMode]="multiple() ? 'multiple' : 'default'"
        [nzPlaceHolder]="placeholder()"
        [attr.aria-label]="label()"
        [nzOptions]="options()"
        [ngModel]="multiple() ? ids() : single()"
        (ngModelChange)="onSelect($event)"
      />
    } @else {
      <input
        nz-input
        class="full"
        type="text"
        [attr.aria-label]="label()"
        [placeholder]="placeholder()"
        [ngModel]="text()"
        (ngModelChange)="onText($event)"
      />
    }
  `,
  styles: `
    .full {
      width: 100%;
    }
  `,
})
export class LeadAssigneeSelectComponent implements OnInit {
  protected readonly directory = inject(LeadAssigneeDirectory);

  readonly multiple = input(false);
  readonly label = input('Assignee');
  readonly placeholder = input('');
  /** Single mode: one user id. */
  readonly value = model<string | null>(null);
  /** Multiple mode: user ids. */
  readonly ids = model<string[]>([]);

  protected readonly options = computed(() =>
    this.directory.users().map((u) => ({ label: `${u.name} (${u.email})`, value: u.id })),
  );

  protected readonly single = computed(() => this.value() ?? null);

  protected readonly text = computed(() => (this.multiple() ? this.ids().join(', ') : (this.value() ?? '')));

  ngOnInit(): void {
    this.directory.load();
  }

  protected onSelect(v: string | string[] | null): void {
    if (this.multiple()) {
      this.ids.set(Array.isArray(v) ? v : []);
    } else {
      this.value.set(typeof v === 'string' && v ? v : null);
    }
  }

  protected onText(v: string): void {
    if (this.multiple()) {
      this.ids.set(
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else {
      this.value.set(v.trim() || null);
    }
  }
}
