# Benchmarks

The scripts behind [BENCHMARKS.md](../BENCHMARKS.md). They compare this app with the Angular app at the repository's root.

Build both apps first. From the repository root:

```sh
pnpm install && pnpm build
pnpm --dir inglorious install && pnpm --dir inglorious build
```

Then, from `inglorious/`:

| Command                 | What it measures                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm bench:size`       | Initial and total JS and CSS, raw, gzip and brotli                                                         |
| `pnpm bench:lighthouse` | Lighthouse on both login pages, median of 5 desktop and 5 mobile runs (needs Google Chrome; a few minutes) |
| `pnpm bench:loc`        | Lines of code per feature                                                                                  |
| `pnpm bench:api`        | Distinct framework and library names each app imports                                                      |
| `pnpm bench:dev`        | Dev server start-up                                                                                        |

`bench:lighthouse` serves both builds with `serve.mjs`, a local static server with compression whose API always answers "not signed in", so no backend is involved. For a cold `bench:dev`, delete `.angular/cache` (at the root) and `inglorious/node_modules/.vite` first.
