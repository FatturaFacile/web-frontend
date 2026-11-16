# Libreria componenti condivisa (`@shared`)

Tutti i componenti, le direttive e le pipe riusabili passano dal barrel `@shared` (`index.ts`). Le feature non
importano mai file interni di un'altra feature: se un pezzo serve in più punti, entra qui.

- Documentazione interattiva: `pnpm storybook` (build statica: `pnpm build-storybook`). Ogni componente
  condiviso ha un file `*.stories.ts` accanto al sorgente.
- Tema chiaro/scuro, densità e accento brand: vedi `core/theme` e `styles/_brand.scss`.
- Linee guida UX, accessibilità e microcopy: `docs/ux-guidelines.md`.
- Mobile e desktop: l'interfaccia è responsive e installabile come PWA (`ngsw-config.json`, `manifest.webmanifest`),
  quindi la stessa libreria serve web, mobile e desktop installato. Un wrapper nativo (Capacitor/Electron) può
  riusare il bundle senza duplicare i componenti.
