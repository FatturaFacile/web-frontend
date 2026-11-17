/**
 * Static FatturaPA code lists mirroring the backend `config/italian_tax.php` (issue #286). No lookup endpoint exists:
 * if the backend adds one, replace these lists. Descriptions are the official code-table wording, not UI copy.
 * Rates, caps and legal wording are NOT here: they always come from the API.
 */

export interface FiscalCodeOption {
  code: string;
  description: string;
}

/** Regime forfettario: invoices without VAT (natura N2.2) and without ritenuta. */
export const FORFETTARIO_REGIME = 'RF19';
export const FORFETTARIO_NATURA = 'N2.2';

export const FISCAL_REGIMES: readonly FiscalCodeOption[] = [
  { code: 'RF01', description: 'Ordinario' },
  { code: 'RF02', description: 'Contribuenti minimi (art. 1, c. 96-117, L. 244/07)' },
  { code: 'RF04', description: 'Agricoltura e attività connesse e pesca' },
  { code: 'RF05', description: 'Vendita sali e tabacchi' },
  { code: 'RF06', description: 'Commercio fiammiferi' },
  { code: 'RF07', description: 'Editoria' },
  { code: 'RF08', description: 'Gestione servizi telefonia pubblica' },
  { code: 'RF09', description: 'Rivendita documenti di trasporto pubblico e di sosta' },
  { code: 'RF10', description: 'Intrattenimenti, giochi e altre attività' },
  { code: 'RF11', description: 'Agenzie viaggi e turismo' },
  { code: 'RF12', description: 'Agriturismo' },
  { code: 'RF13', description: 'Vendite a domicilio' },
  {
    code: 'RF14',
    description: "Rivendita beni usati, oggetti d'arte, d'antiquariato o da collezione",
  },
  {
    code: 'RF15',
    description: 'Agenzie di vendite all’asta di oggetti d’arte, antiquariato o da collezione',
  },
  { code: 'RF16', description: 'IVA per cassa P.A.' },
  { code: 'RF17', description: 'IVA per cassa' },
  { code: 'RF18', description: 'Altro' },
  { code: 'RF19', description: 'Forfettario' },
  { code: 'RF20', description: 'Regime transfrontaliero di franchigia IVA' },
];

export const FUND_TYPES: readonly FiscalCodeOption[] = [
  { code: 'TC01', description: 'Cassa avvocati e procuratori legali' },
  { code: 'TC02', description: 'Cassa dottori commercialisti' },
  { code: 'TC03', description: 'Cassa geometri' },
  { code: 'TC04', description: 'Cassa ingegneri e architetti (Inarcassa)' },
  { code: 'TC05', description: 'Cassa nazionale del notariato' },
  { code: 'TC06', description: 'Cassa ragionieri e periti commerciali' },
  { code: 'TC07', description: 'ENASARCO' },
  { code: 'TC08', description: 'ENPACL' },
  { code: 'TC09', description: 'ENPAM' },
  { code: 'TC10', description: 'ENPAF' },
  { code: 'TC11', description: 'ENPAV' },
  { code: 'TC12', description: 'ENPAIA' },
  { code: 'TC13', description: 'Fondo imprese di spedizione e agenzie marittime' },
  { code: 'TC14', description: 'INPGI' },
  { code: 'TC15', description: 'ONAOSI' },
  { code: 'TC16', description: 'CASAGIT' },
  { code: 'TC17', description: 'EPPI' },
  { code: 'TC18', description: 'EPAP' },
  { code: 'TC19', description: 'ENPAB' },
  { code: 'TC20', description: 'ENPAPI' },
  { code: 'TC21', description: 'ENPAP' },
  { code: 'TC22', description: 'INPS (gestione separata)' },
];

export const WITHHOLDING_TYPES: readonly FiscalCodeOption[] = [
  { code: 'RT01', description: 'Ritenuta persone fisiche' },
  { code: 'RT02', description: 'Ritenuta persone giuridiche' },
  { code: 'RT03', description: 'Contributo INPS' },
  { code: 'RT04', description: 'Contributo ENASARCO' },
  { code: 'RT05', description: 'Contributo ENPAM' },
  { code: 'RT06', description: 'Altro contributo previdenziale' },
];

/** CausalePagamento codes (modello 770 / CU). */
export const WITHHOLDING_REASONS: readonly string[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'L1',
  'M',
  'M1',
  'M2',
  'N',
  'O',
  'O1',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'V1',
  'V2',
  'W',
  'X',
  'Y',
  'ZO',
];

export const NATURA_CODES: readonly FiscalCodeOption[] = [
  { code: 'N1', description: 'Escluse ex art. 15' },
  { code: 'N2.1', description: 'Non soggette (artt. 7-7septies)' },
  { code: 'N2.2', description: 'Non soggette - altri casi' },
  { code: 'N3.1', description: 'Non imponibili - esportazioni' },
  { code: 'N3.2', description: 'Non imponibili - cessioni intracomunitarie' },
  { code: 'N3.3', description: 'Non imponibili - cessioni verso San Marino' },
  { code: 'N3.4', description: 'Non imponibili - operazioni assimilate' },
  { code: 'N3.5', description: "Non imponibili - dichiarazioni d'intento" },
  { code: 'N3.6', description: 'Non imponibili - altre operazioni' },
  { code: 'N4', description: 'Esenti' },
  { code: 'N5', description: 'Regime del margine' },
  { code: 'N6.1', description: 'Inversione contabile - rottami' },
  { code: 'N6.2', description: 'Inversione contabile - oro e argento' },
  { code: 'N6.3', description: 'Inversione contabile - subappalto edile' },
  { code: 'N6.4', description: 'Inversione contabile - fabbricati' },
  { code: 'N6.5', description: 'Inversione contabile - telefoni cellulari' },
  { code: 'N6.6', description: 'Inversione contabile - prodotti elettronici' },
  { code: 'N6.7', description: 'Inversione contabile - settore edile' },
  { code: 'N6.8', description: 'Inversione contabile - settore energetico' },
  { code: 'N6.9', description: 'Inversione contabile - altri casi' },
  { code: 'N7', description: 'IVA assolta in altro stato UE' },
];
