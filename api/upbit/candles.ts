export const config = {
  runtime: 'edge',
};

const UPBIT_BASE_URL = 'https://api.upbit.com/v1';

const parsePositiveInteger = (value: string) => {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const market = Array.isArray(req.query?.market) ? req.query.market[0] : req.query?.market;
  const unit = Array.isArray(req.query?.unit) ? req.query.unit[0] : req.query?.unit;
  const count = Array.isArray(req.query?.count) ? req.query.count[0] : req.query?.count;

  if (
    typeof market !== 'string' ||
    market.trim() === '' ||
    typeof unit !== 'string' ||
    unit.trim() === '' ||
    typeof count !== 'string' ||
    count.trim() === ''
  ) {
    res.status(400).json({ error: 'market, unit, count are required' });
    return;
  }

  const parsedUnit = parsePositiveInteger(unit);
  const parsedCount = parsePositiveInteger(count);

  if (parsedUnit === null || parsedCount === null) {
    res.status(400).json({ error: 'unit and count must be positive integers' });
    return;
  }

  try {
    const response = await fetch(
      `${UPBIT_BASE_URL}/candles/minutes/${parsedUnit}?market=${encodeURIComponent(
        market,
      )}&count=${parsedCount}`,
      { headers: { Accept: 'application/json' } },
    );

    if (!response.ok) {
      throw new Error(`Upbit request failed with status ${response.status}`);
    }

    const data = await response.json();

    res.status(200).json({
      data,
      source: 'real',
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Upbit API failed',
    });
  }
}
