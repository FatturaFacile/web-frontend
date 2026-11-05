import { createI18n } from "@inglorious/i18n"

// One catalogue per language in ./locales, converted from the Angular app's
// static fallback catalogues. The tenant's own translations, served by
// `/translations/:locale`, are not layered on top yet.
export const { I18n, t, ready, currentLocale } = createI18n({
  catalogues: import.meta.glob("./locales/*.json"),
  defaultLocale: "en",
  // The key the Angular app saved the language under, so the choice carries over.
  storageKey: "lang",
})
