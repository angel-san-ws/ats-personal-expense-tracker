/**
 * Parses the text of bank "consumption alert" push notifications (BiMovil)
 * into structured transactions. The input text typically comes from OCR of a
 * notification-list screenshot, so the parser tolerates arbitrary line wraps
 * and common OCR noise (comma/period confusion, stray punctuation).
 *
 * Alert templates:
 *   BiMovil: Consumo por Q.59.00 en MCDONALDS PERIFERICO Cuenta TCREDITO8
 *   02-Jul 20:24 Autorizacion 276178.                        (card purchase)
 *   BiMovil: Debito por Q.450.00 Cuenta MONE1 en la Agencia DIGITAL
 *   04-Jul 09:08 Autorizacion 109169.          (bank-account debit/transfer)
 *   BiMovil: Credito por Q.2,500.00 Cuenta MONE1 en la Agencia DIGITAL
 *   04-Jul 13:24 Autorizacion 228722.      (deposit → imported as a payment)
 *   BiMovil: Retiro por Q.2000.00 en el Cajero Shell Select Mariscal Z con
 *   su tarjeta BICHEQUE3 08-Jul 19:06 Aut.265159.  (ATM withdrawal → expense)
 *
 * The alert body carries no year; each notification is preceded by a delivery
 * timestamp header like "02/07/2026 20:24", which supplies it. Without a
 * header the most recent past occurrence relative to `referenceDate` is used.
 */

export interface ParsedAlert {
  fecha: string; // yyyy-mm-dd (purchase date from the alert)
  comercio: string;
  valor: number;
  /** ISO currency code detected from the amount symbol. */
  currency: string | null;
  /** Account/card label from the alert, e.g. "TCREDITO8". */
  tarjeta: string | null;
  /** Bank authorization number — unique per transaction, used for dedup. */
  autorizacion: string | null;
  /** Purchases/debits are expenses; account credits (deposits) are payments. */
  kind: 'expense' | 'payment';
}

/** Spanish + English 3-letter month abbreviations -> month number. */
const MONTHS: Record<string, number> = {
  ene: 1,
  jan: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  jui: 7, // OCR reads "Jul" with l → I confusion
  ago: 8,
  aug: 8,
  sep: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dic: 12,
  dec: 12,
};

/**
 * Whitespace plus stray glyphs tesseract invents from the notification-list
 * chrome — the unread dot (read as "*", "·", "•", "®") and the row chevron
 * ("›", ">", "»") — which can land between the alert's real tokens. Matched
 * wherever plain whitespace is expected between structural parts.
 */
const GAP = String.raw`[\s*•·>»›«‹®|]`;
const GAP_TRIM_RE = new RegExp(String.raw`^${GAP}+|${GAP}+$`, 'g');

/**
 * Day + month tail shared by all alert templates, ending at the auth no.
 * The bank writes the auth keyword as "Autorizacion" or abbreviated "Aut.".
 */
const DATE_AUTH = String.raw`(\d{1,2})\s*[-–.\s]\s*([A-Za-zÁÉÍÓÚáéíóú1|]{3,4})\.?\s*(?:\d{1,2}:\d{2})?${GAP}*Aut(?:orizaci[oóeé]n)?\s*[.:]?\s*(\d+)`;

/**
 * Card purchase. `\s+`/`GAP+` throughout tolerates OCR line wraps and chrome
 * glyphs; the merchant is a lazy match ended by the literal "Cuenta" keyword.
 */
const CONSUMO_RE = new RegExp(
  String.raw`Consumo\s+por\s*(Q|US\$?|USD|\$|€)\s*[.,]?\s*([\d][\d.,]*)${GAP}+en\s+([\s\S]+?)\s+Cuenta\s+(\S+)${GAP}+${DATE_AUTH}`,
  'gi',
);

