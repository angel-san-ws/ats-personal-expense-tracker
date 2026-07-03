import { Injectable, Logger } from '@nestjs/common';

const BANGUAT_URL = 'https://banguat.gob.gt/variables/ws/TipoCambio.asmx';
const SOAP_ACTION = 'http://www.banguat.gob.gt/variables/ws/TipoCambioRango';

/** ISO yyyy-mm-dd → Banguat dd/mm/yyyy. */
function toBanguatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Banguat dd/mm/yyyy → ISO yyyy-mm-dd, or null if malformed. */
function toIsoDate(banguat: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(banguat.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Banco de Guatemala's free SOAP web service for the official daily
 * GTQ/USD reference rate. Publishes every calendar day (weekends carry
 * the previous business day's rate).
 */
@Injectable()
export class BanguatProvider {
  private readonly logger = new Logger(BanguatProvider.name);

  /**
   * Fetch the GTQ-per-USD reference rate for an inclusive ISO date range.
   * Returns a map of ISO date → rate; empty on any failure (never throws).
   */
  async fetchGtqPerUsdRange(
    fromIso: string,
    toIso: string,
  ): Promise<Map<string, number>> {
    const envelope =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<soap:Body>' +
      '<TipoCambioRango xmlns="http://www.banguat.gob.gt/variables/ws/">' +
      `<fechainit>${toBanguatDate(fromIso)}</fechainit>` +
      `<fechafin>${toBanguatDate(toIso)}</fechafin>` +
      '</TipoCambioRango>' +
      '</soap:Body>' +
      '</soap:Envelope>';

    try {
      const res = await fetch(BANGUAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${SOAP_ACTION}"`,
        },
        body: envelope,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Banguat responded ${res.status}`);
        return new Map();
      }
      return this.parse(await res.text());
    } catch (err) {
      this.logger.warn(`Banguat fetch failed: ${(err as Error).message}`);
      return new Map();
    }
  }

  /** Extract ISO date → rate from the SOAP response's <Var> blocks. */
  private parse(xml: string): Map<string, number> {
    const rates = new Map<string, number>();
    for (const [, block] of xml.matchAll(/<Var>([\s\S]*?)<\/Var>/g)) {
      const fecha = /<fecha>([^<]+)<\/fecha>/.exec(block)?.[1];
      // The reference rate comes as <venta> (equal to <compra>).
      const venta =
        /<referencia>([^<]+)<\/referencia>/.exec(block)?.[1] ??
        /<venta>([^<]+)<\/venta>/.exec(block)?.[1];
      if (!fecha || !venta) continue;
      const iso = toIsoDate(fecha);
      const rate = parseFloat(venta);
      if (iso && Number.isFinite(rate) && rate > 0) rates.set(iso, rate);
    }
    return rates;
  }
}
