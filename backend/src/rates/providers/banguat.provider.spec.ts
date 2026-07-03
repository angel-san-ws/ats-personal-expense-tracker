import { BanguatProvider } from './banguat.provider';

const SOAP_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <TipoCambioRangoResponse xmlns="http://www.banguat.gob.gt/variables/ws/">
      <TipoCambioRangoResult>
        <Vars>
          <Var><moneda>2</moneda><fecha>05/06/2026</fecha><venta>7.61933</venta><compra>7.61933</compra></Var>
          <Var><moneda>2</moneda><fecha>06/06/2026</fecha><venta>7.62068</venta><compra>7.62068</compra></Var>
        </Vars>
        <TotalItems>2</TotalItems>
      </TipoCambioRangoResult>
    </TipoCambioRangoResponse>
  </soap:Body>
</soap:Envelope>`;

function mockFetchText(text: string, ok = true): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    text: () => Promise.resolve(text),
  } as unknown as Response);
}

describe('BanguatProvider', () => {
  let provider: BanguatProvider;

  beforeEach(() => {
    provider = new BanguatProvider();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses <Var> blocks into an ISO-keyed rate map', async () => {
    mockFetchText(SOAP_RESPONSE);
    const rates = await provider.fetchGtqPerUsdRange(
      '2026-06-05',
      '2026-06-06',
    );
    expect(Object.fromEntries(rates)).toEqual({
      '2026-06-05': 7.61933,
      '2026-06-06': 7.62068,
    });
  });

  it('sends dates in dd/mm/yyyy format', async () => {
    const spy = mockFetchText(SOAP_RESPONSE);
    await provider.fetchGtqPerUsdRange('2026-06-05', '2026-06-06');
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const body = init.body as string;
    expect(body).toContain('<fechainit>05/06/2026</fechainit>');
    expect(body).toContain('<fechafin>06/06/2026</fechafin>');
  });

  it('returns an empty map on malformed XML', async () => {
    mockFetchText('<not-what-we-expected/>');
    const rates = await provider.fetchGtqPerUsdRange(
      '2026-06-05',
      '2026-06-06',
    );
    expect(rates.size).toBe(0);
  });

  it('returns an empty map on HTTP errors', async () => {
    mockFetchText('server error', false);
    const rates = await provider.fetchGtqPerUsdRange(
      '2026-06-05',
      '2026-06-06',
    );
    expect(rates.size).toBe(0);
  });

  it('returns an empty map (without throwing) when fetch rejects', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network unreachable'));
    const rates = await provider.fetchGtqPerUsdRange(
      '2026-06-05',
      '2026-06-06',
    );
    expect(rates.size).toBe(0);
  });
});
