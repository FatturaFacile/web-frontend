# Fattura Facile: Angular vs Inglorious

The same frontend built twice, measured on 2026-11-03:

- **Angular**: Angular 22 with ng-zorro 22, standalone components, signals and NgRx Signal Store, lazy `loadComponent` routes. It is the root of this repository.
- **Inglorious**: `@inglorious/web` 6.16 with `@inglorious/ui` 9.13, `@inglorious/store` 12.2 and `@inglorious/i18n` 2.0, lit-html templates, one lazily loaded chunk per page. It lives in `inglorious/`.

Both apps cover the same screens with the same API and translations, under the same constraints: strict TypeScript, WCAG AA, linting. Where Angular faked data or success (backups, alerts, the QR-bill form...), the Inglorious port reports failures instead; that makes it slightly bigger, not smaller.

## Summary

|                                  |  Angular | Inglorious | Ratio |
| -------------------------------- | -------: | ---------: | ----: |
| Initial JS + CSS, gzip           | 389.5 kB |    82.6 kB | 0.21× |
| All JS + CSS, gzip               | 544.2 kB |   191.8 kB | 0.35× |
| Login page transfer (Lighthouse) | 360.5 kB |    95.3 kB | 0.26× |
| Lighthouse mobile performance    |       89 |         99 |       |
| Lighthouse accessibility         |       95 |        100 |       |
| Mobile LCP                       | 3,530 ms |   1,832 ms | 0.52× |
| Feature lines of code            |    8,301 |      5,314 | 0.64× |
| Framework and library API in use |      129 |         51 | 0.40× |
| Production build                 |   ~4.0 s |     ~1.4 s | 0.36× |
| Dev server ready (warm)          |   ~2.3 s |     ~0.3 s | 0.14× |

## Verdict

**On this app, measured this way, Inglorious is faster and simpler, and it gives up none of the rigour.**

- **Speed:** the first load is a fifth of the size and mobile LCP is about half. On desktop both apps score 100, so on an office connection the login page feels much the same; the difference shows on slower networks and devices. The developer loop is faster too: builds take about a third of the time and the dev server is ready about seven times sooner.
- **Simplicity:** the features take 36% less code in half as many files, and use 40% as much framework API: no dependency injection, decorators or RxJS operators. A page is plain data plus handlers, which is what made the shared factories (list pages, server grids, resource forms) cheap to write. Those factories are where most of the savings come from.
- **Rigour:** the port is just as strict: strict TypeScript, linting with stricter rules, and accessibility at 100 against 95. Its smoke tests drive the whole app the way a user does, and it reports failures that the Angular version hid.

What the numbers don't show, to be fair to Angular:

- **These are stacks, not bare frameworks.** Much of the size gap is ng-zorro (640 kB of raw CSS) and the Font Awesome webfonts. A leaner Angular setup would close some of it, though not the difference in feature code.
- **The port had a head start.** It was written with the Angular app as its spec, which made shared abstractions easy to spot. A refactor of the Angular code would shrink it too; this report compares the code as it stands.
- **Maturity is Angular's.** Long-term support, a vast ecosystem, documentation, DevTools and a large hiring pool are real advantages that no benchmark captures. Inglorious is young and maintained by its author. The port turned up a handful of framework bugs; all were fixed during the port, which says something both about its responsiveness and about its age.
- **Not everything favors Inglorious.** Its lint and test suite are a little slower, it makes more (smaller) requests on first load, and Angular has more unit tests. Runtime performance on logged-in pages, memory use and very large lists weren't measured.

**Bottom line:** for a new app of this kind, with a team willing to adopt a young framework, Inglorious delivers the same product with a fifth of the initial download, about a third less code and a much faster feedback loop. If you need Angular's ecosystem, longevity or scale of team, those are good reasons to choose it, just not ones these benchmarks can measure.

## Bundle size

Production builds (`ng build`, `vite build`). "Initial" is what `index.html` loads (scripts, module preloads and stylesheets) plus the JS those files import statically. "All" is every JS and CSS file, service worker excluded. Compression used gzip level 9 and brotli quality 11.

