import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, UnrecoverableStateEvent, VersionReadyEvent } from '@angular/service-worker';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { filter, interval } from 'rxjs';
import { I18nService } from '../i18n';

/** Intervallo del controllo periodico di nuove versioni (6 ore). */
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Gestisce il ciclo di aggiornamento della PWA: controlla periodicamente (e al ritorno in primo piano)
 * la presenza di una nuova versione e propone all'utente di ricaricare l'applicazione.
 * Nessun effetto quando il service worker è disabilitato (dev mode, browser non supportati).
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly notification = inject(NzNotificationService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  private started = false;

  start(): void {
    if (this.started || !this.swUpdate.isEnabled) {
      return;
    }
    this.started = true;

    this.swUpdate.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.promptReload('PWA.UPDATE_AVAILABLE'));

    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((_event: UnrecoverableStateEvent) => this.promptReload('PWA.UPDATE_ERROR'));

    interval(UPDATE_CHECK_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.checkForUpdate());

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', this.onVisibilityChange));
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      void this.checkForUpdate();
    }
  };

  private async checkForUpdate(): Promise<void> {
    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      // Offline o errore transitorio: il prossimo controllo riproverà
    }
  }

  private promptReload(messageKey: string): void {
    const ref = this.notification.info(
      this.i18n.translate(messageKey),
      this.i18n.translate('PWA.UPDATE_RELOAD'),
      { nzDuration: 0, nzKey: 'pwa-update', nzPauseOnHover: false },
    );
    ref.onClick.subscribe(() => document.location.reload());
  }
}
