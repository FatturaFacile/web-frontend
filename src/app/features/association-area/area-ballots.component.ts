import { Component, inject, OnInit, signal } from '@angular/core';
import { AssociationAreaApiService, AssociationAreaBallot, I18nService } from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';

/** Open ballots of the assemblies: the member votes for herself and, where she holds proxies, for the people she represents. */
@Component({
  selector: 'app-area-ballots',
  styles: [
    '.ballot { padding: 12px 0; border-bottom: 1px solid var(--border-color, #f0f0f0); } .voter { margin: 8px 0; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; } .secret { color: var(--text-secondary); }',
  ],
  imports: [NzButtonModule, NzEmptyModule, NzPopconfirmModule],
  template: `
    @if (ballots().length === 0) {
      <nz-empty [nzNotFoundContent]="text('ASSOC_AREA.NO_BALLOTS', 'Nessuna votazione aperta')" />
    }
    @for (ballot of ballots(); track ballot.id) {
      <section class="ballot">
        <h3>{{ ballot.question }}</h3>
        @if (ballot.is_secret) {
          <p class="secret">{{ text('ASSOC_AREA.SECRET_BALLOT', 'Votazione a scrutinio segreto') }}</p>
        }
        @if (ballot.can_vote_self) {
          <div class="voter">
            <strong>{{ text('ASSOC_AREA.VOTE_SELF', 'Il tuo voto') }}</strong>
            @for (option of ballot.options; track option) {
              <button
                nz-button
                nz-popconfirm
                type="button"
                [nzPopconfirmTitle]="text('ASSOC_AREA.VOTE_CONFIRM', 'Confermi il voto? Non sarà modificabile.')"
                (nzOnConfirm)="vote(ballot, option)"
              >
                {{ option }}
              </button>
            }
          </div>
        }
        @for (participant of ballot.can_vote_for; track participant; let i = $index) {
          <div class="voter">
            <strong>{{ text('ASSOC_AREA.VOTE_PROXY', 'Per delega') }} {{ i + 1 }}</strong>
            @for (option of ballot.options; track option) {
              <button
                nz-button
                nz-popconfirm
                type="button"
                [nzPopconfirmTitle]="text('ASSOC_AREA.VOTE_CONFIRM', 'Confermi il voto? Non sarà modificabile.')"
                (nzOnConfirm)="vote(ballot, option, participant)"
              >
                {{ option }}
              </button>
            }
          </div>
        }
      </section>
    }
  `,
})
export class AreaBallotsComponent implements OnInit {
  private readonly api = inject(AssociationAreaApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly ballots = signal<AssociationAreaBallot[]>([]);

  ngOnInit(): void {
    this.load();
  }

  protected text(key: string, fallback: string): string {
    const translated = this.i18n.translate(key);
    return translated === key ? fallback : translated;
  }

  protected vote(ballot: AssociationAreaBallot, choice: string, onBehalfOf?: string): void {
    this.api.voteBallot(ballot.id, choice, onBehalfOf).subscribe({
      next: () => {
        this.message.success(this.text('ASSOC_AREA.VOTE_RECORDED', 'Voto registrato'));
        this.load();
      },
      error: () => this.message.error(this.text('ASSOC_AREA.VOTE_FAILED', 'Voto non registrato')),
    });
  }

  private load(): void {
    this.api.ballots().subscribe({ next: (res) => this.ballots.set(res.data), error: () => this.ballots.set([]) });
  }
}
