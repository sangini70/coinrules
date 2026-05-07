const UPBIT_BASE_URL = 'https://api.upbit.com/v1';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${UPBIT_BASE_URL}/market/all?isDetails=false`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
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
