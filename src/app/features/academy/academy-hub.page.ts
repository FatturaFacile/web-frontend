import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe, downloadBlob } from '@shared';
import { Mission, Track } from './academy.models';
import { AcademyStore } from './academy.store';
import { ContextualHelpDrawerComponent } from './contextual-help-drawer.component';
import { SpotlightTourEngineService } from './spotlight-tour-engine.service';

const POLL_INTERVAL_MS = 5000;

/** Academy hub: XP, learning tracks with their missions, guided tours, certificates and the help drawer. */
@Component({
  selector: 'app-academy-hub-page',
  imports: [
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    ContextualHelpDrawerComponent,
    NzButtonModule,
    NzCardModule,
    NzProgressModule,
    NzTagModule,
  ],
  styles: `
    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .tracks {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
    }
    ol.missions {
      list-style: none;
      padding: 0;
      margin: 12px 0 0;
    }
    ol.missions li {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-top: 1px solid var(--border-color, #f0f0f0);
    }
  `,
  template: `
    <app-page-header
      [title]="'ACADEMY.TITLE' | translate"
      [subtitle]="'ACADEMY.SUBTITLE' | translate"
    ></app-page-header>

    <div class="toolbar">
      <nz-tag nzColor="gold" data-testid="academy-xp"
        >{{ 'ACADEMY.XP' | translate }}: {{ store.totalXp() }}</nz-tag
      >
      <button nz-button type="button" (click)="store.openHelp()" data-testid="open-help">
        {{ 'ACADEMY.OPEN_HELP' | translate }}
      </button>
      <a nz-button routerLink="classroom" data-testid="open-classroom">{{
        'ACADEMY.CLASSROOM' | translate
      }}</a>
    </div>

    <section class="tracks" [attr.aria-busy]="store.loading()">
      @for (track of store.tracks(); track track.id) {
        <nz-card [nzTitle]="track.title" [attr.data-testid]="'track-' + track.code">
          <p>{{ track.description }}</p>
          <nz-progress [nzPercent]="track.completion_percent" nzSize="small"></nz-progress>
          <small
            >{{ track.missions_completed }} / {{ track.missions_total }} ·
            {{ track.xp_earned }} {{ 'ACADEMY.XP' | translate }}</small
          >
          @if (track.certificate_code) {
            <div>
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="store.busy()"
                (click)="downloadCertificate(track)"
                data-testid="download-certificate"
              >
                {{ 'ACADEMY.DOWNLOAD_CERTIFICATE' | translate }}
              </button>
            </div>
          }
          <ol class="missions">
            @for (mission of track.missions; track mission.id) {
              <li>
                <span>
                  {{ mission.sequence }}. {{ mission.title }}
                  @if (mission.requires_sandbox) {
                    <nz-tag>{{ 'ACADEMY.SANDBOX' | translate }}</nz-tag>
                  }
                  <nz-tag [nzColor]="mission.status === 'completed' ? 'green' : 'default'">{{
                    'ACADEMY.STATUS_' + mission.status.toUpperCase() | translate
                  }}</nz-tag>
                </span>
                @if (mission.status === 'completed') {
                  <span>+{{ mission.xp_reward }}</span>
                } @else {
                  <span>
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      [disabled]="store.busy()"
                      (click)="start(mission)"
                      [attr.data-testid]="'start-' + mission.code"
                    >
                      {{
                        (mission.status === 'started' ? 'ACADEMY.RESUME' : 'ACADEMY.START')
                          | translate
                      }}
                    </button>
                    @if (mission.status === 'started') {
                      <button nz-button nzSize="small" type="button" (click)="verify(mission)">
                        {{ 'ACADEMY.VERIFY' | translate }}
                      </button>
                    }
                  </span>
                }
              </li>
            }
          </ol>
        </nz-card>
      } @empty {
        @if (!store.loading()) {
          <p data-testid="academy-empty">{{ 'ACADEMY.NO_TRACKS' | translate }}</p>
        }
      }
    </section>

    <app-contextual-help-drawer />
  `,
})
export class AcademyHubPageComponent implements OnInit {
  protected readonly store = inject(AcademyStore);
  private readonly tour = inject(SpotlightTourEngineService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly pollingMission = signal<Mission['id'] | null>(null);
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  ngOnInit(): void {
    this.store.loadTracks().subscribe({ error: () => this.fail('ACADEMY.LOAD_ERROR') });
    this.store.loadProgress().subscribe({ error: () => undefined });
  }

  protected start(mission: Mission): void {
    this.store.startMission(mission.id).subscribe({
      next: (res) => {
        void this.tour.start(res.data.tour_steps ?? mission.tour_steps);
        this.startPolling(mission);
      },
      error: (error: unknown) => {
        // 422: the mission needs a Demo/Sandbox tenant and the current tenant is not one.
        if (error instanceof HttpErrorResponse && error.status === 422) {
          this.fail('ACADEMY.SANDBOX_REQUIRED');
        } else {
          this.fail('ACADEMY.START_ERROR');
        }
      },
    });
  }

  protected verify(mission: Mission): void {
    this.store.verifyStep(mission.id).subscribe({
      next: (res) => {
        if (res.data.completed) {
          this.stopPolling();
          this.message.success(this.i18n.instant('ACADEMY.MISSION_COMPLETED'));
        }
      },
      error: () => this.stopPolling(),
    });
  }

  protected downloadCertificate(track: Track): void {
    this.store.certificate(track.id).subscribe({
      next: (blob) => downloadBlob(blob, `certificate-${track.certificate_code}.pdf`),
      error: () => this.fail('ACADEMY.CERTIFICATE_ERROR'),
    });
  }

  private startPolling(mission: Mission): void {
    this.stopPolling();
    this.pollingMission.set(mission.id);
    this.pollTimer = setInterval(() => this.verify(mission), POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.pollingMission.set(null);
  }

  private fail(key: string): void {
    this.message.error(this.i18n.instant(key));
  }
}
