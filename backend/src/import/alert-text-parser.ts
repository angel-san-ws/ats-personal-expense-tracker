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
 * Card purchase. `\s+` throughout tolerates OCR line wraps; the merchant is a
 * lazy match ended by the literal "Cuenta" keyword.
 */
const CONSUMO_RE =
  /Consumo\s+por\s*(Q|US\$?|USD|\$|€)\s*[.,]?\s*([\d][\d.,]*)\s+en\s+([\s\S]+?)\s+Cuenta\s+(\S+)\s+(\d{1,2})\s*[-–.\s]\s*([A-Za-zÁÉÍÓÚáéíóú]{3,4})\.?\s*(?:\d{1,2}:\d{2})?\s*Autorizaci[oó]n\s*[.:]?\s*(\d+)/gi;

/**
 * Bank-account movement — Debito (transfer/withdrawal → expense) or Credito
 * (deposit → payment): the account comes right after the amount and the
 * channel/branch after "en la Agencia" — that branch name becomes the
 * merchant (prefixed "AGENCIA") since there is no real merchant. The short
 * "en la" connector is matched loosely ([\s\S]{0,14}?) because OCR often
 * garbles it (e.g. "en Ia", "enla").
 */
const MOVIMIENTO_RE =
  /(Debito|Credito)\s+por\s*(Q|US\$?|USD|\$|€)\s*[.,]?\s*([\d][\d.,]*)\s+Cuenta\s+(\S+)[\s\S]{0,14}?\bAgencia\s+([\s\S]+?)\s+(\d{1,2})\s*[-–.\s]\s*([A-Za-zÁÉÍÓÚáéíóú]{3,4})\.?\s*(?:\d{1,2}:\d{2})?\s*Autorizaci[oó]n\s*[.:]?\s*(\d+)/gi;

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
  const comercio = parts.merchantRaw.replace(/\s+/g, ' ').trim();
  const day = parseInt(parts.dayRaw, 10);
  const month = MONTHS[parts.monthRaw.toLowerCase().slice(0, 3)];
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

  // Restore on-screen order (each pattern scans the text separately).
  return found.sort((a, b) => a.index - b.index).map((f) => f.alert);
}
