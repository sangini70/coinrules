export const config = {
  runtime: 'edge',
};

const UPBIT_BASE_URL = 'https://api.upbit.com/v1';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const market = Array.isArray(req.query?.market) ? req.query.market[0] : req.query?.market;

  if (typeof market !== 'string' || market.trim() === '') {
    res.status(400).json({ error: 'market is required' });
    return;
  }

  try {
    const response = await fetch(
      `${UPBIT_BASE_URL}/ticker?markets=${encodeURIComponent(market)}`,
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