|                   |    Angular raw | Angular gzip | Angular brotli | Inglorious raw | Inglorious gzip | Inglorious brotli |
| ----------------- | -------------: | -----------: | -------------: | -------------: | --------------: | ----------------: |
| Initial JS        |     1,113.7 kB |     299.6 kB |       248.0 kB |       179.4 kB |         63.0 kB |           54.9 kB |
| Initial CSS       |       640.1 kB |      89.9 kB |        68.9 kB |       128.0 kB |         19.6 kB |           16.6 kB |
| **Initial total** | **1,753.8 kB** | **389.5 kB** |   **316.9 kB** |   **307.4 kB** |     **82.6 kB** |       **71.5 kB** |
| All JS            |     1,571.8 kB |     454.3 kB |       386.0 kB |       442.0 kB |        172.3 kB |          150.7 kB |
| All CSS           |       640.1 kB |      89.9 kB |        68.9 kB |       128.0 kB |         19.6 kB |           16.6 kB |
| **All total**     | **2,211.8 kB** | **544.2 kB** |   **454.9 kB** |   **570.1 kB** |    **191.8 kB** |      **167.2 kB** |

Notes:

- **Translations:** both apps load one catalogue per language on demand. Angular ships them as JSON (115.2 kB raw, 35.6 kB gzip for four languages), which isn't counted above. Inglorious ships them as JS chunks (96.2 kB raw, 39.0 kB gzip), counted in "All JS". Without them, Inglorious's "All JS" is about 133 kB gzip.
- **Fonts:** Angular also ships the Font Awesome webfonts (fa-solid alone is 117 kB woff2). Inglorious inlines the SVG icons it uses, tree-shaken from Iconify packages.
- **What's in Inglorious's initial chunk:** the store with its immutable-update library (mutative), the shell, the router and the entity definitions. Pages, the DataGrid and forms load with the first page that needs them.

## Lighthouse

Lighthouse 12.8.2, login page (the only public page), median of 5 runs per form factor. Both production builds were served by the same local Node server with brotli compression and immutable caching for hashed assets. The API was stubbed to answer "not signed in", so the network and backend don't affect the runs.

|                          | Angular desktop | Inglorious desktop | Angular mobile | Inglorious mobile |
| ------------------------ | --------------: | -----------------: | -------------: | ----------------: |
| Performance              |             100 |                100 |             89 |                99 |
| Accessibility            |              95 |                100 |             95 |               100 |
| Best practices           |              96 |                 96 |             96 |                96 |
| SEO                      |              82 |                 82 |             82 |                82 |
| First Contentful Paint   |          471 ms |             388 ms |       2,140 ms |          1,748 ms |
| Largest Contentful Paint |          742 ms |             454 ms |       3,530 ms |          1,832 ms |
| Total Blocking Time      |            0 ms |               0 ms |          28 ms |              0 ms |
| Cumulative Layout Shift  |           0.001 |                  0 |          0.005 |                 0 |
| Speed Index              |          471 ms |             388 ms |       2,140 ms |          1,748 ms |
| Bytes transferred        |        360.5 kB |            95.3 kB |       360.5 kB |           95.3 kB |
| JS transferred           |        262.4 kB |            73.9 kB |       262.4 kB |           73.9 kB |
| CSS transferred          |         69.2 kB |            17.1 kB |        69.2 kB |           17.1 kB |
| Requests                 |              15 |                 21 |             15 |                21 |

- **Accessibility:** Angular loses points on color contrast. The Inglorious theme darkens the brand teal and slate shades to reach WCAG AA.
- **Shared losses:** both apps lose the same best-practices and SEO points: the stubbed 401 logged in the console, plus no meta description and no `robots.txt`.
- **Requests:** Inglorious makes more, smaller requests (per-page chunks and their shared dependencies). Over HTTP/2 that costs little, as the paint times show.
- **Repeatability:** an earlier run of the same benchmark, before the final style changes, gave the same scores with timings within 15 ms.
- **Not measured:** logged-in pages, which would need a real account on the production API.

## Developer experience

### Lines of code

Counted as non-blank lines that aren't only a comment, tests excluded. Angular counts TS, HTML, SCSS and LESS; Inglorious counts TS and CSS. Angular's `payment-selector` component is left out: nothing uses it.

| Feature         |    Angular | Inglorious |    Ratio |
| --------------- | ---------: | ---------: | -------: |
| accounting      |        703 |        447 |     0.64 |
| alerts          |        479 |        250 |     0.52 |
| auth (login)    |        260 |        195 |     0.75 |
| automotive      |        233 |        165 |     0.71 |
| construction    |         94 |         23 |     0.24 |
| crm             |        631 |        412 |     0.65 |
| dashboard       |        294 |        239 |     0.81 |
| field-service   |        101 |         19 |     0.19 |
| hr              |         94 |         22 |     0.23 |
| inventory       |        368 |        265 |     0.72 |
| manufacturing   |         92 |         20 |     0.22 |
| order-history   |        212 |        127 |     0.60 |
| professionals   |         93 |         25 |     0.27 |
| purchases       |      1,033 |        774 |     0.75 |
| rent            |        104 |         22 |     0.21 |
| retail          |         89 |         23 |     0.26 |
| sales           |      1,628 |      1,086 |     0.67 |
| settings        |        489 |        302 |     0.62 |
| system          |        310 |        296 |     0.95 |
| time-attendance |        376 |        240 |     0.64 |
| treasury        |        574 |        333 |     0.58 |
| welcome         |         44 |         29 |     0.66 |
| **Features**    |  **8,301** |  **5,314** | **0.64** |
| Shared code     |      5,483 |      4,980 |     0.91 |
| **Total**       | **13,784** | **10,294** | **0.75** |
| Source files    |        229 |        118 |     0.52 |