/**
 * Bank-account movement — Debito (transfer/withdrawal → expense) or Credito
 * (deposit → payment): the account comes right after the amount and the
 * channel/branch after "en la Agencia" — that branch name becomes the
 * merchant (prefixed "AGENCIA") since there is no real merchant. The short
 * "en la" connector is matched loosely ([\s\S]{0,14}?) because OCR often
 * garbles it (e.g. "en Ia", "enla").
 */
const MOVIMIENTO_RE = new RegExp(
  String.raw`(Debito|Credito)\s+por\s*(Q|US\$?|USD|\$|€)\s*[.,]?\s*([\d][\d.,]*)${GAP}+Cuenta\s+(\S+)[\s\S]{0,14}?\bAgencia\s+([\s\S]+?)${GAP}+${DATE_AUTH}`,
  'gi',
);

/**
 * ATM cash withdrawal (→ expense): the ATM location follows "en el Cajero"
 * and the card follows "con su tarjeta". The "en el" connector is matched
 * loosely ([\s\S]{0,8}?) for OCR garbling, like MOVIMIENTO's "en la". The
 * location becomes the merchant, prefixed "CAJERO" (mirrors "AGENCIA").
 */
const RETIRO_RE = new RegExp(
  String.raw`Retiro\s+por\s*(Q|US\$?|USD|\$|€)\s*[.,]?\s*([\d][\d.,]*)${GAP}+en\b[\s\S]{0,8}?\bCajero\s+([\s\S]+?)\s+con\s+su\s+tarjeta\s+(\S+)${GAP}+${DATE_AUTH}`,
  'gi',
);

/** Notification delivery timestamp header, e.g. "02/07/2026". */
const HEADER_DATE_RE = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;

function detectCurrency(symbol: string): string | null {
  // The bank writes USD as "US$", "US." ("US" here) or "USD".
  if (symbol.includes('$') || /^us/i.test(symbol)) return 'USD';
  if (symbol.includes('€')) return 'EUR';
  if (/q/i.test(symbol)) return 'GTQ';
  return null;
}

/**
 * Parse an alert amount like "59.00", "27,561.01" or OCR-mangled "59,00".
 * A trailing comma+2 digits with no period is treated as a decimal comma.
 */
