import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendMail } from './_mail.js';

type EmailPayload = {
  symbol?: string;
  market?: string;
  entryState?: string;
  status?: string;
  price?: number;
  currentPrice?: number;
  trend?: boolean;
  volume?: boolean;
  breakout?: boolean;
  score?: number;
  signalScore?: number;
  prepareState?: string;
};

type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

const enhanceResponse = (res: ServerResponse) => {
  const response = res as ApiResponse;
  response.status = (code: number) => {
    response.statusCode = code;
    return response;
  };
  response.json = (body: unknown) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(body));
  };
  return response;
};

const parseBody = async (req: IncomingMessage) => {
  const body = (req as IncomingMessage & { body?: unknown }).body;
  if (body && typeof body === 'object') {
    return body as EmailPayload;
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as EmailPayload;
    } catch {
      return {} as EmailPayload;
    }
  }

  return {} as EmailPayload;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const response = enhanceResponse(res);

  if (req.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const symbol = typeof body.symbol === 'string' ? body.symbol.trim() : '';
    const market = typeof body.market === 'string' ? body.market.trim() : symbol;
    const entryState = typeof body.entryState === 'string' ? body.entryState.trim() : '';
    const status = typeof body.status === 'string' ? body.status.trim() : entryState;
    const price = Number(body.price ?? body.currentPrice ?? 0);
    const trend = typeof body.trend === 'boolean' ? body.trend : null;
    const volume = typeof body.volume === 'boolean' ? body.volume : null;
    const breakout = typeof body.breakout === 'boolean' ? body.breakout : null;
    const signalScore = Number(body.signalScore ?? body.score ?? 0);
    const prepareState = typeof body.prepareState === 'string' ? body.prepareState.trim() : '';
    const coin = market.startsWith('KRW-') ? market.replace('KRW-', '') : market;
    const reportState = entryState || status || 'ENTRY';
    const trendLabel = trend === null ? 'N/A' : trend ? 'OK' : 'NO';
    const volumeLabel = volume === null ? 'N/A' : volume ? 'OK' : 'NO';
    const breakoutLabel = breakout === null ? 'N/A' : breakout ? 'OK' : 'NO';
    const riskLevel = signalScore >= 80 ? 'LOW' : signalScore >= 60 ? 'MID' : 'HIGH';

    if (!coin || !reportState || !Number.isFinite(price) || price <= 0) {
      return response.status(400).json({ error: 'symbol, entryState, and price are required' });
    }

    const message = `
[진입 판단 리포트]

코인: ${coin}
현재 상태: ${reportState}
현재 가격: ${price.toLocaleString('ko-KR')}
신호 점수: ${signalScore}/100
진입 단계: ${prepareState || 'N/A'}

[핵심 판단 요소]
Trend: ${trendLabel}
Volume: ${volumeLabel}
Breakout: ${breakoutLabel}

[다음 행동]
${reportState === 'ENTRY' ? '소액 진입 가능' : reportState === 'OBSERVE' ? '관찰 유지' : reportState === 'AVOID' ? '진입 금지' : reportState === 'RISK' ? '리스크 구간' : '대기'}

[리스크]
${riskLevel}
`.trim();

    const emailHtml = `
      <div>
        <p><strong>[진입 판단 리포트]</strong></p>
        <p><strong>코인:</strong> ${coin}</p>
        <p><strong>현재 상태:</strong> ${reportState}</p>
        <p><strong>현재 가격:</strong> ${price.toLocaleString('ko-KR')}</p>
        <p><strong>신호 점수:</strong> ${signalScore}/100</p>
        <p><strong>진입 단계:</strong> ${prepareState || 'N/A'}</p>
        <p><strong>핵심 판단 요소:</strong></p>
        <p>Trend: ${trendLabel}</p>
        <p>Volume: ${volumeLabel}</p>
        <p>Breakout: ${breakoutLabel}</p>
        <p><strong>다음 행동:</strong> ${
          reportState === 'ENTRY'
            ? '소액 진입 가능'
            : reportState === 'OBSERVE'
              ? '관찰 유지'
              : reportState === 'AVOID'
                ? '진입 금지'
                : reportState === 'RISK'
                  ? '리스크 구간'
                  : '대기'
        }</p>
        <p><strong>리스크:</strong> ${riskLevel}</p>
      </div>
    `;

    await sendMail(`[ENTRY] ${coin} | 점수 ${signalScore}`, message, emailHtml);

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Email send failed.', error);
    return response.status(500).json({
      error: 'Email send failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
