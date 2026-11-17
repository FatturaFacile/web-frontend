import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { Subscription } from 'rxjs';
import { CandidateCv, RecruitingApiService } from '@core';
import { TranslatePipe } from '@shared';

/**
 * CV preview: fetches the authenticated CV as a blob. PDFs render inline in an
 * iframe over an app-created `blob:` URL; doc/docx offer a download link.
 */
@Component({
  selector: 'app-cv-viewer',
  imports: [NzButtonModule, NzEmptyModule, NzSpinModule, TranslatePipe],
  template: `
    <section class="cv" [attr.aria-label]="'hr.recruiting.candidate.cv' | translate">
      @if (!cv()) {
        <nz-empty [nzNotFoundContent]="'hr.recruiting.candidate.noCv' | translate" />
      } @else if (error()) {
        <div class="cv__error" role="alert">
          <p>{{ 'hr.recruiting.candidate.cvLoadFailed' | translate }}</p>
          <button nz-button type="button" (click)="load()">
            {{ 'hr.recruiting.actions.retry' | translate }}
          </button>
        </div>
      } @else {
        <nz-spin [nzSpinning]="loading()">
          <div class="cv__toolbar">
            <span class="cv__name">{{ cv()!.file_name }}</span>
            @if (blobUrl()) {
              <a nz-button nzSize="small" [href]="blobUrl()" [attr.download]="cv()!.file_name">
                <i class="fa-solid fa-download" aria-hidden="true"></i>
                {{ 'hr.recruiting.candidate.downloadCv' | translate }}
              </a>
            }
          </div>
          @if (isPdf() && safeUrl()) {
            <iframe
              class="cv__frame"
              [src]="safeUrl()"
              [title]="
                'hr.recruiting.candidate.cvPreviewTitle' | translate: { file: cv()!.file_name }
              "
            ></iframe>
          } @else if (!isPdf()) {
            <p class="cv__note">{{ 'hr.recruiting.candidate.cvNoPreview' | translate }}</p>
          }
        </nz-spin>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .cv {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .cv__toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .cv__name {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .cv__frame {
      width: 100%;
      min-height: 70vh;
      border: 1px solid #d9d9d9;
      border-radius: 6px;
    }
    .cv__error {
      color: #a8071a;
    }
  `,
})
export class CvViewerComponent {
  private readonly api = inject(RecruitingApiService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly applicationId = input.required<string>();
  readonly cv = input<CandidateCv | null>(null);

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly blobUrl = signal<string | null>(null);
  readonly isPdf = computed(() => this.cv()?.mime_type === 'application/pdf');

  /** Identity of the CV to show; reloading the application with the same CV does not refetch. */
  private readonly cvKey = computed(() => {
    const cv = this.cv();
    return cv
      ? `${this.applicationId()}|${cv.download_url}|${cv.file_name}|${cv.size_bytes}`
      : null;
  });

  /**
   * Only `blob:` URLs created by this component are trusted as resource URLs.
   */
  readonly safeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.blobUrl();
    return url && url.startsWith('blob:')
      ? this.sanitizer.bypassSecurityTrustResourceUrl(url)
      : null;
  });

  private request?: Subscription;

  constructor() {
    effect(() => {
      const key = this.cvKey();
      untracked(() => {
        if (key) {
          this.load();
        } else {
          this.reset();
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.reset());
  }

  load(): void {
    this.reset();
    this.loading.set(true);
    this.error.set(false);
    this.request = this.api.getCv(this.applicationId()).subscribe({
      next: (blob) => {
        this.loading.set(false);
        this.blobUrl.set(URL.createObjectURL(blob));
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  private reset(): void {
    this.request?.unsubscribe();
    const url = this.blobUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.blobUrl.set(null);
    }
  }
}
