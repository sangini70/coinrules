import { Translation } from './types';

export const ko: Translation = {
  // System Status
  system_operational: "현재 상태: 정상",
  input_active: "거래 가능 상태",
  input_blocked: "거래 제한됨",
  daily_trades: "오늘 거래",
  consecutive_losses: "연속 손절",
  app_name: "자산 보호 도구",
  system_locked: "거래 제한 상태",
  system_ready: "거래 가능 상태",

  // Navigation
  active: "단타 포지션",
  history: "거래 기록",
  long_term: "장기 보유",
  config: "설정",

  // Execution
  new_execution: "신규 진입",
  market_select: "감시 종목",
  strategy_type: "매매 전략",
  short_term: "단타 (규칙 적용)",
  long_term_strategy: "장기 (관망)",
  buy_price: "매수가",
  sell_price: "매도가",
  auto: "현재값",
  rule_summary: "규칙 안내",
  stop: "손절",
  take: "익절",
  cooldown: "재진입 대기",
  confirm_button: "규칙 확인 후 진입하기",
  blocked_limit: "오늘의 원칙 거래 횟수를 모두 소진했습니다.",
  blocked_tilt: "연속 손실로 인해 감정적 매매 위험이 감지되었습니다. 잠시 휴식이 필요합니다.",
  cooldown_active: "재진입 대기 중",
  cooldown_desc: "재진입 전 15분 관찰 필수",
  minutes_left: "분 대기 필요",
  cooldown_ready: "{time} 후 다시 진입 가능",

  // Position
  holding: "보유 유지",
  holding_desc: "현재 상태 유지 중",
  protected: "본전 보호",
  protected_desc: "추가 손실 없음",
  take_profit_zone: "익절 구간",
  take_profit_desc: "목표 수익 도달 구간",
  stop_loss_required: "손절 임박",
  stop_loss_desc: "즉시 확인 필요",
  current_price: "현재가",
  pnl_return: "수익률",
  net_pnl: "평가 손익",
  close: "종료하기",
  delete: "삭제",

  // New keys/Overwrites for UX optimization
  noActivePositions: "지금은 보유 중인 단타 포지션이 없습니다",
  noActivePositionsDesc: "지금은 진입할 필요가 없습니다",
  shortTerm: "단타",
  longTerm: "장기",
  dangerZone: "손절 임박",
  capitalProtected: "본전 보호",
  inputBlocked: "오늘은 더 이상 거래할 수 없습니다\n이 규칙은 자산 보호를 위한 것입니다",
  newExecution: "신규 진입",
  select_coin: "코인 선택",
  select_strategy: "거래 유형 선택",
  short_term_rules: "단타 (규칙 적용)",
  long_term_obs: "장기 (관망)",
  investment: "투입 금액",
  auto_price: "자동 가격 불러오기",
  stop_loss_val: "손절: -3%",
  take_profit_val: "익절: +5%",
  cooldown_min: "재진입 대기: 15분",
  current_status: "현재 상태",

  // Trade Log
  result_profit: "익절 (규칙 준수)",
  result_loss: "손절 (규칙 준수)",
  result_manual: "수동 종료",
  result_time: "시간 종료",
  date: "날짜",
  coin: "코인",
  result: "결과",
  records_found: "건의 기록이 있습니다",
  no_records: "기록 없음",

  // Long-term
  long_term_desc: "현재 가격 변동은 참고용입니다\n장기 흐름을 유지하세요",

  // Settings
  strategy_config: "전략 설정",
  config_saved: "설정 저장 완료",
  commit_changes: "설정 적용하기",
  purge_all_data: "전체 초기화",
  database_ops: "데이터 백업 및 복구",
  export_json: "데이터 백업",
  restore_json: "데이터 복원",
  data_wipe_desc: "데이터 초기화",

  // Sound Settings
  settings_sound: "알림음 설정",
  enable_sound: "알림음 활성화",
  enable_sound_desc: "위험 감지 시 부드러운 알림음을 재생합니다",
  notify_sl_imminent: "손절 임박 알림",
  notify_sl_desc: "현재가가 손절가에 근접하면 알림",
  notify_cooldown_end: "대기 종료 알림",
  notify_cooldown_desc: "재진입 쿨다운이 종료되면 알림",
  enable_vibration: "진동 알림 (모바일)",
  vibration_desc: "위험 단계 진입 시 짧은 진동 발생",
  volume: "알림 음량",
  master_mute: "모두 음소거",
  mute_desc: "모든 소리와 진동을 즉시 차단",

  // Common/Footer
  backup: "데이터 백업",
  restore: "데이터 복원",
  wipe: "전체 초기화",
  reset_confirm: "모든 기록과 설정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
  status_label: "상태",
  stop_label: "손절가",
  target_label: "익절가",
  amount_label: "투입 금액",
  reason_label: "기록 메모",

  // Philosophy
  philosophy_title: "이 앱은 수익을 극대화하기 위한 도구가 아닙니다",
  philosophy_desc: "손실을 줄이고 판단을 돕기 위한 도구입니다",

  // Signals
  signal_observe: "관찰 필요",
  signal_strong_observe: "주의 관찰",
  signal_neutral: "관망 유지",
  signal_warning: "이 신호는 진입을 의미하지 않습니다\n충분히 관찰한 후 판단하세요",
  waiting_reentry: "재진입 대기",
};
