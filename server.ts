import "dotenv/config";
import nodemailer from "nodemailer";
import express from "express";
import type { Request, Response as ExpressResponse } from "express";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const app = express();
const PORT = 4000;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const UPBIT_BASE_URL = 'https://api.upbit.com/v1';
const RESPONSE_SNIPPET_LIMIT = 500;
const UPBIT_REQUEST_SPACING_MS = 350;
const UPBIT_CACHE_TTL_MS = 3000;
const EMAIL_COOLDOWN_MS = 60_000;
const TRADE_POLL_INTERVAL_MS = 15_000;
const ENTRY_TP1_MULTIPLIER = 1.015;
const ENTRY_TP2_MULTIPLIER = 1.03;
const ENTRY_SL_MULTIPLIER = 0.98;
const TRADE_DATA_DIR = join(process.cwd(), 'data');
const TRADE_DATA_FILE = join(TRADE_DATA_DIR, 'trades.json');

let upbitRequestQueue: Promise<void> = Promise.resolve();
let lastUpbitRequestAt = 0;
const lastEmailSentAtByMarket = new Map<string, number>();
const upbitCache = new Map<
  string,
  {
    expiresAt: number;
    data: unknown;
  }
>();


app.use(express.json());

type TradeStatus = 'OPEN' | 'CLOSED';
type TradeResult = 'WIN' | 'LOSS' | null;

interface VirtualTradeRecord {
  id: string;
  time: string | number;
  market: string;
  entryPrice: number;
  score: number;
  tp1: number;
  tp2: number;
  sl: number;
  status: TradeStatus;
  closedAt: string | null;
  exitPrice: number | null;
  exitTime: string | null;
  profitRate?: number;
  result: TradeResult;
}

declare global {
  // eslint-disable-next-line no-var
  var __coinrulesTrades: any[] | undefined;
}

function loadTrades(): VirtualTradeRecord[] {
  try {
    if (!existsSync(TRADE_DATA_FILE)) {
      return [];
    }

    const raw = readFileSync(TRADE_DATA_FILE, 'utf8').trim();
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VirtualTradeRecord[]) : [];
  } catch (error) {
    console.warn('[TRADE] failed to load trade history, starting empty', error);
    return [];
  }
}

function saveTrades() {
  try {
    mkdirSync(TRADE_DATA_DIR, { recursive: true });
    writeFileSync(TRADE_DATA_FILE, JSON.stringify(trades, null, 2), 'utf8');
  } catch (error) {
    console.error('[TRADE] failed to save trade history', error);
  }
}

const trades: VirtualTradeRecord[] = globalThis.__coinrulesTrades ?? loadTrades();
globalThis.__coinrulesTrades = trades;

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  next();
});

app.options('*', (_req, res) => {
  res.sendStatus(204);
});

const readBodySnippet = async (response: globalThis.Response) => {
  try {
    const bodyText = await response.text();
    return bodyText.slice(0, RESPONSE_SNIPPET_LIMIT);
  } catch {
    return '';
  }
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendMail(subject: string, text: string, html?: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject,
    text,
    html,
  });
}

const normalizeMarket = (market: string) => (market.startsWith('KRW-') ? market : `KRW-${market}`);

const calculateProfitRate = (entryPrice: number, exitPrice: number) => {
  if (entryPrice <= 0) return 0;
  return ((exitPrice - entryPrice) / entryPrice) * 100;
};

const hasOpenTradeForMarket = (market: string) =>
  trades.some((trade) => trade.market === market && trade.status === 'OPEN');

