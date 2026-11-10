import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AssociationAreaApiService, AssociationAreaMe, AssociationAreaProfile } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { FormsModule } from '@angular/forms';
import { AreaActivityComponent } from './area-activity.component';
import { AreaInstructorComponent } from './area-instructor.component';
import { AreaMoneyComponent } from './area-money.component';
import { AreaProfileComponent } from './area-profile.component';

/**
 * Member area of an association. The personal link carries `?token=`: the token is moved into memory and
 * removed from the address bar, then every call sends it in the `X-Area-Token` header.
 */
@Component({
  selector: 'app-association-area',
  imports: [
    AreaActivityComponent,
    AreaInstructorComponent,
    AreaMoneyComponent,
    AreaProfileComponent,
    FormsModule,
    NzAlertModule,
    NzRadioModule,
    NzSpinModule,
    NzTabsModule,
    TranslatePipe,
  ],
  template: `
    <main class="area">
      <h1>{{ 'ASSOC_AREA.TITLE' | translate }}</h1>
      @if (state() === 'missing') {
        <nz-alert nzType="warning" nzShowIcon [nzMessage]="'ASSOC_AREA.MISSING_TOKEN' | translate" />
      } @else if (state() === 'invalid') {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="'ASSOC_AREA.INVALID_TOKEN' | translate" />
      } @else if (state() === 'loading') {
        <nz-spin />
      } @else {
        @if (people().length > 1) {
          <nz-radio-group class="area-people" [ngModel]="selectedId()" (ngModelChange)="selectedId.set($event)">
            @for (person of people(); track person.id) {
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label nz-radio [nzValue]="person.id">{{ person.first_name }} {{ person.last_name }}</label>
            }
          </nz-radio-group>
        }
        @if (selected(); as person) {
          <nz-tabs>
            <nz-tab [nzTitle]="'ASSOC_AREA.PROFILE' | translate">
              <ng-template nz-tab>
                <app-area-profile [person]="person" [isSelf]="isSelf()" [contact]="isSelf() ? me()?.contact ?? null : null" (updated)="reload()" />
              </ng-template>
            </nz-tab>
            <nz-tab [nzTitle]="'ASSOC_AREA.FEES' | translate">
              <ng-template nz-tab><app-area-money [memberId]="person.id" /></ng-template>
            </nz-tab>
            <nz-tab [nzTitle]="'ASSOC_AREA.ACTIVITY' | translate">
              <ng-template nz-tab><app-area-activity [memberId]="person.id" [isWard]="!isSelf()" /></ng-template>
            </nz-tab>
            <nz-tab [nzTitle]="'ASSOC_AREA.INSTRUCTOR' | translate">
              <ng-template nz-tab><app-area-instructor /></ng-template>
            </nz-tab>
          </nz-tabs>
        } @else {
          <nz-alert nzType="info" nzShowIcon [nzMessage]="'ASSOC_AREA.NO_PROFILE' | translate" />
        }
      }
    </main>
  `,
  styles: `
    .area {
      margin: 0 auto;
      max-width: 960px;
      padding: 24px 16px;
    }

    .area-people {
      display: block;
      margin-bottom: 16px;
    }
  `,
})
export class AssociationAreaComponent implements OnInit {
  private readonly api = inject(AssociationAreaApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly state = signal<'loading' | 'missing' | 'invalid' | 'ready'>('loading');
  protected readonly me = signal<AssociationAreaMe | null>(null);
  protected readonly selectedId = signal<string | null>(null);

  /** The person of the link first, then the minors in care. */
  protected readonly people = computed<AssociationAreaProfile[]>(() => {
    const me = this.me();
    return me ? [...(me.profile ? [me.profile] : []), ...me.wards] : [];
  });
  protected readonly selected = computed(() => this.people().find((person) => person.id === this.selectedId()) ?? null);
  protected readonly isSelf = computed(() => this.selectedId() !== null && this.selectedId() === this.me()?.profile?.id);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.api.token.set(token);
      void this.router.navigate([], { queryParams: { token: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    if (!this.api.token()) {
      this.state.set('missing');
      return;
    }
    this.reload();
  }

  protected reload(): void {
    this.api.me().subscribe({
      next: (res) => {
        this.me.set(res.data);
        this.selectedId.update((current) => current ?? res.data.profile?.id ?? res.data.wards[0]?.id ?? null);
        this.state.set('ready');
      },
      error: () => this.state.set('invalid'),
    });
  }
}
