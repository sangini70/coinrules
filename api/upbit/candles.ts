const UPBIT_BASE_URL = 'https://api.upbit.com/v1';

const parsePositiveInteger = (value: string | null) => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  const market = url.searchParams.get('market')?.trim();
  const unit = url.searchParams.get('unit');
  const count = url.searchParams.get('count');

  if (!market || !unit || !count) {
    return res.status(400).json({ error: 'market, unit, count are required' });
  }

  const parsedUnit = parsePositiveInteger(unit);
  const parsedCount = parsePositiveInteger(count);

  if (parsedUnit === null || parsedCount === null) {
    return res.status(400).json({ error: 'unit and count must be positive integers' });
  }

  try {
    const requestUrl = `${UPBIT_BASE_URL}/candles/minutes/${parsedUnit}?market=${encodeURIComponent(market)}&count=${parsedCount}`;
    const response = await fetch(requestUrl, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
      const bodySnippet = await response.text();
      console.error(
        `Upbit request failed: status=${response.status} statusText=${response.statusText} url=${requestUrl} body=${bodySnippet.slice(0, 500)}`,
      );
      throw new Error(`Upbit request failed with status ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json({ data, source: 'real' });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Upbit API failed',
    });
  }
}
