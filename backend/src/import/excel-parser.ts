import * as XLSX from 'xlsx';

export type ParsedKind = 'expense' | 'payment';

export interface ParsedRow {
  fecha: string; // yyyy-mm-dd
  tarjeta: string | null;
  noTarjeta: string | null;
  nombre: string | null;
  tipoMovimiento: string | null;
  noDoc: string | null;
  comercio: string;
  valor: number;
  saldo: number | null;
  kind: ParsedKind;
  /** ISO currency code detected from the amount symbol, or null if unknown. */
  currency: string | null;
}

/** Detect the currency of an amount cell from its symbol. */
function detectCurrency(raw: unknown): string | null {
  const s = String(raw ?? '');
  if (s.includes('$')) return 'USD';
  if (s.includes('€')) return 'EUR';
  if (/Q/i.test(s)) return 'GTQ';
  return null;
}

/** Descriptions that indicate a payment / credit rather than a purchase. */
const PAYMENT_DESC_RE =
  /p\.?\s*elec|(^|\s)pago(\b|\.)|(^|\s)abono|su\s*pago|pago\s*recibido|pago\s*gracias|nota\s*de\s*cr[eé]dito|(^|\s)dep[oó]sito|reverso|reversa|devoluci[oó]n/i;

/**
 * Classify a line as a payment or an expense.
 * Signals (any is sufficient):
 *  - the running balance (SALDO) decreased vs. the previous line → a credit/payment
 *  - the movement type is CREDITO
 *  - the description looks like a payment (e.g. "P. ELEC. EN QUETZA.", "PAGO")
 */
function classifyKind(
  row: {
    tipoMovimiento: string | null;
    comercio: string;
    saldo: number | null;
  },
  prevSaldo: number | null,
): ParsedKind {
  const isCredit = /cr[eé]dito/i.test(row.tipoMovimiento ?? '');
  const looksLikePayment = PAYMENT_DESC_RE.test(row.comercio);
  const balanceDropped =
    row.saldo !== null && prevSaldo !== null && row.saldo < prevSaldo - 0.005;
  return isCredit || looksLikePayment || balanceDropped ? 'payment' : 'expense';
}

export interface ParsedStatement {
  metadata: {
    cardholderName: string | null;
    cardNumber: string | null;
    creditLimit: number | null;
    availableLimit: number | null;
    pastDueBalance: number | null;
    minimumPayment: number | null;
    statementDate: string | null; // yyyy-mm-dd (FECHA DE CORTE)
    paymentDueDate: string | null; // yyyy-mm-dd (FECHA DE PAGO)
  };
  rows: ParsedRow[];
}

/** Normalize a header/label: lowercase, strip accents, collapse whitespace, drop punctuation. */
function norm(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse "Q. 27,561.01" / "Q 22.74" / "1,234.50" / "-Q. 50.00" -> number.
 * Extracts the numeric token so the "." in the "Q." currency abbreviation is
 * not mistaken for a decimal point.
 */
function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  // Treat trailing "CR"/"(...)" or a leading minus as negative.
  const negative = /^-|\(.*\)|\bcr\b/i.test(raw);
  const withoutThousands = raw.replace(/,/g, '');
  const match = withoutThousands.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Parse a date cell (DD/MM/YYYY, DD-MM-YYYY, or an Excel Date) -> yyyy-mm-dd. */
function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return toIso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const str = String(value).trim();
  const m = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    let year = parseInt(y, 10);
    if (year < 100) year += 2000;
    return toIso(year, parseInt(mo, 10), parseInt(d, 10));
  }

  // Fallback: yyyy-mm-dd already
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return toIso(+iso[1], +iso[2], +iso[3]);

  return null;
}