const recordEntryTrade = (market: string, entryPrice: number, score: number) => {
  const normalizedMarket = normalizeMarket(market);
  if (!normalizedMarket || entryPrice <= 0) {
    return null;
  }

  if (hasOpenTradeForMarket(normalizedMarket)) {
    console.log(`[TRADE] open trade already exists for ${normalizedMarket}, skipping new entry`);
    return trades.find((trade) => trade.market === normalizedMarket && trade.status === 'OPEN') ?? null;
  }

  const now = new Date().toISOString();
  const trade: VirtualTradeRecord = {
    id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: now,
    market: normalizedMarket,
    entryPrice,
    score: Number.isFinite(score) ? score : 0,
    tp1: entryPrice * ENTRY_TP1_MULTIPLIER,
    tp2: entryPrice * ENTRY_TP2_MULTIPLIER,
    sl: entryPrice * ENTRY_SL_MULTIPLIER,
    status: 'OPEN',
    closedAt: null,
    exitPrice: null,
    exitTime: null,
    result: null,
  };

  trades.push(trade);
  saveTrades();
  console.log('[TRADE] entry recorded', trade);
  return trade;
};

const closeTrade = (trade: VirtualTradeRecord, exitPrice: number, status: 'WIN' | 'LOSS') => {
  trade.status = 'CLOSED';
  trade.result = status;
  trade.closedAt = new Date().toISOString();
  trade.exitPrice = exitPrice;
  trade.exitTime = trade.closedAt;
  trade.profitRate = calculateProfitRate(trade.entryPrice, exitPrice);
  console.log('[TRADE] trade closed', {
    id: trade.id,
    market: trade.market,
    status: trade.status,
    result: trade.result,
    exitPrice: trade.exitPrice,
    profitRate: trade.profitRate,
  });
  saveTrades();
};

const getTradeStats = () => {
  const closedTrades = trades.filter((trade) => trade.status === 'CLOSED');
  return {
    total: trades.length,
    open: trades.filter((trade) => trade.status === 'OPEN').length,
    win: closedTrades.filter((trade) => trade.result === 'WIN').length,
    loss: closedTrades.filter((trade) => trade.result === 'LOSS').length,
  };
};

const updateOpenTradesFromTickers = async () => {
  const openTrades = trades.filter((trade) => trade.status === 'OPEN');
  if (openTrades.length === 0) return;

  const markets = Array.from(new Set(openTrades.map((trade) => trade.market)));
  if (markets.length === 0) return;

  try {
    const url = `${UPBIT_BASE_URL}/ticker?markets=${encodeURIComponent(markets.join(','))}`;
    const { data } = await fetchUpbitJson(url);
    const tickers = Array.isArray(data) ? data : [];

    tickers.forEach((ticker: any) => {
      const market = typeof ticker?.market === 'string' ? ticker.market : '';
      const currentPrice = Number(ticker?.trade_price ?? 0);
      if (!market || currentPrice <= 0) return;

      trades
        .filter((trade) => trade.market === market && trade.status === 'OPEN')
        .forEach((trade) => {
          if (currentPrice >= trade.tp1) {
            closeTrade(trade, currentPrice, 'WIN');
            return;
          }

          if (currentPrice <= trade.sl) {
            closeTrade(trade, currentPrice, 'LOSS');
          }
        });
    });
  } catch (error) {
    console.warn('[TRADE] open trade update failed', error);
  }
};

