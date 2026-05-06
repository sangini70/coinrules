import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export type EntryEmailPayload = {
  symbol: string;
  entryState: string;
  price: number;
  trend: boolean;
  volume: boolean;
  breakout: boolean;
  signalScore: number;
};

export const buildEntryEmail = (payload: EntryEmailPayload) => {
  const subject = `[ENTRY] ${payload.symbol} | 점수 ${payload.signalScore}`;
  const text = `
[진입 판단 리포트]

코인: ${payload.symbol}
현재 상태: ${payload.entryState}
현재 가격: ${payload.price.toLocaleString('ko-KR')}

신호 점수: ${payload.signalScore}

[핵심 판단 요소]
Trend: ${payload.trend ? 'OK' : 'NO'}
Volume: ${payload.volume ? 'OK' : 'NO'}
Breakout: ${payload.breakout ? 'OK' : 'NO'}

[해석]
${payload.entryState === 'ENTRY' ? '조건 충족  진입 가능' : ''}
${payload.entryState === 'WAIT' ? '조건 일부 부족  대기' : ''}
${payload.entryState === 'AVOID' ? '리스크 높음  진입 금지' : ''}
${payload.entryState === 'RISK' ? '리스크 구간  진입 금지' : ''}
`.trim();

  const html = `
    <div>
      <p><strong>[진입 판단 리포트]</strong></p>
      <p><strong>코인:</strong> ${payload.symbol}</p>
      <p><strong>현재 상태:</strong> ${payload.entryState}</p>
      <p><strong>현재 가격:</strong> ${payload.price.toLocaleString('ko-KR')}</p>
      <p><strong>신호 점수:</strong> ${payload.signalScore}</p>
      <p><strong>핵심 판단 요소:</strong></p>
      <p>Trend: ${payload.trend ? 'OK' : 'NO'}</p>
      <p>Volume: ${payload.volume ? 'OK' : 'NO'}</p>
      <p>Breakout: ${payload.breakout ? 'OK' : 'NO'}</p>
      <p><strong>해석:</strong></p>
      <p>${payload.entryState === 'ENTRY' ? '조건 충족  진입 가능' : ''}</p>
      <p>${payload.entryState === 'WAIT' ? '조건 일부 부족  대기' : ''}</p>
      <p>${payload.entryState === 'AVOID' ? '리스크 높음  진입 금지' : ''}</p>
      <p>${payload.entryState === 'RISK' ? '리스크 구간  진입 금지' : ''}</p>
    </div>
  `;

  return { subject, text, html };
};

export async function sendMail(subject: string, text: string, html?: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject,
    text,
    html,
  });
}
