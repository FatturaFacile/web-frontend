import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AbTestConfig,
  CatalogProduct,
  EMAIL_BLOCK_TYPES,
  EmailBlock,
  EmailBlockType,
  EmailTemplate,
  I18nService,
  LocalizedText,
  MARKETING_LOCALES,
  MarketingBlueprint,
  MarketingCampaign,
  MarketingLocale,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { MarketingNavComponent } from './marketing-nav.component';
import { MarketingAutomationStore } from './marketing-automation.store';
import {
  asMarketingLocale,
  blueprintText,
  insertItem,
  localized,
  missingLocales,
  moveItem,
  newBlock,
  productBlockFromCatalog,
  removeItem,
  setBlockProp,
  setBlockText,
  splitIsValid,
} from './marketing-automation.util';

/** What travels with a drag: a new block from the palette, a block of the canvas, or a catalog product. */
type DragPayload =
  | { kind: 'palette'; type: EmailBlockType }
  | { kind: 'block'; index: number }
  | { kind: 'product'; product: CatalogProduct };

const DRAG_TYPE = 'application/x-marketing-designer';

/** Properties edited as one text per language. */
const TEXT_PROPS: Readonly<Record<EmailBlockType, readonly string[]>> = {
  heading: ['text'],
  text: ['text'],
  image: ['alt'],
  button: ['label'],
  divider: [],
  spacer: [],
  product: ['name', 'description', 'cta_label'],
  html: [],
};

/** Plain properties (one value for every language) of each block type. */
const PLAIN_PROPS: Readonly<Record<EmailBlockType, readonly string[]>> = {
  heading: [],
  text: [],
  image: ['src', 'href'],
  button: ['href'],
  divider: [],
  spacer: ['height'],
  product: ['image_url', 'url', 'currency'],
  html: ['html'],
};

/**
 * Visual drag-and-drop e-mail designer (MJML): blocks from the palette, the "Drag Product from ERP Catalog" block that
 * imports image, description and price of a product, locale switching, A/B variants and an HTML preview.
 */