function toIso(y: number, m: number, d: number): string | null {
  if (!y || !m || !d || m > 12 || d > 31) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Column header -> matcher. Order matters: more specific first. */
type ColKey =
  | 'fecha'
  | 'tarjeta'
  | 'noTarjeta'
  | 'nombre'
  | 'tipoMovimiento'
  | 'noDoc'
  | 'comercio'
  | 'valor'
  | 'saldo';

function detectColumns(headerRow: unknown[]): Record<ColKey, number> {
  const cols = {} as Record<ColKey, number>;
  const normalized = headerRow.map((c) => norm(c));

  const findExact = (target: string) =>
    normalized.findIndex((h) => h === target);
  const findIncludes = (target: string) =>
    normalized.findIndex((h) => h.includes(target));

  cols.noTarjeta = findExact('no tarjeta');
  cols.tarjeta = normalized.findIndex(
    (h, i) => h === 'tarjeta' && i !== cols.noTarjeta,
  );
  cols.fecha = findExact('fecha');
  cols.nombre = findExact('nombre');
  cols.tipoMovimiento =
    findIncludes('movimiento') !== -1
      ? findIncludes('movimiento')
      : findIncludes('tipo');
  cols.noDoc = findIncludes('doc');
  cols.comercio =
    findExact('comercio') !== -1
      ? findExact('comercio')
      : findIncludes('comercio');
  cols.valor = findExact('valor');
  cols.saldo = findExact('saldo');

  return cols;
}

/** True if a row looks like the transaction header. */
function isHeaderRow(row: unknown[]): boolean {
  const set = new Set(row.map((c) => norm(c)));
  return set.has('fecha') && set.has('comercio') && set.has('valor');
}

/** Extract statement metadata from the block above the header row. */
function parseMetadata(
  rows: unknown[][],
  headerIndex: number,
): ParsedStatement['metadata'] {
  const meta: ParsedStatement['metadata'] = {
    cardholderName: null,
    cardNumber: null,
    creditLimit: null,
    availableLimit: null,
    pastDueBalance: null,
    minimumPayment: null,
    statementDate: null,
    paymentDueDate: null,
  };

  // Flat list of {r, c, value} for the top block.
  const block = rows.slice(0, headerIndex);

  const valueRightOf = (r: number, c: number): unknown => {
    const row = block[r] ?? [];
    for (let i = c + 1; i < row.length; i++) {
      if (
        row[i] !== null &&
        row[i] !== undefined &&
        String(row[i]).trim() !== ''
      ) {
        return row[i];
      }
    }
    return null;
  };

  for (let r = 0; r < block.length; r++) {
    const row = block[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell === null || cell === undefined) continue;
      const label = norm(cell);
      const raw = String(cell).trim();

      // Card number like 4487-XXXX-XXXX-2839
      if (!meta.cardNumber && /\d{4}[-\s]?x{2,}/i.test(raw)) {
        meta.cardNumber = raw.replace(/\s+/g, '');
      }

      if (label.includes('limite') && label.includes('credito')) {
        meta.creditLimit = parseAmount(valueRightOf(r, c));
      } else if (label.includes('limite') && label.includes('disponible')) {
        meta.availableLimit = parseAmount(valueRightOf(r, c));
      } else if (label.includes('saldo') && label.includes('mora')) {
        meta.pastDueBalance = parseAmount(valueRightOf(r, c));
      } else if (label.includes('pago minimo')) {
        meta.minimumPayment = parseAmount(valueRightOf(r, c));
      } else if (label.includes('fecha de corte')) {
        meta.statementDate = parseDate(valueRightOf(r, c));
      } else if (label.includes('fecha de pago')) {
        meta.paymentDueDate = parseDate(valueRightOf(r, c));
      }
    }
  }

  // Cardholder name: first "name-like" cell (2+ uppercase words) in the block.
  outer: for (let r = 0; r < block.length; r++) {
    const row = block[r] ?? [];
    for (const cell of row) {
      const raw = String(cell ?? '').trim();
      if (
        raw.length >= 5 &&
        /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.]+$/.test(raw) &&
        raw.split(/\s+/).length >= 2 &&
        !/limite|saldo|fecha|pago|banco|industrial|complejo|zona/i.test(raw)
      ) {
        meta.cardholderName = raw;
        break outer;
      }
    }
  }

  return meta;
}

export function parseStatement(buffer: Buffer): ParsedStatement {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The file has no worksheets');
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  const headerIndex = rows.findIndex((r) => isHeaderRow(r));
  if (headerIndex === -1) {
    throw new Error(
      'Could not find the transactions header (a row with FECHA, COMERCIO and VALOR).',
    );
  }

  const cols = detectColumns(rows[headerIndex]);
  if (cols.fecha === -1 || cols.comercio === -1 || cols.valor === -1) {
    throw new Error('Required columns FECHA / COMERCIO / VALOR are missing.');
  }

  const metadata = parseMetadata(rows, headerIndex);

  const parsedRows: ParsedRow[] = [];
  let prevSaldo: number | null = null;
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const at = (idx: number): unknown => (idx >= 0 ? row[idx] : null);

    const comercioRaw = at(cols.comercio);
    const comercio = comercioRaw ? String(comercioRaw).trim() : '';
    const valor = parseAmount(at(cols.valor));
    const fecha = parseDate(at(cols.fecha));

    // A valid transaction needs a merchant and an amount.
    if (!comercio || valor === null) continue;
    // Skip summary/total rows.
    if (/^(total|saldo anterior|pago|abono)/i.test(comercio) && !fecha)
      continue;

    const strOrNull = (v: unknown): string | null => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s === '' ? null : s;
    };

    const saldo = parseAmount(at(cols.saldo));
    const tipoMovimiento = strOrNull(at(cols.tipoMovimiento));
    const kind = classifyKind({ tipoMovimiento, comercio, saldo }, prevSaldo);
    if (saldo !== null) prevSaldo = saldo;
    const currency =
      detectCurrency(at(cols.valor)) ?? detectCurrency(at(cols.saldo));

    parsedRows.push({
      fecha:
        fecha ??
        metadata.statementDate ??
        new Date(0).toISOString().slice(0, 10),
      tarjeta: strOrNull(at(cols.tarjeta)),
      noTarjeta: strOrNull(at(cols.noTarjeta)),
      nombre: strOrNull(at(cols.nombre)),
      tipoMovimiento,
      noDoc: strOrNull(at(cols.noDoc)),
      comercio,
      valor,
      saldo,
      kind,
      currency,
    });
  }

  return { metadata, rows: parsedRows };
}
