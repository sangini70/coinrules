import { Translation } from './types';

export const en: Translation = {
  // System Status
  system_operational: "Status: Normal",
  input_active: "Trading Available",
  input_blocked: "Restricted",
  daily_trades: "Trades Today",
  consecutive_losses: "Consecutive Losses",
  app_name: "Capital Safeguard",
  system_locked: "TRADING LOCKED",
  system_ready: "TRADING READY",

  // Navigation
  active: "Active Positions",
  history: "Trade Log",
  long_term: "Long-term Holdings",
  config: "Settings",

  // Execution
  new_execution: "New Entry",
  market_select: "Market",
  strategy_type: "Strategy",
  short_term: "Short-term (Rule-based)",
  long_term_strategy: "Long-term (Observation)",
  buy_price: "Buy Price",
  sell_price: "Sell Price",
  auto: "Current",
  rule_summary: "Rule Summary",
  stop: "Stop Loss",
  take: "Take Profit",
  cooldown: "Cooldown",
  confirm_button: "Enter Position (Confirm Rules)",
  blocked_limit: "Daily trade limit reached. Restraint is advised.",
  blocked_tilt: "Emotional risk detected due to consecutive losses. A break is recommended.",
  cooldown_active: "Cooldown Active",
  cooldown_desc: "15-minute observation required before re-entry",
  minutes_left: "Minutes Remaining",
  cooldown_ready: "Available in {time}",

  // Position
  holding: "Holding",
  holding_desc: "Position stable",
  protected: "Capital Protected",
  protected_desc: "No further loss",
  take_profit_zone: "Take Profit Zone",
  take_profit_desc: "Target reached",
  stop_loss_required: "Stop Loss Imminent",
  stop_loss_desc: "Immediate attention required",
  current_price: "Current Price",
  pnl_return: "PNL %",
  net_pnl: "Net PNL",
  close: "Close Position",
  delete: "Delete",

  // New keys from user
  noActivePositions: "No active short-term positions",
  noActivePositionsDesc: "No entry is needed at this time",
  shortTerm: "Short-term",
  longTerm: "Long-term",
  dangerZone: "Stop Loss Imminent",
  capitalProtected: "Capital Protected",
  inputBlocked: "Trading is disabled for today\nThis rule is designed to protect your capital",
  newExecution: "New Entry",
  select_coin: "Select Coin",
  select_strategy: "Select Strategy",
  short_term_rules: "Short-term (Rule-based)",
  long_term_obs: "Long-term (Observation)",
  investment: "Investment",
  auto_price: "Auto Price",
  stop_loss_val: "Stop Loss: -3%",
  take_profit_val: "Take Profit: +5%",
  cooldown_min: "Cooldown: 15 min",
  current_status: "Current Status",

  // Trade Log
  result_profit: "Take Profit (Rule Kept)",
  result_loss: "Stop Loss (Rule Kept)",
  result_manual: "Manual Exit",
  result_time: "Time",
  date: "Date",
  coin: "Coin",
  result: "Result",
  records_found: "records found",
  no_records: "No Records",

  // Long-term
  long_term_desc: "Short-term fluctuations are not relevant\nMaintain long-term perspective",

  // Settings
  strategy_config: "Strategy Config",
  config_saved: "Settings Saved",
  commit_changes: "Apply Settings",
  purge_all_data: "Reset All Data",
  database_ops: "Data Backup & Restore",
  export_json: "Backup Data",
  restore_json: "Restore Data",
  data_wipe_desc: "Reset Data",

  // Sound Settings
  settings_sound: "Audio Notifications",
  enable_sound: "Enable Sound",
  enable_sound_desc: "Play soft alerts for critical risk events",
  notify_sl_imminent: "Stop Loss Imminent",
  notify_sl_desc: "Alert when price is near stop loss (SL + 1%)",
  notify_cooldown_end: "Cooldown Finished",
  notify_cooldown_desc: "Notify when re-entry cooldown period ends",
  enable_vibration: "Enable Vibration (Mobile)",
  vibration_desc: "Short vibration on critical risk levels",
  volume: "Alert Volume",
  master_mute: "Mute All",
  mute_desc: "Instantly block all sounds and vibrations",

  // Common/Footer
  backup: "Backup Data",
  restore: "Restore Data",
  wipe: "Reset All Data",
  reset_confirm: "Are you sure? This will wipe all trade records and settings.",
  status_label: "Status",
  stop_label: "Stop Loss",
  target_label: "Take Profit",
  amount_label: "Investment",
  reason_label: "Note",

  // Philosophy
  philosophy_title: "This tool is not designed to maximize profit",
  philosophy_desc: "It is designed to reduce loss and support disciplined decisions",

  // Signals
  signal_observe: "Observation Required",
  signal_strong_observe: "Caution Observation",
  signal_neutral: "Neutral",
  signal_warning: "This signal does not indicate entry\nObserve before making a decision",
  waiting_reentry: "Waiting for Re-entry",
};
