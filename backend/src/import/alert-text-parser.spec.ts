import { countAlertCandidates, parseAlertText } from './alert-text-parser';

describe('parseAlertText', () => {
  it('tolerates chrome glyphs (unread dot, chevron) OCR injects between tokens', () => {
    // Real 06/07/2026 screenshot: the unread dot lands as "*"/"•" and the row
    // chevron as "›"/"»" inside the alert text; the Q.79.00 alert was dropped.
    const text = `
      06/07/2026 19:55
      BiMovil: Consumo por Q.448.80 en
      * DOLLARCITY PERIFERICO Cuenta
      TCADICIONAL 06-Jul 19:55 Autorizacion
      231819.

      06/07/2026 15:09
      BiMovil: Consumo por Q.6.00 en
      PedidosYa*Propina Cuenta TCREDITO8 › 06-Jul
      15:09 Autorizacion 248950.

      06/07/2026 14:22
      • BiMovil: Consumo por Q.79.00 en
      PedidosYa*La Esquina De Cuenta TCREDITO8 »
      06-Jul 14:22 • Autorizacion 148714.
    `;
    const alerts = parseAlertText(text);
    expect(alerts.map((a) => [a.comercio, a.valor, a.autorizacion])).toEqual([
      ['DOLLARCITY PERIFERICO', 448.8, '231819'],
      ['PedidosYa*Propina', 6, '248950'],
      ['PedidosYa*La Esquina De', 79, '148714'],
    ]);
    expect(alerts.every((a) => a.fecha === '2026-07-06')).toBe(true);
  });

  it('tolerates l → 1/I confusion in the month abbreviation', () => {
    const text =
      'BiMovil: Consumo por Q.10.00 en X Cuenta T1 02-Ju1 20:24 Autorizacion 1. ' +
      'BiMovil: Consumo por Q.11.00 en Y Cuenta T1 03-JuI 09:00 Autorizacion 2.';
    const alerts = parseAlertText(text, new Date(2026, 6, 6));
    expect(alerts.map((a) => a.fecha)).toEqual(['2026-07-02', '2026-07-03']);
  });

  it('parses a full notification-list screenshot text (BiMovil)', () => {
    const text = `
      Alerts
      Notifications  Biometric Token

      02/07/2026  20:24
      BiMovil: Consumo por Q.59.00 en
      MCDONALDS PERIFERICO Cuenta TCREDITO8
      02-Jul 20:24 Autorizacion 276178.

      02/07/2026  20:17
      BiMovil: Consumo por Q.20.00 en PARQUEOS
      Cuenta TCREDITO8 02-Jul 20:17 Autorizacion
      235350.

      02/07/2026  20:03
      BiMovil: Consumo por Q.49.70 en KOMBI
      BISTRO Cuenta TCADICIONAL 02-Jul 20:03
      Autorizacion 254893.

      02/07/2026  15:12
      BiMovil: Consumo por Q.164.00 en POLLO
      CAMPERO 106 BOLIV Cuenta TCREDITO8 02-
      Jul 15:12 Autorizacion 164875.
    `;

    const alerts = parseAlertText(text);
    expect(alerts).toEqual([
      {
        fecha: '2026-07-02',
        comercio: 'MCDONALDS PERIFERICO',
        valor: 59,
        currency: 'GTQ',
        tarjeta: 'TCREDITO8',
        autorizacion: '276178',
        kind: 'expense',
      },
      {
        fecha: '2026-07-02',
        comercio: 'PARQUEOS',
        valor: 20,
        currency: 'GTQ',
        tarjeta: 'TCREDITO8',
        autorizacion: '235350',
        kind: 'expense',
      },
      {
        fecha: '2026-07-02',
        comercio: 'KOMBI BISTRO',
        valor: 49.7,
        currency: 'GTQ',
        tarjeta: 'TCADICIONAL',
        autorizacion: '254893',
        kind: 'expense',
      },
      {
        fecha: '2026-07-02',
        comercio: 'POLLO CAMPERO 106 BOLIV',
        valor: 164,
        currency: 'GTQ',
        tarjeta: 'TCREDITO8',
        autorizacion: '164875',
        kind: 'expense',
      },
    ]);
  });

  it('parses bank-account debit alerts (Debito por ... en la Agencia ...)', () => {
    const text = `
      04/07/2026  09:08
      BiMovil: Debito por Q.450.00 Cuenta MONE1
      en la Agencia DIGITAL 04-Jul 09:08
      Autorizacion 109169.

      03/07/2026  23:34
      BiMovil: Consumo por Q.40.95 en 100
      MONTADITOS MAJADAS Cuenta TCREDITO8
      03-Jul 23:34 Autorizacion 312038.
    `;
    const alerts = parseAlertText(text);
    expect(alerts).toEqual([
      {
        fecha: '2026-07-04',
        comercio: 'AGENCIA DIGITAL',
        valor: 450,
        currency: 'GTQ',
        tarjeta: 'MONE1',
        autorizacion: '109169',
        kind: 'expense',
      },
      {
        fecha: '2026-07-03',
        comercio: '100 MONTADITOS MAJADAS',
        valor: 40.95,
        currency: 'GTQ',
        tarjeta: 'TCREDITO8',
        autorizacion: '312038',
        kind: 'expense',
      },
    ]);
  });

  it('detects USD written as "US." (bank style) and keeps * in merchants', () => {
    const text = `
      02/07/2026  11:20
      BiMovil: Consumo por US.20.00 en
      ANTHROPIC* CLAUDE SUB Cuenta
      TCREDITO8 02-Jul 11:20 Autorizacion 186166.

      02/07/2026  00:05
      BiMovil: Consumo por Q.208.50 en ESTACION
      TIENDA DE CONV Cuenta TCADICIONAL 02-
      Jul 00:05 Autorizacion 97675.
    `;
    const alerts = parseAlertText(text);
    expect(alerts).toEqual([
      {
        fecha: '2026-07-02',
        comercio: 'ANTHROPIC* CLAUDE SUB',
        valor: 20,
        currency: 'USD',
        tarjeta: 'TCREDITO8',
        autorizacion: '186166',
        kind: 'expense',
      },
      {
        fecha: '2026-07-02',
        comercio: 'ESTACION TIENDA DE CONV',
        valor: 208.5,
        currency: 'GTQ',
        tarjeta: 'TCADICIONAL',
        autorizacion: '97675',
        kind: 'expense',
      },
    ]);
  });

  it('imports account credits (deposits) as payments', () => {
    const text = `
      04/07/2026  13:24
      BiMovil: Credito por Q.2,500.00 Cuenta
      MONE1 en la Agencia DIGITAL  04-Jul 13:24
      Autorizacion 228722.

      04/07/2026  13:24
      BiMovil: Consumo por Q.144.70 en TIENDA DE
      CONVENIENCIA Cuenta TCREDITO8 04-Jul
      13:24 Autorizacion 203989.
    `;
    const alerts = parseAlertText(text);
    expect(alerts).toEqual([
      {
        fecha: '2026-07-04',
        comercio: 'AGENCIA DIGITAL',
        valor: 2500,
        currency: 'GTQ',
        tarjeta: 'MONE1',
        autorizacion: '228722',
        kind: 'payment',
      },
      {
        fecha: '2026-07-04',
        comercio: 'TIENDA DE CONVENIENCIA',
        valor: 144.7,
        currency: 'GTQ',
        tarjeta: 'TCREDITO8',
        autorizacion: '203989',
        kind: 'expense',
      },
    ]);
  });

  it('imports ATM withdrawals (Retiro por ... en el Cajero ...) as expenses', () => {
    const text = `
      08/07/2026  19:06
      BiMovil: Retiro por Q.2000.00 en el Cajero
      Shell Select Mariscal Z con su tarjeta
      BICHEQUE3 08-Jul 19:06 Aut.265159.
    `;
    const alerts = parseAlertText(text);
    expect(alerts).toEqual([
      {
        fecha: '2026-07-08',
        comercio: 'CAJERO Shell Select Mariscal Z',
        valor: 2000,
        currency: 'GTQ',
        tarjeta: 'BICHEQUE3',
        autorizacion: '265159',
        kind: 'expense',
      },
    ]);
    expect(countAlertCandidates(text)).toBe(1);
  });

  it('tolerates OCR garbling of the "en la" connector before Agencia', () => {
    const text =
      '04/07/2026 13:24 BiMovil: Credito por Q.2,500.00 Cuenta MONE1 en Ia Agencia DIGITAL 04-Jul 13:24 Autorizacion 228722. ' +
      '04/07/2026 09:08 BiMovil: Debito por Q.450.00 Cuenta MONE1 enla Agencia DIGITAL 04-Jul 09:08 Autorizacion 109169.';
    const alerts = parseAlertText(text);
    expect(alerts.map((a) => [a.kind, a.valor, a.comercio])).toEqual([
      ['payment', 2500, 'AGENCIA DIGITAL'],
      ['expense', 450, 'AGENCIA DIGITAL'],
    ]);
  });

  it('detects USD written as "US$" or "USD"', () => {
    const text =
      'BiMovil: Consumo por US$ 15.00 en A Cuenta T1 02-Jul 10:00 Autorizacion 8. ' +
      'BiMovil: Consumo por USD.16.00 en B Cuenta T1 02-Jul 10:05 Autorizacion 9.';
    const alerts = parseAlertText(text, new Date(2026, 6, 4));
    expect(alerts.map((a) => [a.currency, a.valor])).toEqual([
      ['USD', 15],
      ['USD', 16],
    ]);
  });

  it('parses thousands separators and detects USD from $', () => {
    const text =
      '02/07/2026 10:00 BiMovil: Consumo por $ 1,234.56 en AMAZON MKTPL Cuenta TCREDITO8 01-Jul 10:00 Autorizacion 111222.';
    const [alert] = parseAlertText(text);
    expect(alert.valor).toBe(1234.56);
    expect(alert.currency).toBe('USD');
    expect(alert.fecha).toBe('2026-07-01');
  });

  it('tolerates OCR comma/period noise in the amount (Q,59,00)', () => {
    const text =
      '02/07/2026 20:24 BiMovil: Consumo por Q,59,00 en MCDONALDS Cuenta TCREDITO8 02-Jul 20:24 Autorizacion 276178.';
    const [alert] = parseAlertText(text);
    expect(alert.valor).toBe(59);
    expect(alert.currency).toBe('GTQ');
  });

  it('infers the year from the reference date when there is no header', () => {
    const ref = new Date(2026, 6, 4); // 2026-07-04
    const sameYear = parseAlertText(
      'BiMovil: Consumo por Q.10.00 en X Cuenta T1 02-Jul 20:24 Autorizacion 1.',
      ref,
    );
    expect(sameYear[0].fecha).toBe('2026-07-02');

    // A December alert seen in July must belong to the previous year.
    const prevYear = parseAlertText(
      'BiMovil: Consumo por Q.10.00 en X Cuenta T1 15-Dic 09:00 Autorizacion 2.',
      ref,
    );
    expect(prevYear[0].fecha).toBe('2025-12-15');
  });

  it('corrects the year across New Year (December alert, January header)', () => {
    const text =
      '03/01/2027 08:00 BiMovil: Consumo por Q.10.00 en X Cuenta T1 30-Dic 22:00 Autorizacion 3.';
    expect(parseAlertText(text)[0].fecha).toBe('2026-12-30');
  });

  it('understands Spanish and English month abbreviations', () => {
    const text =
      '05/08/2026 08:00 BiMovil: Consumo por Q.10.00 en X Cuenta T1 04-Ago 12:00 Autorizacion 4. ' +
      'BiMovil: Consumo por Q.11.00 en Y Cuenta T1 04-Aug 12:30 Autorizacion 5.';
    const alerts = parseAlertText(text);
    expect(alerts.map((a) => a.fecha)).toEqual(['2026-08-04', '2026-08-04']);
  });

  it('returns an empty list for unrelated text', () => {
    expect(parseAlertText('Nothing to see here 02/07/2026')).toEqual([]);
    expect(parseAlertText('')).toEqual([]);
  });

  it('counts alert candidates so missed alerts can be detected', () => {
    const text =
      'BiMovil: Consumo por Q.10.00 en X Cuenta T1 02-Jul 20:24 Autorizacion 1. ' +
      'BiMovil: Consumo por Q.20.00 garbled beyond recognition';
    expect(countAlertCandidates(text)).toBe(2);
    expect(parseAlertText(text, new Date(2026, 6, 6))).toHaveLength(1);
    expect(countAlertCandidates('nothing here')).toBe(0);
  });

  it('skips alerts with an unrecognizable month but keeps the rest', () => {
    const text =
      '02/07/2026 BiMovil: Consumo por Q.10.00 en X Cuenta T1 02-Xyz 20:24 Autorizacion 6. ' +
      'BiMovil: Consumo por Q.20.00 en Y Cuenta T1 02-Jul 20:30 Autorizacion 7.';
    const alerts = parseAlertText(text);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].comercio).toBe('Y');
  });
});