app.post('/api/email', async (req: Request, res: ExpressResponse) => {
  const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim() : '';
  const market = typeof req.body?.market === 'string' ? req.body.market.trim() : symbol;
  const entryState = typeof req.body?.entryState === 'string' ? req.body.entryState.trim() : '';
  const status = typeof req.body?.status === 'string' ? req.body.status.trim() : entryState;
  const price = Number(req.body?.price ?? req.body?.currentPrice ?? 0);
  const trend = typeof req.body?.trend === 'boolean' ? req.body.trend : null;
  const volume = typeof req.body?.volume === 'boolean' ? req.body.volume : null;
  const breakout = typeof req.body?.breakout === 'boolean' ? req.body.breakout : null;
  const scoreValue = Number(req.body?.score ?? req.body?.signalScore ?? 0);
  const signalScoreValue = Number(req.body?.signalScore ?? scoreValue);
  const prepareState = typeof req.body?.prepareState === 'string' ? req.body.prepareState.trim() : '';
  const coin = market.startsWith('KRW-') ? market.replace('KRW-', '') : market;
  const riskLevel = signalScoreValue >= 80 ? 'LOW' : signalScoreValue >= 60 ? 'MID' : 'HIGH';
  const statusLabel = status === 'ENTRY' ? '진입 가능' : status;
  const actionLabel =
    status === 'ENTRY'
      ? '소액 진입 가능'
      : status === 'OBSERVE'
        ? '관찰 유지'
        : status === 'AVOID'
          ? '매수 금지'
          : status === 'RISK'
            ? '매수 금지 (리스크 구간)'
            : '대기';

  if (!market || !status) {
    res.status(400).json({ error: 'market and status are required' });
    return;
  }

  if (status === 'ENTRY' && Number.isFinite(price) && price > 0) {
    recordEntryTrade(market, price, signalScoreValue);
  }

  const lastSentAt = lastEmailSentAtByMarket.get(market) ?? 0;
  if (Date.now() - lastSentAt < EMAIL_COOLDOWN_MS) {
    res.json({ ok: true, skipped: true });
    return;
  }

  lastEmailSentAtByMarket.set(market, Date.now());

  try {
    const reportState = entryState || status;
    const trendLabel = trend === null ? 'N/A' : trend ? 'OK' : 'NO';
    const volumeLabel = volume === null ? 'N/A' : volume ? 'OK' : 'NO';
    const breakoutLabel = breakout === null ? 'N/A' : breakout ? 'OK' : 'NO';
    const message = `
[진입 판단 리포트]

코인: ${coin}
현재 상태: ${reportState}
현재 가격: ${price.toLocaleString('ko-KR')}

신호 점수: ${signalScoreValue}

[핵심 판단 요소]
Trend: ${trendLabel}
Volume: ${volumeLabel}
Breakout: ${breakoutLabel}

[해석]
${reportState === 'ENTRY' ? '조건 충족  진입 가능' : ''}
${reportState === 'WAIT' ? '조건 일부 부족  대기' : ''}
${reportState === 'AVOID' ? '리스크 높음  진입 금지' : ''}
${reportState === 'RISK' ? '리스크 구간  진입 금지' : ''}
`;
    const emailHtml = `
      <div>
        <p><strong>[진입 판단 리포트]</strong></p>
        <p><strong>코인:</strong> ${coin}</p>
        <p><strong>현재 상태:</strong> ${reportState}</p>
        <p><strong>현재 가격:</strong> ${price.toLocaleString('ko-KR')}</p>
        <p><strong>신호 점수:</strong> ${signalScoreValue}</p>
        <p><strong>핵심 판단 요소:</strong></p>
        <p>Trend: ${trendLabel}</p>
        <p>Volume: ${volumeLabel}</p>
        <p>Breakout: ${breakoutLabel}</p>
        <p><strong>해석:</strong></p>
        <p>${reportState === 'ENTRY' ? '조건 충족  진입 가능' : ''}</p>
        <p>${reportState === 'WAIT' ? '조건 일부 부족  대기' : ''}</p>
        <p>${reportState === 'AVOID' ? '리스크 높음  진입 금지' : ''}</p>
        <p>${reportState === 'RISK' ? '리스크 구간  진입 금지' : ''}</p>
      </div>
    `;
    await sendMail(`[ENTRY] ${coin} | 점수 ${signalScoreValue}`, message, emailHtml);
    res.json({ ok: true });
  } catch (error) {
    console.error('Email send failed.', error);
    res.status(500).json({
      error: 'Email send failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/alerts/email', async (req: Request, res: ExpressResponse) => {
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

  if (!subject || !text) {
    res.status(400).json({ error: 'subject and text are required' });
    return;
  }

  try {
    await sendMail(subject, text);
    res.json({ ok: true });
  } catch (error) {
    console.error('Email send failed.', error);
    res.status(500).json({
      error: 'Email send failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test-only route: manually seed an OPEN trade record without sending email or triggering ENTRY logic.
app.post('/api/trades/test-open', async (req: Request, res: ExpressResponse) => {
  try {
    const requestedPrice = Number(req.body?.price ?? 0);
    let entryPrice = requestedPrice > 0 ? requestedPrice : 0;

    if (entryPrice <= 0) {
      const url = `${UPBIT_BASE_URL}/ticker?markets=${encodeURIComponent('KRW-BTC')}`;
      const { data } = await fetchUpbitJson(url);
      const ticker = Array.isArray(data) ? data[0] : null;
      entryPrice = Number(ticker?.trade_price ?? 0);
    }

    if (entryPrice <= 0) {
      res.status(502).json({ error: 'Unable to resolve BTC price for test-open' });
      return;
    }

    const trade: VirtualTradeRecord = {
      id: String(Date.now()),
      time: Date.now(),
      market: 'KRW-BTC',
      entryPrice,
      score: 45,
      tp1: entryPrice * ENTRY_TP1_MULTIPLIER,
      tp2: entryPrice * ENTRY_TP2_MULTIPLIER,
      sl: entryPrice * ENTRY_SL_MULTIPLIER,
      status: 'OPEN',
      closedAt: null,
      exitPrice: null,
      exitTime: null,
      result: null,
    };

        trades.push(trade);
    saveTrades();
    console.log("?꾩옱 trades 媛쒖닔:", trades.length);
    res.json({
      ok: true,
      trade,
      totals: getTradeStats(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'test-open failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/trades', (_req: Request, res: ExpressResponse) => {
  res.json(trades);
});

app.get('/api/trades/stats', (_req: Request, res: ExpressResponse) => {
  const closedTrades = trades.filter((trade) => trade.status === 'CLOSED');
  const total = trades.length;
  const open = trades.filter(t => t.status === "OPEN").length;
  const win = closedTrades.filter(t => t.result === "WIN").length;
  const loss = closedTrades.filter(t => t.result === "LOSS").length;

  res.json({
    total,
    open,
    win,
    loss
  });
});

const enqueueUpbitRequest = async <T>(task: () => Promise<T>): Promise<T> => {
  const run = upbitRequestQueue.then(task, task) as Promise<T>;
  upbitRequestQueue = run
    .then(
      () => delay(UPBIT_REQUEST_SPACING_MS),
      () => delay(UPBIT_REQUEST_SPACING_MS),
    )
    .then(() => undefined);
  return run;
};

const fetchUpbitJson = async (url: string) => {
  const cached = upbitCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[Upbit Proxy] cache hit -> ${url}`);
    return { data: cached.data, fromCache: true as const };
  }

  return enqueueUpbitRequest(async () => {
    const now = Date.now();
    const waitTime = lastUpbitRequestAt + UPBIT_REQUEST_SPACING_MS - now;
    if (waitTime > 0) {
      await delay(waitTime);
    }
    lastUpbitRequestAt = Date.now();

    console.log(`[Upbit Proxy] fetch -> ${url}`);

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    const contentType = response.headers.get('content-type') ?? '';
    const bodySnippet = await readBodySnippet(response.clone());

    console.log(
      `[Upbit Proxy] status=${response.status} ${response.statusText || ''} content-type=${contentType} body=${bodySnippet}`,
    );

    if (!contentType.includes('application/json')) {
      const error = new Error(`Upbit response was not JSON. status=${response.status}; body=${bodySnippet}`);
      (error as Error & { upbitStatus?: number; upbitStatusText?: string; upbitBody?: string }).upbitStatus = response.status;
      (error as Error & { upbitStatus?: number; upbitStatusText?: string; upbitBody?: string }).upbitStatusText = response.statusText;
      (error as Error & { upbitStatus?: number; upbitStatusText?: string; upbitBody?: string }).upbitBody = bodySnippet;
      throw error;
    }

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(`Upbit request failed with status ${response.status}`);
      (error as Error & { upbitStatus?: number; upbitStatusText?: string; upbitBody?: string }).upbitStatus = response.status;
      (error as Error & { upbitStatus?: number; upbitStatusText?: string; upbitBody?: string }).upbitStatusText = response.statusText;
      (error as Error & { upbitStatus?: number; upbitStatusText?: string; upbitBody?: string }).upbitBody = bodySnippet;
      throw error;
    }

    upbitCache.set(url, {
      data,
      expiresAt: Date.now() + UPBIT_CACHE_TTL_MS,
    });

    return { data, response, bodySnippet, fromCache: false as const };
  });
};

app.get('/api/upbit/ticker', async (req: Request, res: ExpressResponse) => {
  const market =
    typeof req.query.market === 'string' && req.query.market.trim() !== ''
      ? req.query.market.trim()
      : typeof req.query.markets === 'string' && req.query.markets.trim() !== ''
        ? req.query.markets.trim()
        : '';

  if (!market) {
    res.status(400).json({ error: 'market or markets is required' });
    return;
  }

  try {
    const url = `${UPBIT_BASE_URL}/ticker?markets=${encodeURIComponent(market)}`;
    const { data } = await fetchUpbitJson(url);

    res.json({
      data,
      source: 'real',
    });
  } catch (error) {
    const upbitError = error as Error & {
      upbitStatus?: number;
      upbitStatusText?: string;
      upbitBody?: string;
    };
    res.status(upbitError.upbitStatus ?? 502).json({
      error: 'Upbit proxy failed',
      details: upbitError.message,
      upbitStatus: upbitError.upbitStatus ?? null,
      upbitStatusText: upbitError.upbitStatusText ?? null,
      upbitBody: upbitError.upbitBody ?? null,
      url: `${UPBIT_BASE_URL}/ticker?markets=${encodeURIComponent(market)}`,
    });
  }
});

const handleCandlesRequest = async (req: Request, res: ExpressResponse, unit: string) => {
  const market = typeof req.query.market === 'string' ? req.query.market.trim() : '';
  const count = typeof req.query.count === 'string' ? req.query.count.trim() : '';

  if (!market || !count) {
    res.status(400).json({ error: 'market and count are required' });
    return;
  }

  try {
    const url = `${UPBIT_BASE_URL}/candles/minutes/${encodeURIComponent(unit)}?market=${encodeURIComponent(
      market,
    )}&count=${encodeURIComponent(count)}`;
    const { data } = await fetchUpbitJson(url);

    res.json({
      data,
      source: 'real',
    });
  } catch (error) {
    const upbitError = error as Error & {
      upbitStatus?: number;
      upbitStatusText?: string;
      upbitBody?: string;
    };
    res.status(upbitError.upbitStatus ?? 502).json({
      error: 'Upbit proxy failed',
      details: upbitError.message,
      upbitStatus: upbitError.upbitStatus ?? null,
      upbitStatusText: upbitError.upbitStatusText ?? null,
      upbitBody: upbitError.upbitBody ?? null,
      url: `${UPBIT_BASE_URL}/candles/minutes/${encodeURIComponent(unit)}?market=${encodeURIComponent(
        market,
      )}&count=${encodeURIComponent(count)}`,
    });
  }
};

app.get('/api/upbit/candles', async (req: Request, res: ExpressResponse) => {
  const unit = typeof req.query.unit === 'string' ? req.query.unit.trim() : '';

  if (!unit) {
    res.status(400).json({ error: 'unit is required' });
    return;
  }

  await handleCandlesRequest(req, res, unit);
});

app.get('/api/upbit/candles/minutes/:unit', async (req: Request, res: ExpressResponse) => {
  const unit = typeof req.params.unit === 'string' ? req.params.unit.trim() : '';

  if (!unit) {
    res.status(400).json({ error: 'unit is required' });
    return;
  }

  await handleCandlesRequest(req, res, unit);
});

setInterval(() => {
  void updateOpenTradesFromTickers();
}, TRADE_POLL_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

