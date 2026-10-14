const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('axios', () => ({ default: { create: () => ({ get }) } }));

import { fetchFixRates, parseFixResponse } from '../../../src/clients/banxico/fx-client.js';

const response = (datos?: { fecha: string; dato: string }[]) => ({
  bmx: { series: [{ idSerie: 'SF43718', datos }] },
});

describe('parseFixResponse', () => {
  it('converts dd/MM/yyyy dates and numeric strings', () => {
    expect(
      parseFixResponse(response([{ fecha: '09/10/2026', dato: '18.4123' }]))
    ).toEqual([{ rateDate: '2026-10-09', rate: 18.4123 }]);
  });

  it('skips N/E values and invalid numbers', () => {
    expect(
      parseFixResponse(
        response([
          { fecha: '08/10/2026', dato: 'N/E' },
          { fecha: '09/10/2026', dato: '0' },
          { fecha: '12/10/2026', dato: '18.5' },
        ])
      )
    ).toEqual([{ rateDate: '2026-10-12', rate: 18.5 }]);
  });

  it('returns nothing when the range has no data', () => {
    expect(parseFixResponse(response())).toEqual([]);
  });
});

describe('fetchFixRates', () => {
  beforeEach(() => get.mockReset());

  it('requests the range with the token header', async () => {
    get.mockResolvedValue({ data: response([{ fecha: '09/10/2026', dato: '18.4' }]) });

    const rates = await fetchFixRates('2026-10-05', '2026-10-09');

    expect(get).toHaveBeenCalledExactlyOnceWith(
      '/datos/2026-10-05/2026-10-09',
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(rates).toEqual([{ rateDate: '2026-10-09', rate: 18.4 }]);
  });

  it('splits ranges longer than a year into chunks', async () => {
    get.mockResolvedValue({ data: response([]) });

    await fetchFixRates('2024-01-01', '2025-06-30');

    expect(get.mock.calls.map(([url]) => url)).toEqual([
      '/datos/2024-01-01/2024-12-30',
      '/datos/2024-12-31/2025-06-30',
    ]);
  });

  it('propagates request failures', async () => {
    get.mockRejectedValueOnce(new Error('timeout'));

    const error = await fetchFixRates('2026-10-05', '2026-10-09').catch((e) => e);
    expect(error.message).toBe('timeout');
  });
});