function parseAlertAmount(raw: string): number | null {
  let s = raw.replace(/\s+/g, '').replace(/[.,]+$/, '');
  if (/,\d{2}$/.test(s) && !s.includes('.')) {
    s = s.replace(/,(?=\d{2}$)/, '.');
  }
  s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toIso(y: number, m: number, d: number): string | null {
  if (!y || !m || !d || m > 12 || d > 31) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

interface HeaderDate {
  index: number;
  year: number;
  date: Date;
}

function collectHeaderDates(text: string): HeaderDate[] {
  const headers: HeaderDate[] = [];
  for (const m of text.matchAll(HEADER_DATE_RE)) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    headers.push({
      index: m.index ?? 0,
      year: y,
      date: new Date(y, mo - 1, d),
    });
  }
  return headers;
}

const HALF_YEAR_MS = 182 * 24 * 60 * 60 * 1000;

/**
 * Resolve the year for an alert's day/month: take it from the closest header
 * before the alert (its delivery timestamp), correcting by ±1 year when the
 * candidate lands more than half a year away (alerts viewed across New Year).
 * With no headers, use the most recent past occurrence vs `referenceDate`.
 */
function resolveYear(
  day: number,
  month: number,
  alertIndex: number,
  headers: HeaderDate[],
  referenceDate: Date,
): number {
  let header: HeaderDate | null = null;
  for (const h of headers) {
    if (h.index < alertIndex) header = h;
    else break;
  }
  header ??= headers[0] ?? null;

  if (header) {
    let year = header.year;
    const diff =
      new Date(year, month - 1, day).getTime() - header.date.getTime();
    if (diff > HALF_YEAR_MS) year -= 1;
    else if (diff < -HALF_YEAR_MS) year += 1;
    return year;
  }

  let year = referenceDate.getFullYear();
  if (new Date(year, month - 1, day).getTime() > referenceDate.getTime()) {
    year -= 1;
  }
  return year;
}

interface AlertParts {
  symbol: string;
  amountRaw: string;
  merchantRaw: string;
  cardRaw: string;
  dayRaw: string;
  monthRaw: string;
  auth: string;
  kind: 'expense' | 'payment';
}

function buildAlert(
  parts: AlertParts,
  matchIndex: number,
  headers: HeaderDate[],
  referenceDate: Date,
): ParsedAlert | null {
  const valor = parseAlertAmount(parts.amountRaw);
  // Chrome glyphs (unread dot, chevron) OCR'd next to the merchant are noise:
  // they pollute the concept name and destabilize the dedup signature.
  const comercio = parts.merchantRaw
    .replace(GAP_TRIM_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
  const day = parseInt(parts.dayRaw, 10);
  const month =
    MONTHS[parts.monthRaw.toLowerCase().replace(/[1|]/g, 'l').slice(0, 3)];
  if (valor === null || !comercio || !month || day < 1 || day > 31) {
    return null;
  }

  const year = resolveYear(day, month, matchIndex, headers, referenceDate);
  const fecha = toIso(year, month, day);
  if (!fecha) return null;

  return {
    fecha,
    comercio,
    valor,
    currency: detectCurrency(parts.symbol),
    tarjeta: parts.cardRaw.replace(/[.,]+$/, '') || null,
    autorizacion: parts.auth,
    kind: parts.kind,
  };
}

export function parseAlertText(
  text: string,
  referenceDate: Date = new Date(),
): ParsedAlert[] {
  const headers = collectHeaderDates(text);
  const found: { index: number; alert: ParsedAlert }[] = [];

  const push = (index: number, parts: AlertParts) => {
    const alert = buildAlert(parts, index, headers, referenceDate);
    if (alert) found.push({ index, alert });
  };

  for (const m of text.matchAll(CONSUMO_RE)) {
    const [, symbol, amountRaw, merchantRaw, cardRaw, dayRaw, monthRaw, auth] =
      m;
    push(m.index ?? 0, {
      symbol,
      amountRaw,
      merchantRaw,
      cardRaw,
      dayRaw,
      monthRaw,
      auth,
      kind: 'expense',
    });
  }

  for (const m of text.matchAll(MOVIMIENTO_RE)) {
    const [
      ,
      tipo,
      symbol,
      amountRaw,
      cardRaw,
      agenciaRaw,
      dayRaw,
      monthRaw,
      auth,
    ] = m;
    push(m.index ?? 0, {
      symbol,
      amountRaw,
      merchantRaw: `AGENCIA ${agenciaRaw}`,
      cardRaw,
      dayRaw,
      monthRaw,
      auth,
      kind: /^cr/i.test(tipo) ? 'payment' : 'expense',
    });
  }

  for (const m of text.matchAll(RETIRO_RE)) {
    const [, symbol, amountRaw, cajeroRaw, cardRaw, dayRaw, monthRaw, auth] = m;
    push(m.index ?? 0, {
      symbol,
      amountRaw,
      merchantRaw: `CAJERO ${cajeroRaw}`,
      cardRaw,
      dayRaw,
      monthRaw,
      auth,
      kind: 'expense',
    });
  }

  // Restore on-screen order (each pattern scans the text separately).
  return found.sort((a, b) => a.index - b.index).map((f) => f.alert);
}

/**
 * Rough count of alert bodies present in the text, recognized or not.
 * Comparing it against parseAlertText's output detects alerts the regexes
 * missed (OCR garbled a structural token).
 */
export function countAlertCandidates(text: string): number {
  const bodies =
    text.match(/(?:Consumo|Debito|Credito|Retiro)\s+por/gi)?.length ?? 0;
  const headers = text.match(/BiM[oó]vil/gi)?.length ?? 0;
  return Math.max(bodies, headers);
}
