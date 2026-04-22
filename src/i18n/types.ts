export interface Translation {
  // System Status
  system_operational: string;
  input_active: string;
  input_blocked: string;
  daily_trades: string;
  consecutive_losses: string;
  app_name: string;
  system_locked: string;
  system_ready: string;
  
  // Navigation
  active: string;
  history: string;
  long_term: string;
  config: string;

  // Execution
  new_execution: string;
  market_select: string;
  strategy_type: string;
  short_term: string;
  long_term_strategy: string;
  buy_price: string;
  sell_price: string;
  auto: string;
  rule_summary: string;
  stop: string;
  take: string;
  cooldown: string;
  confirm_button: string;
  blocked_limit: string;
  blocked_tilt: string;
  cooldown_active: string;
  cooldown_desc: string;
  minutes_left: string;
  cooldown_ready: string;

  // Position
  holding: string;
  holding_desc: string;
  protected: string;
  protected_desc: string;
  take_profit_zone: string;
  take_profit_desc: string;
  stop_loss_required: string;
  stop_loss_desc: string;
  current_price: string;
  pnl_return: string;
  net_pnl: string;
  close: string;
  delete: string;

  // New keys from user
  noActivePositions: string;
  noActivePositionsDesc: string;
  shortTerm: string;
  longTerm: string;
  dangerZone: string;
  capitalProtected: string;
  inputBlocked: string;
  newExecution: string;
  select_coin: string;
  select_strategy: string;
  short_term_rules: string;
  long_term_obs: string;
  investment: string;
  auto_price: string;
  stop_loss_val: string;
  take_profit_val: string;
  cooldown_min: string;
  current_status: string;

  // Trade Log
  result_profit: string;
  result_loss: string;
  result_manual: string;
  result_time: string;
  date: string;
  coin: string;
  result: string;
  records_found: string;
  no_records: string;

  // Long-term
  long_term_desc: string;

  // Settings
  strategy_config: string;
  config_saved: string;
  commit_changes: string;
  purge_all_data: string;
  database_ops: string;
  export_json: string;
  restore_json: string;
  data_wipe_desc: string;
  
  // Sound Settings
  settings_sound: string;
  enable_sound: string;
  enable_sound_desc: string;
  notify_sl_imminent: string;
  notify_sl_desc: string;
  notify_cooldown_end: string;
  notify_cooldown_desc: string;
  enable_vibration: string;
  vibration_desc: string;
  volume: string;
  master_mute: string;
  mute_desc: string;

  // Common/Footer
  backup: string;
  restore: string;
  wipe: string;
  reset_confirm: string;
  status_label: string;
  stop_label: string;
  target_label: string;
  amount_label: string;
  reason_label: string;

  // Philosophy
  philosophy_title: string;
  philosophy_desc: string;

  // Signals
  signal_observe: string;
  signal_strong_observe: string;
  signal_neutral: string;
  signal_warning: string;
  waiting_reentry: string;
}

export type TranslationKey = keyof Translation;