- **Feature ratios:** simple list pages shrink the most (about 0.2×), because they share one `createListPage` factory. Grids and forms share `createServerDataGrid`, `withCells`, `createResourcePage` and `createResourceForm`. System barely shrinks (0.95×) because its Angular version claimed success on every failure; the port handles each one.
- **Shared code:** Angular has core 2,906, shared 868, layout 739, data-access 246, domain 102 and global styles 215. Inglorious has shared types and factories 1,217, store 859 (of which `entities.ts` is 748), API 574, models 613, entity typings 640, CSS 696, layout helpers 160, forms 61 and guards 60.
- **Why shared code looks closer than it is:** `entities.ts` and the typings are mostly per-page declarations (grid columns, initial form values, entity shapes) that Angular keeps inside its components. The feature ratio understates the difference a little.

### Framework API in use

Distinct runtime names each app imports from its framework and component library, tests excluded. This is a proxy for how much API someone has to know to work on the code. Template syntax isn't counted for either app (Angular's control flow, bindings and pipes; lit-html's `@event`, `.property` and `?attribute`).

| Package                   |   Names | Package              |  Names |
| ------------------------- | ------: | -------------------- | -----: |
| `@angular/core`           |      28 | `@inglorious/web`    |     18 |
| `@angular/common`         |      18 | `@inglorious/ui`     |     28 |
| `@angular/forms`          |       9 | `@inglorious/store`  |      4 |
| `@angular/router`         |       8 | `@inglorious/i18n`   |      1 |
| `@angular/service-worker` |       1 |                      |        |
| `@ngrx/signals`           |       6 |                      |        |
| `rxjs`                    |      16 |                      |        |
| `ng-zorro-antd`           |      43 |                      |        |
| **Angular total**         | **129** | **Inglorious total** | **51** |

The Angular app also defines 37 components, 7 injectable services, 3 pipes and 2 directives through decorators. In the Inglorious app every one of those roles is a type (an object of event handlers with a `render`) or a plain function.

### Tooling

Times on the same laptop, warm unless stated.

|                            |        Angular |    Inglorious |
| -------------------------- | -------------: | ------------: |
| Production build           |      4.0–4.6 s |     1.4–2.0 s |
| Typecheck (`tsc --noEmit`) |     ~1.0–1.1 s |       ~0.38 s |
| Lint                       |     ~1.1–1.4 s |    ~1.6–1.8 s |
| Dev server ready, cold     |          2.9 s |        0.43 s |
| Dev server ready, warm     |          2.3 s |        0.32 s |
| Test suite                 |         ~2.0 s |        ~3.4 s |
| Runtime dependencies       |             14 |             8 |
| Tests                      | 99 in 23 files | 45 in 5 files |

- **Dev server:** Vite compiles modules when they're first requested, so the first full page load in dev costs more than the ready time shows.
- **Lint:** Inglorious lints a little slower because of its stricter rules: sorted imports, no magic numbers.
- **Tests:** the suites aren't comparable. Angular's are unit tests per component and service. Most of Inglorious's boot the whole app in jsdom against a stubbed `fetch` and drive it like a user.

## How it was measured

The scripts are in [`benchmarks/`](benchmarks/), with instructions in its README; each section above has a `pnpm bench:*` command.

- **Bundle size** (`bench:size`): reads each build's `index.html`, follows static imports and compresses every file with Node's zlib.
- **Lighthouse** (`bench:lighthouse`): serves both production builds side by side, with the API stubbed, and runs the Lighthouse CLI against each login page.
- **Lines of code** (`bench:loc`): counts per feature, mapping Angular's `src/app/features/<feature>` folders to the matching Inglorious `src/pages/*` folders.
- **Framework API** (`bench:api`): collects the distinct names imported from each framework and library package.
- **Tooling:** wall-clock timings of the package scripts. `bench:dev` times the dev servers until they report ready and serve the page's entry module.
