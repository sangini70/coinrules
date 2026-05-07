export const config = {
  runtime: 'edge',
};

const UPBIT_BASE_URL = 'https://api.upbit.com/v1';

export default async function handler(req: Request) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  try {
    const response = await fetch(`${UPBIT_BASE_URL}/market/all?isDetails=false`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Upbit request failed with status ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify({ data, source: 'real' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Upbit API failed',
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
  }
}
