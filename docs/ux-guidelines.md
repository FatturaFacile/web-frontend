# Linee guida UX e microcopy

Riferimento per chi scrive o modifica l'interfaccia di FatturaFacile. I componenti sono documentati in Storybook
(`pnpm storybook`); l'accessibilità è verificata da `pnpm e2e:a11y`.

## Principi

1. **Coerenza**: si usano solo componenti di `@shared` e i token di `src/styles/_tokens.scss`. Mai colori, spaziature o
   font letterali nei componenti.
2. **Tema, densità, brand**: ogni schermata deve funzionare in chiaro/scuro, densità _compatta_/_confortevole_ e con
   tutti gli accenti brand (`data-theme`, `data-density`, `data-brand` su `<html>`). La toolbar di Storybook cambia i
   tre assi; `pnpm e2e:a11y` li incrocia tutti.
3. **Densità**: la densità predefinita è compatta (ERP, griglie dense). Le dimensioni dei controlli non scendono mai
   sotto 24×24 px (WCAG 2.5.8).
4. **Nessuna informazione solo a colore**: stati, errori e link hanno anche icona, testo o sottolineatura.

## Accessibilità (WCAG 2.2 AA)

- Contrasto testo ≥ 4.5:1 (≥ 3:1 per testo grande e bordi dei controlli).
- Ogni elemento interattivo è raggiungibile e utilizzabile da tastiera, con focus ring visibile (stile globale
  `:focus-visible`). Esiste lo skip-link "Vai al contenuto".
- Pulsanti solo-icona: `aria-label` sempre presente (direttiva `appIconAction` lo fornisce).
- Ogni campo ha una `<label>` o `aria-label`; gli errori sono associati con `aria-describedby`.
- Per i widget personalizzati usare i ruoli ARIA corretti (CDK `a11y` dove possibile) e testare con screen reader
  (NVDA/VoiceOver).
- Nuove pagine pubbliche: aggiungerle a `PAGES` in `tests/accessibility.spec.ts`.

## Microcopy

- Lingua di riferimento: italiano; chiavi in tutte e 4 le lingue (it, en, de, fr) nel `TranslationSeeder`.
- **Voce**: diretta e professionale, seconda persona o forma impersonale; niente gergo tecnico né toni scherzosi.
- **Pulsanti**: verbo all'infinito + oggetto ("Salva fattura", "Invia allo SDI"); evitare "OK" e "Sì/No" generici.
- **Errori**: dire cosa è successo e cosa fare ("Partita IVA non valida: controlla le 11 cifre"). Mai codici interni
  né colpevolizzare l'utente.
- **Conferme distruttive**: nominare l'oggetto ("Eliminare la fattura 2026/114?") e il pulsante ripete l'azione
  ("Elimina fattura").
- **Stati vuoti**: spiegare perché è vuoto e proporre l'azione successiva.
- **Numeri e date**: formattati con le pipe `money`, `decimalFormat`, `dateFormat` secondo la lingua e la valuta.
- Frasi senza punto finale nei titoli, etichette e pulsanti; punto finale nei messaggi di più frasi.

## Checklist per una nuova schermata

- [ ] Solo componenti `@shared` e token; nessun colore letterale
- [ ] Verificata in chiaro/scuro, compatta/confortevole
- [ ] Navigazione completa da tastiera, ordine del focus logico
- [ ] Testi tradotti nelle 4 lingue
- [ ] Storia Storybook per ogni nuovo componente condiviso
