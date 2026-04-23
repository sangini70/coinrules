import express, { Request, Response } from 'express';

const app = express();
const PORT = 4000;
const UPBIT_BASE_URL = 'https://api.upbit.com/v1';

app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  next();
});

app.options('*', (_req, res) => {
  res.sendStatus(204);
});

const handleUpbitError = (res: Response) => {
  res.status(502).json({ error: 'Upbit API failed' });
};

const fetchUpbitJson = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Upbit request failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    throw new Error('Upbit response was not JSON');
  }

  return response.json();
};

app.get('/api/upbit/ticker', async (req: Request, res: Response) => {
  const market = req.query.market;

  if (typeof market !== 'string' || market.trim() === '') {
    res.status(400).json({ error: 'market is required' });
    return;
  }

  try {
    const data = await fetchUpbitJson(
      `${UPBIT_BASE_URL}/ticker?markets=${encodeURIComponent(market)}`,
    );

    res.json({
     data,
     source: 'real'
  });
  } catch {
    handleUpbitError(res);
  }
});

app.get('/api/upbit/candles', async (req: Request, res: Response) => {
  const market = req.query.market;
  const unit = req.query.unit;
  const count = req.query.count;

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

  try {
    const data = await fetchUpbitJson(
      `${UPBIT_BASE_URL}/candles/minutes/${encodeURIComponent(unit)}?market=${encodeURIComponent(
        market,
      )}&count=${encodeURIComponent(count)}`,
    );

    res.json({
     data,
     source: 'real'
    });
  } catch {
    handleUpbitError(res);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