@Component({
  selector: 'app-email-designer',
  imports: [
    DecimalPipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    MarketingNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'marketing.designer.title' | translate"
      [subtitle]="'marketing.designer.subtitle' | translate"
    />
    <app-marketing-nav activeTab="designer" />

    @if (store.errorCode(); as code) {
      <p class="mb-4 text-red-600" role="alert">
        {{ code | translate }}
        @for (detail of store.errorDetails(); track detail) {
          <span class="block text-sm">{{ detail }}</span>
        }
      </p>
    }

    <div class="mb-4 flex flex-wrap items-end gap-4">
      <div class="min-w-64">
        <label class="mb-1 block text-xs font-medium" for="dsg-campaign">{{ 'marketing.designer.campaign' | translate }}</label>
        <nz-select nzId="dsg-campaign" class="w-full" [ngModel]="store.selectedCampaign()?.id ?? null" (ngModelChange)="pickCampaign($event)">
          @for (campaign of store.campaigns(); track campaign.id) {
            <nz-option [nzValue]="campaign.id" [nzLabel]="campaign.name" />
          }
        </nz-select>
      </div>
      <div class="min-w-64">
        <label class="mb-1 block text-xs font-medium" for="dsg-template">{{ 'marketing.designer.start_template' | translate }}</label>
        <nz-select nzId="dsg-template" class="w-full" nzAllowClear [ngModel]="null" (ngModelChange)="applyTemplate($event)">
          @for (template of store.templates(); track template.code) {
            <nz-option [nzValue]="template.code" [nzLabel]="templateName(template)" />
          }
        </nz-select>
      </div>
      <div role="group" [attr.aria-label]="'marketing.designer.locale' | translate" class="flex gap-1">
        @for (item of locales; track item) {
          <button nz-button [nzType]="locale() === item ? 'primary' : 'default'" [attr.aria-pressed]="locale() === item" (click)="locale.set(item)">
            {{ item.toUpperCase() }}
          </button>
        }
      </div>
    </div>

    @if (store.selectedCampaign(); as campaign) {
      @if (warnings().length > 0) {
        <p class="mb-3 text-amber-600" role="status" data-testid="missing-locales">
          {{ 'marketing.designer.missing_locales' | translate }}: {{ warnings().join(', ').toUpperCase() }}
        </p>
      }

      <div class="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_22rem]">
        <aside class="flex flex-col gap-4">
          <nz-card nzSize="small" [nzTitle]="'marketing.designer.palette' | translate">
            <div class="flex flex-col gap-2">
              @for (type of blockTypes; track type) {
                <button
                  nz-button
                  type="button"
                  draggable="true"
                  (dragstart)="dragPalette($event, type)"
                  (click)="addBlock(type)"
                >
                  {{ 'marketing.block.' + type | translate }}
                </button>
              }
            </div>
          </nz-card>

          <nz-card nzSize="small" [nzTitle]="'marketing.designer.catalog_block' | translate">
            <label class="mb-1 block text-xs font-medium" for="dsg-search">{{ 'marketing.designer.catalog_search' | translate }}</label>
            <input nz-input id="dsg-search" [ngModel]="term()" (ngModelChange)="search($event)" [placeholder]="'marketing.designer.catalog_placeholder' | translate" />
            <ul class="mt-2 flex flex-col gap-2" [attr.aria-label]="'marketing.designer.catalog_results' | translate">
              @for (product of store.products(); track product.id) {
                <li
                  class="cursor-grab rounded border p-2 text-sm"
                  draggable="true"
                  (dragstart)="dragProduct($event, product)"
                >
                  <div class="font-medium">{{ product.name }}</div>
                  <div class="text-xs text-gray-500">{{ product.sku }} · {{ product.price | number: '1.2-2' }} {{ product.currency }}</div>
                  <button nz-button nzSize="small" class="mt-1" (click)="importProduct(product)">{{ 'marketing.designer.import_product' | translate }}</button>
                </li>
              }
            </ul>
            <p class="mt-2 text-xs text-gray-500">{{ 'marketing.designer.drag_hint' | translate }}</p>
          </nz-card>
        </aside>

        <section>
          <nz-card nzSize="small" class="mb-4">
            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-medium" for="dsg-subject">{{ 'marketing.designer.subject' | translate }} ({{ locale().toUpperCase() }})</label>
                <input nz-input id="dsg-subject" [ngModel]="subjectText()" (ngModelChange)="setSubject($event)" />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium" for="dsg-preheader">{{ 'marketing.designer.preheader' | translate }} ({{ locale().toUpperCase() }})</label>
                <input nz-input id="dsg-preheader" [ngModel]="preheaderText()" (ngModelChange)="setPreheader($event)" />
              </div>
            </div>
          </nz-card>

          <div
            class="min-h-64 rounded border-2 border-dashed p-3"
            role="list"
            [attr.aria-label]="'marketing.designer.canvas' | translate"
            data-testid="designer-canvas"
          >
            @if (blocks().length === 0) {
              <div
                class="py-12 text-center text-gray-500"
                (dragover)="allowDrop($event, 0)"
                (drop)="drop($event, 0)"
              >
                {{ 'marketing.designer.empty' | translate }}
              </div>
            }
            @for (block of blocks(); track block.id; let i = $index) {
              <div
                class="h-2 rounded"
                [class.bg-blue-400]="dropIndex() === i"
                (dragover)="allowDrop($event, i)"
                (dragleave)="dropIndex.set(null)"
                (drop)="drop($event, i)"
              ></div>
              <div
                role="listitem"
                class="mb-1 flex cursor-grab items-center justify-between rounded border bg-white p-3"
                [class.border-blue-500]="selectedIndex() === i"
                draggable="true"
                tabindex="0"
                (dragstart)="dragBlock($event, i)"
                (click)="selectedIndex.set(i)"
                (keydown.enter)="selectedIndex.set(i)"
              >
                <div class="min-w-0">
                  <nz-tag>{{ 'marketing.block.' + block.type | translate }}</nz-tag>
                  <span class="ml-2 truncate text-sm">{{ summary(block) }}</span>
                </div>
                <div class="flex shrink-0 gap-1">
                  <button nz-button nzSize="small" [disabled]="i === 0" [attr.aria-label]="'marketing.designer.move_up' | translate" (click)="move($event, i, i - 1)">↑</button>
                  <button nz-button nzSize="small" [disabled]="i === blocks().length - 1" [attr.aria-label]="'marketing.designer.move_down' | translate" (click)="move($event, i, i + 1)">↓</button>
                  <button nz-button nzSize="small" nzDanger [attr.aria-label]="'marketing.action.delete' | translate" (click)="remove($event, i)">×</button>
                </div>
              </div>
            }
            @if (blocks().length > 0) {
              <div
                class="h-6 rounded"
                [class.bg-blue-400]="dropIndex() === blocks().length"
                (dragover)="allowDrop($event, blocks().length)"
                (dragleave)="dropIndex.set(null)"
                (drop)="drop($event, blocks().length)"
              ></div>
            }
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button nz-button nzType="primary" (click)="save()" [disabled]="store.saving() || !abValid()">{{ 'marketing.action.save' | translate }}</button>
            <button nz-button (click)="preview()" [disabled]="store.loading()">{{ 'marketing.designer.preview' | translate }}</button>
          </div>

          @if (safePreview(); as html) {
            <nz-card class="mt-4" nzSize="small" [nzTitle]="'marketing.designer.html_preview' | translate">
              <p class="mb-2 text-sm"><strong>{{ store.preview()?.subject }}</strong></p>
              <iframe class="h-[32rem] w-full rounded border" sandbox="" [srcdoc]="html" [attr.title]="'marketing.designer.html_preview' | translate"></iframe>
            </nz-card>
          }
        </section>

        <aside class="flex flex-col gap-4">
          <nz-card nzSize="small" [nzTitle]="'marketing.designer.block_settings' | translate">
            @if (selectedBlock(); as block) {
              @for (prop of textProps(block); track prop) {
                <div class="mb-3">
                  <label class="mb-1 block text-xs font-medium" [for]="'dsg-prop-' + prop">{{ 'marketing.prop.' + prop | translate }} ({{ locale().toUpperCase() }})</label>
                  <textarea nz-input [id]="'dsg-prop-' + prop" rows="2" [ngModel]="textOf(block, prop)" (ngModelChange)="setText(prop, $event)"></textarea>
                </div>
              }
              @for (prop of plainProps(block); track prop) {
                <div class="mb-3">
                  <label class="mb-1 block text-xs font-medium" [for]="'dsg-plain-' + prop">{{ 'marketing.prop.' + prop | translate }}</label>
                  <input nz-input [id]="'dsg-plain-' + prop" [ngModel]="plainOf(block, prop)" (ngModelChange)="setPlain(prop, $event)" />
                </div>
              }
              @if (block.type === 'product') {
                <div class="mb-3">
                  <label class="mb-1 block text-xs font-medium" for="dsg-price">{{ 'marketing.prop.price' | translate }}</label>
                  <nz-input-number nzId="dsg-price" [ngModel]="priceOf(block)" (ngModelChange)="setPlain('price', $event)" [nzMin]="0" />
                </div>
                @if (priceOf(block) !== null && plainOf(block, 'product_id')) {
                  <nz-tag nzColor="blue">{{ 'marketing.designer.from_catalog' | translate }}</nz-tag>
                }
              }
            } @else {
              <p class="text-sm text-gray-500">{{ 'marketing.designer.select_block' | translate }}</p>
            }
          </nz-card>

          <nz-card nzSize="small" [nzTitle]="'marketing.designer.ab_test' | translate">
            <div class="flex flex-col gap-2">
              @for (variant of variants(); track variant.key; let i = $index) {
                <div class="flex items-center gap-2">
                  <strong class="w-6">{{ variant.key }}</strong>
                  <nz-input-number [ngModel]="variant.percent" (ngModelChange)="setPercent(i, $event ?? 0)" [nzMin]="1" [nzMax]="100" [attr.aria-label]="'marketing.designer.variant_percent' | translate" />
                  <span class="text-xs">%</span>
                  <button nz-button nzSize="small" [nzType]="activeVariant() === variant.key ? 'primary' : 'default'" (click)="activeVariant.set(variant.key)">{{ 'marketing.designer.edit_variant' | translate }}</button>
                </div>
              }
              <div class="flex gap-2">
                <button nz-button nzSize="small" (click)="addVariant()" [disabled]="variants().length >= 4">{{ 'marketing.designer.add_variant' | translate }}</button>
                @if (variants().length > 0) {
                  <button nz-button nzSize="small" (click)="clearVariants()">{{ 'marketing.designer.remove_variants' | translate }}</button>
                }
              </div>
              @if (!abValid()) {
                <p class="text-xs text-red-600" role="alert">{{ 'marketing.designer.split_total' | translate }}</p>
              }
              @if (variants().length > 0) {
                <label class="text-xs font-medium" for="dsg-winner">{{ 'marketing.ab.criteria' | translate }}</label>
                <nz-select nzId="dsg-winner" [ngModel]="winner()" (ngModelChange)="winner.set($event)">
                  <nz-option nzValue="open_rate" [nzLabel]="'marketing.ab.open_rate' | translate" />
                  <nz-option nzValue="click_rate" [nzLabel]="'marketing.ab.click_rate' | translate" />
                  <nz-option nzValue="revenue" [nzLabel]="'marketing.ab.revenue' | translate" />
                </nz-select>
              }
            </div>
          </nz-card>
        </aside>
      </div>
      <p class="mt-2 text-xs text-gray-500">{{ campaign.name }}</p>
    } @else {
      <p class="text-gray-500">{{ 'marketing.designer.no_campaign' | translate }}</p>
    }
  `,
})
export class EmailDesignerComponent implements OnInit {
  protected readonly store = inject(MarketingAutomationStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly locales = MARKETING_LOCALES;
  protected readonly blockTypes = EMAIL_BLOCK_TYPES;
  protected readonly locale = signal<MarketingLocale>(asMarketingLocale(this.i18n.currentLanguage()));
  protected readonly blocks = signal<EmailBlock[]>([]);
  protected readonly subject = signal<LocalizedText>({});
  protected readonly preheader = signal<LocalizedText>({});
  protected readonly variants = signal<{ key: string; percent: number }[]>([]);
  protected readonly variantSubjects = signal<Record<string, LocalizedText>>({});
  protected readonly activeVariant = signal<string>('A');
  protected readonly winner = signal<'open_rate' | 'click_rate' | 'revenue'>('open_rate');
  protected readonly selectedIndex = signal<number | null>(null);
  protected readonly dropIndex = signal<number | null>(null);
  protected readonly term = signal('');

  protected readonly selectedBlock = computed(() => {
    const index = this.selectedIndex();
    return index === null ? null : (this.blocks()[index] ?? null);
  });
  protected readonly warnings = computed(() => missingLocales(this.blocks()));
  protected readonly abValid = computed(() => splitIsValid(this.variants()));
  /** The subject and the pre-header shown belong to the variant being edited. */
  protected readonly subjectText = computed(() => {
    const variant = this.activeVariant();
    const source = this.variants().length > 0 && variant !== this.variants()[0]?.key ? this.variantSubjects()[variant] : this.subject();
    return localizedOwn(source, this.locale());
  });
  protected readonly preheaderText = computed(() => localizedOwn(this.preheader(), this.locale()));
  protected readonly safePreview = computed<SafeHtml | null>(() => {
    const preview = this.store.preview();
    // The HTML comes from our own compiler and is shown in a sandboxed iframe without scripts.
    return preview ? this.sanitizer.bypassSecurityTrustHtml(preview.html) : null;
  });

  /** The template as it is sent to the API (the compiled HTML cache is rebuilt by the server). */
  protected readonly template = computed<EmailTemplate>(() => {
    const base = this.store.selectedCampaign()?.template_mjml_json ?? {};
    const rest = Object.fromEntries(
      Object.entries(base).filter(([key]) => key !== 'compiled' && key !== 'variants'),
    ) as EmailTemplate;
    const variants: Record<string, Partial<EmailTemplate>> = {};
    for (const variant of this.variants().slice(1)) {
      variants[variant.key] = { subject: this.variantSubjects()[variant.key] ?? {} };
    }
    return {
      ...rest,
      subject: this.subject(),
      preheader: this.preheader(),
      blocks: this.blocks(),
      ...(Object.keys(variants).length > 0 ? { variants } : {}),
    };
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.store.loadCampaigns(), this.store.loadBlueprints()]);
    const id = this.route.snapshot.queryParamMap.get('campaign');
    if (id) {
      await this.pickCampaign(id);
    }
  }

  protected async pickCampaign(id: string | null): Promise<void> {
    await this.store.selectCampaign(id);
    const campaign = this.store.selectedCampaign();
    if (campaign) {
      this.load(campaign);
    }
  }

  protected templateName(blueprint: MarketingBlueprint): string {
    return blueprintText(blueprint, 'name', this.locale());
  }

  protected applyTemplate(code: string | null): void {
    const blueprint = this.store.templates().find((b) => b.code === code);
    const template = blueprint?.payload['template'] as EmailTemplate | undefined;
    if (!template) {
      return;
    }
    this.subject.set(template.subject ?? {});
    this.preheader.set(template.preheader ?? {});
    // Copies, so editing the campaign never changes the seeded blueprint.
    this.blocks.set(structuredClone(template.blocks ?? []));
    this.selectedIndex.set(null);
  }

  protected summary(block: EmailBlock): string {
    const text = (block.props['text'] ?? block.props['label'] ?? block.props['name'] ?? block.props['alt']) as
      | LocalizedText
      | string
      | undefined;
    return localized(text, this.locale()) || (block.props['src'] as string | undefined) || '';
  }

  // --- Drag and drop ---

  protected dragPalette(event: DragEvent, type: EmailBlockType): void {
    this.startDrag(event, { kind: 'palette', type });
  }

  protected dragBlock(event: DragEvent, index: number): void {
    this.startDrag(event, { kind: 'block', index });
  }

  protected dragProduct(event: DragEvent, product: CatalogProduct): void {
    this.startDrag(event, { kind: 'product', product });
  }

  protected allowDrop(event: DragEvent, index: number): void {
    event.preventDefault();
    this.dropIndex.set(index);
  }

  protected drop(event: DragEvent, index: number): void {
    event.preventDefault();
    this.dropIndex.set(null);
    const raw = event.dataTransfer?.getData(DRAG_TYPE);
    if (!raw) {
      return;
    }
    this.applyDrop(JSON.parse(raw) as DragPayload, index);
  }

  /** Applies a drop; also what a keyboard user reaches through the buttons. */
  applyDrop(payload: DragPayload, index: number): void {
    if (payload.kind === 'palette') {
      this.blocks.update((blocks) => insertItem(blocks, newBlock(payload.type), index));
      this.selectedIndex.set(Math.min(index, this.blocks().length - 1));
    } else if (payload.kind === 'product') {
      this.blocks.update((blocks) =>
        insertItem(blocks, productBlockFromCatalog(payload.product, this.locale()), index),
      );
      this.selectedIndex.set(Math.min(index, this.blocks().length - 1));
    } else {
      const target = payload.index < index ? index - 1 : index;
      this.blocks.update((blocks) => moveItem(blocks, payload.index, target));
      this.selectedIndex.set(target);
    }
  }

  protected addBlock(type: EmailBlockType): void {
    this.applyDrop({ kind: 'palette', type }, this.blocks().length);
  }

  protected importProduct(product: CatalogProduct): void {
    const block = this.selectedBlock();
    const index = this.selectedIndex();
    if (block?.type === 'product' && index !== null) {
      // The selected product block takes the data of the product instead of adding another one.
      this.blocks.update((blocks) =>
        blocks.map((b, i) => (i === index ? productBlockFromCatalog(product, this.locale(), b) : b)),
      );
      return;
    }
    this.applyDrop({ kind: 'product', product }, this.blocks().length);
  }

  protected move(event: Event, from: number, to: number): void {
    event.stopPropagation();
    this.blocks.update((blocks) => moveItem(blocks, from, to));
    this.selectedIndex.set(to);
  }

  protected remove(event: Event, index: number): void {
    event.stopPropagation();
    this.blocks.update((blocks) => removeItem(blocks, index));
    this.selectedIndex.set(null);
  }

  // --- Editing ---

  protected search(term: string): void {
    this.term.set(term);
    void this.store.searchProducts(term);
  }

  protected textProps(block: EmailBlock): readonly string[] {
    return TEXT_PROPS[block.type];
  }

  protected plainProps(block: EmailBlock): readonly string[] {
    return PLAIN_PROPS[block.type];
  }

  protected textOf(block: EmailBlock, prop: string): string {
    return localizedOwn(block.props[prop] as LocalizedText | undefined, this.locale());
  }

  protected plainOf(block: EmailBlock, prop: string): string {
    const value = block.props[prop];
    return typeof value === 'string' ? value : '';
  }

  protected priceOf(block: EmailBlock): number | null {
    const value = block.props['price'];
    return typeof value === 'number' ? value : null;
  }

  protected setText(prop: string, value: string): void {
    this.updateSelected((block) => setBlockText(block, prop, this.locale(), value));
  }

  protected setPlain(prop: string, value: unknown): void {
    this.updateSelected((block) => setBlockProp(block, prop, value));
  }

  protected setSubject(value: string): void {
    const locale = this.locale();
    const variant = this.activeVariant();
    const first = this.variants()[0]?.key;
    if (this.variants().length > 0 && variant !== first) {
      this.variantSubjects.update((all) => ({ ...all, [variant]: { ...(all[variant] ?? {}), [locale]: value } }));
    } else {
      this.subject.update((current) => ({ ...current, [locale]: value }));
    }
  }

  protected setPreheader(value: string): void {
    this.preheader.update((current) => ({ ...current, [this.locale()]: value }));
  }

  // --- A/B test ---

  protected addVariant(): void {
    const variants = this.variants();
    const key = String.fromCharCode(65 + variants.length);
    const next = variants.length === 0 ? [{ key: 'A', percent: 50 }, { key: 'B', percent: 50 }] : [...variants, { key, percent: 1 }];
    this.variants.set(next);
    this.activeVariant.set(next[next.length - 1].key);
  }

  protected clearVariants(): void {
    this.variants.set([]);
    this.variantSubjects.set({});
    this.activeVariant.set('A');
  }

  protected setPercent(index: number, percent: number): void {
    this.variants.update((all) => all.map((v, i) => (i === index ? { ...v, percent } : v)));
  }

  // --- Server calls ---

  protected async preview(): Promise<void> {
    const first = this.variants()[0]?.key;
    const variant = this.variants().length > 0 && this.activeVariant() !== first ? this.activeVariant() : null;
    await this.store.previewTemplate(this.locale(), this.template(), variant);
  }

  protected async save(): Promise<void> {
    const campaign = this.store.selectedCampaign();
    if (!campaign) {
      return;
    }
    const abTest: AbTestConfig | null =
      this.variants().length > 0 ? { variants: this.variants(), winner_criteria: this.winner() } : null;
    const saved = await this.store.saveTemplate(campaign.id, this.template(), abTest);
    if (saved) {
      this.message.success(this.i18n.translate('marketing.designer.saved'));
    }
  }

  private load(campaign: MarketingCampaign): void {
    const template = campaign.template_mjml_json ?? {};
    this.subject.set(template.subject ?? {});
    this.preheader.set(template.preheader ?? {});
    this.blocks.set(structuredClone(template.blocks ?? []));
    const ab = campaign.ab_test_split_variant_json;
    this.variants.set(ab?.variants ?? []);
    this.winner.set(ab?.winner_criteria ?? 'open_rate');
    const subjects: Record<string, LocalizedText> = {};
    for (const [key, variant] of Object.entries(template.variants ?? {})) {
      subjects[key] = variant.subject ?? {};
    }
    this.variantSubjects.set(subjects);
    this.activeVariant.set(ab?.variants[0]?.key ?? 'A');
    this.selectedIndex.set(null);
  }

  private updateSelected(change: (block: EmailBlock) => EmailBlock): void {
    const index = this.selectedIndex();
    if (index === null) {
      return;
    }
    this.blocks.update((blocks) => blocks.map((block, i) => (i === index ? change(block) : block)));
  }

  private startDrag(event: DragEvent, payload: DragPayload): void {
    event.dataTransfer?.setData(DRAG_TYPE, JSON.stringify(payload));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = payload.kind === 'block' ? 'move' : 'copy';
    }
  }
}

/** The text of exactly this language, with no fallback: the editor must show what is empty. */
function localizedOwn(text: LocalizedText | undefined, locale: MarketingLocale): string {
  return text?.[locale] ?? '';
}
