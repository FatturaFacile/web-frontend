import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { AuthStore } from '@core/auth/auth.store';
import { I18nService } from '@core/i18n/i18n.service';
import { catchError, finalize, Observable, of, tap } from 'rxjs';
import { AcademyApiService } from './academy-api.service';
import {
  AcademyProgress,
  ClassroomDashboard,
  Cohort,
  ContextualHelp,
  CreateCohortPayload,
  Mission,
  Track,
  VerifyStepResult,
} from './academy.models';
import { academyLocale } from './academy.utils';

type Id = number | string;

/**
 * Signal state of the Academy: contextual help of the current page, tracks and missions, progress, classroom.
 * Actions return the underlying observable (already wired to the signals), so a component only subscribes.
 */
@Service()
export class AcademyStore {
  private readonly api = inject(AcademyApiService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthStore);

  readonly help = signal<ContextualHelp | null>(null);
  /** Route the current `help` was requested for (also set when the server had none), to avoid repeat calls. */
  readonly helpRoute = signal<string | null>(null);
  readonly helpOpen = signal(false);
  readonly tracks = signal<Track[]>([]);
  readonly progress = signal<AcademyProgress | null>(null);
  readonly dashboard = signal<ClassroomDashboard | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);

  readonly fieldTooltips = computed(() => this.help()?.field_tooltips ?? {});
  readonly totalXp = computed(() => this.progress()?.total_xp ?? 0);
  readonly missionsCompleted = computed(() =>
    this.tracks().reduce((sum, t) => sum + t.missions_completed, 0),
  );

  locale(): string {
    return academyLocale(this.i18n.currentLanguage(), this.auth.activeJurisdiction());
  }

  /** Loads the help of a route; a 404 means "no help for this page" and clears it. */
  loadContextualHelp(route: string): Observable<unknown> {
    this.helpRoute.set(route);
    return this.api.contextualHelp(route, this.locale()).pipe(
      tap((res) => this.help.set(res.data)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.help.set(null);
          return of(null);
        }
        throw error;
      }),
    );
  }

  /** Loads the help only when it was not already requested for this route. */
  ensureContextualHelp(route: string): void {
    if (this.helpRoute() !== route) {
      this.loadContextualHelp(route).subscribe({ error: () => this.help.set(null) });
    }
  }

  openHelp(): void {
    this.helpOpen.set(true);
  }

  closeHelp(): void {
    this.helpOpen.set(false);
  }

  loadTracks(): Observable<unknown> {
    return this.track$(this.api.tracks()).pipe(tap((res) => this.tracks.set(res.data)));
  }

  loadProgress(): Observable<unknown> {
    return this.track$(this.api.progress()).pipe(tap((res) => this.progress.set(res.data)));
  }

  /** Starts a mission; the returned mission carries the tour steps. */
  startMission(id: Id): Observable<{ data: Mission }> {
    return this.act(this.api.startMission(id)).pipe(
      tap((res) => this.patchMission(id, { ...res.data, status: res.data.status ?? 'started' })),
    );
  }

  /** One poll: the server decides completion from ERP domain events (sandbox tenants only). */
  verifyStep(id: Id): Observable<{ data: VerifyStepResult }> {
    return this.api.verifyStep(id).pipe(
      tap((res) => {
        this.patchMission(id, { status: res.data.status });
        if (res.data.completed) {
          this.progress.update((p) =>
            p ? { ...p, total_xp: p.total_xp + res.data.xp_awarded } : p,
          );
          this.loadTracks().subscribe({ error: () => undefined });
        }
      }),
    );
  }

  certificate(trackId: Id): Observable<Blob> {
    return this.act(this.api.certificate(trackId, this.locale()));
  }

  createCohort(payload: CreateCohortPayload): Observable<{ data: Cohort }> {
    return this.act(this.api.createCohort(payload));
  }

  joinCohort(joinCode: string): Observable<{ data: Cohort }> {
    return this.act(this.api.joinCohort(joinCode));
  }

  loadDashboard(id: Id): Observable<unknown> {
    this.dashboard.set(null);
    return this.track$(this.api.cohortDashboard(id)).pipe(
      tap((res) => this.dashboard.set(res.data)),
    );
  }

  private patchMission(id: Id, patch: Partial<Mission>): void {
    this.tracks.update((tracks) =>
      tracks.map((t) => ({
        ...t,
        missions: t.missions.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      })),
    );
  }

  private track$<T>(source: Observable<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      this.loading.set(true);
      return source.pipe(finalize(() => this.loading.set(false))).subscribe(subscriber);
    });
  }

  private act<T>(source: Observable<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      this.busy.set(true);
      return source.pipe(finalize(() => this.busy.set(false))).subscribe(subscriber);
    });
  }
}
