import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GelatoApiService, GelatoBook, GelatoLocale, GelatoRecipe, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { gelatoProblem, localizedName, qrMenuUrl } from './gelato.util';

/**
 * The showcase board: the 16 or 24 wells configurator, the live TV mode, the tablet selector and the QR-ready allergen book
 * (ingredients by descending weight, the 14 allergens, gluten-free / lactose-free / vegan badges, the defrosted notice) with
 * live IT / DE / FR / EN switching.
 */
@Component({
  selector: 'app-gelato-showcase',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzRadioModule,
    NzSelectModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'GELATO.SHOWCASE.TITLE' | translate">
      <nz-radio-group [ngModel]="locale()" (ngModelChange)="locale.set($event)">
        @for (l of locales; track l) {
          <label nz-radio-button [nzValue]="l">{{ l.toUpperCase() }}</label>
        }
      </nz-radio-group>
      <button nz-button (click)="tv.set(!tv())">{{ 'GELATO.SHOWCASE.TV' | translate }}</button>
    </app-page-header>

    @if (!tv()) {
      <nz-card>
        <nz-radio-group [ngModel]="slotCount()" (ngModelChange)="slotCount.set($event)">
          <label nz-radio-button [nzValue]="16">16</label>
          <label nz-radio-button [nzValue]="24">24</label>
        </nz-radio-group>
        <div class="slots">
          @for (n of slotNumbers(); track n) {
            <label class="slot">
              {{ 'GELATO.SHOWCASE.SLOT' | translate: { n: n } }}
              <nz-select nzAllowClear [ngModel]="slots()[n] ?? null" (ngModelChange)="setSlot(n, $event)">
                @for (recipe of recipes(); track recipe.id) {
                  <nz-option [nzValue]="recipe.id" [nzLabel]="name(recipe)" />
                }
              </nz-select>
            </label>
          }
        </div>
        <button nz-button nzType="primary" (click)="publish()">{{ 'GELATO.SHOWCASE.PUBLISH' | translate }}</button>
      </nz-card>
    }

    @if (book(); as b) {
      <p>
        {{ 'GELATO.SHOWCASE.VERSION' | translate: { version: b.version } }} ·
        {{ 'GELATO.SHOWCASE.QR' | translate }}: <code>{{ qrUrl() }}</code>
      </p>
      <div class="board" [class.tv]="tv()">
        @for (slot of currentSlots(); track slot.slot_number) {
          <nz-card nzSize="small" [nzTitle]="slot.name">
            <div>
              @if (slot.gluten_free) { <nz-tag nzColor="green">{{ 'GELATO.SHOWCASE.GLUTEN_FREE' | translate }}</nz-tag> }
              @if (slot.lactose_free) { <nz-tag nzColor="green">{{ 'GELATO.SHOWCASE.LACTOSE_FREE' | translate }}</nz-tag> }
              @if (slot.vegan) { <nz-tag nzColor="green">{{ 'GELATO.SHOWCASE.VEGAN' | translate }}</nz-tag> }
              @if (slot.defrosted_notice) { <nz-tag nzColor="blue">{{ slot.defrosted_notice }}</nz-tag> }
            </div>
            <small>{{ 'GELATO.SHOWCASE.INGREDIENTS' | translate }}</small>
            <p>
              @for (ingredient of slot.ingredients; track ingredient.ingredient_id; let last = $last) {
                <span [class.allergen]="ingredient.allergens.length > 0">{{ ingredient.name }}</span>{{ last ? '' : ', ' }}
              }
            </p>
            @if (slot.allergens.length > 0) {
              <small>{{ 'GELATO.SHOWCASE.ALLERGENS' | translate }}:</small>
              @for (allergen of slot.allergens; track allergen.code) {
                <nz-tag nzColor="red">{{ allergen.name }}</nz-tag>
              }
            }
          </nz-card>
        }
      </div>
    } @else {
      <nz-card>{{ 'GELATO.SHOWCASE.NOT_PUBLISHED' | translate }}</nz-card>
    }
  `,
  styles: `
    .slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin: 12px 0; }
    .slot { display: flex; flex-direction: column; gap: 4px; }
    .board { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .board.tv { grid-template-columns: repeat(4, 1fr); font-size: 1.25rem; }
    .allergen { font-weight: 700; text-transform: uppercase; }
  `,
})
export class GelatoShowcaseComponent implements OnInit, OnDestroy {
  private readonly api = inject(GelatoApiService);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);
  private refresh: ReturnType<typeof setInterval> | null = null;

  readonly locationKey = 'main';
  readonly locales: readonly GelatoLocale[] = ['it', 'de', 'fr', 'en'];
  readonly locale = signal<GelatoLocale>('it');
  readonly tv = signal(false);
  readonly slotCount = signal<16 | 24>(16);
  readonly recipes = signal<GelatoRecipe[]>([]);
  readonly slots = signal<Record<number, string | null>>({});
  readonly book = signal<GelatoBook | null>(null);

  readonly slotNumbers = computed(() => Array.from({ length: this.slotCount() }, (_, i) => i + 1));
  readonly currentSlots = computed(() => this.book()?.books[this.locale()]?.slots ?? []);
  readonly qrUrl = computed(() => qrMenuUrl(window.location.origin, this.locationKey, this.locale()));

  ngOnInit(): void {
    this.translate.currentLanguage();
    this.api.getRecipes().subscribe({ next: (response) => this.recipes.set(response.data) });
    this.loadBook();
    // The TV board keeps itself up to date with the last published book.
    this.refresh = setInterval(() => this.loadBook(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.refresh) clearInterval(this.refresh);
  }

  name(recipe: GelatoRecipe): string {
    return localizedName(recipe.name, this.locale());
  }

  setSlot(slot: number, recipeId: string | null): void {
    this.slots.update((slots) => ({ ...slots, [slot]: recipeId }));
  }

  loadBook(): void {
    this.api.getBook(this.locationKey).subscribe({
      next: (response) => this.book.set(response.data),
      error: () => this.book.set(null),
    });
  }

  publish(): void {
    const slots = Object.entries(this.slots())
      .filter((entry): entry is [string, string] => !!entry[1])
      .map(([slot, recipe_id]) => ({ slot_number: Number(slot), recipe_id }));
    if (slots.length === 0) return;
    this.api.publishShowcase(this.locationKey, slots, 'IT').subscribe({
      next: () => this.loadBook(),
      error: (error) => this.message.error(gelatoProblem(error, this.translate.instant('GELATO.LOAD_ERROR'))),
    });
  }
}
