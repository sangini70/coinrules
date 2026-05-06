export function getExplain({
  state,
  trendReady,
  volumeReady,
  breakoutReady,
  btcTrend,
  score,
}: {
  state: string;
  trendReady: boolean;
  volumeReady: boolean;
  breakoutReady: boolean;
  btcTrend: string;
  score: number;
}) {
  let summary = "";
  let action = "";
  let risk = "";

  if (state === "ENTRY") {
    summary = "소액 매수 가능";
  } else if (state === "OBSERVE") {
    summary = "관망 유지 (매수하지 말 것)";
  } else if (state === "WAIT") {
    summary = "대기";
  } else if (state === "AVOID") {
    summary = "매수 금지";
  } else if (state === "RISK") {
    summary = "매수 금지 (리스크 구간)";
  } else {
    summary = "대기";
  }

  if (state === "ENTRY") {
    if (trendReady && volumeReady && breakoutReady && btcTrend !== "down" && score >= 60) {
      action = "소액으로 매수하고 TP/SL을 지켜라";
    } else {
      action = "테스트 금액만 매수하라";
    }
  } else if (state === "OBSERVE") {
    action = "매수하지 말고 관찰하라";
  } else if (state === "WAIT") {
    action = "아무것도 하지 마라";
  } else if (state === "AVOID") {
    action = "매수하지 마라";
  } else if (state === "RISK") {
    action = "절대 매수하지 마라";
  } else {
    action = "아무것도 하지 마라";
  }

  let riskScore = 0;
  if (!trendReady) riskScore += 1;
  if (!volumeReady) riskScore += 1;
  if (!breakoutReady) riskScore += 1;
  if (btcTrend === "down") riskScore += 1;

  if (riskScore <= 1) {
    risk = "LOW";
  } else if (riskScore <= 2) {
    risk = "MID";
  } else {
    risk = "HIGH";
  }

  return {
    summary,
    action,
    risk,
  };
}
