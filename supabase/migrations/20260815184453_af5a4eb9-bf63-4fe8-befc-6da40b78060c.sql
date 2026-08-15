-- ============================ MARKET DATA (public read) ============================

CREATE TABLE public.assets (
  id text PRIMARY KEY,
  kind text NOT NULL,
  symbol text NOT NULL,
  name text,
  exchange text,
  address text,
  currency text NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assets TO anon, authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assets are public" ON public.assets FOR SELECT USING (true);
CREATE INDEX assets_symbol_idx ON public.assets (symbol);
CREATE INDEX assets_kind_idx ON public.assets (kind);
CREATE INDEX assets_address_idx ON public.assets (address);
CREATE TRIGGER assets_touch BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.asset_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id text NOT NULL,
  symbol text NOT NULL,
  price numeric NOT NULL,
  change numeric,
  change_pct numeric,
  open numeric,
  high numeric,
  low numeric,
  prev_close numeric,
  volume numeric,
  source text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asset_prices TO anon, authenticated;
GRANT ALL ON public.asset_prices TO service_role;
ALTER TABLE public.asset_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prices are public" ON public.asset_prices FOR SELECT USING (true);
CREATE INDEX asset_prices_symbol_ts_idx ON public.asset_prices (symbol, ts DESC);
CREATE INDEX asset_prices_asset_ts_idx ON public.asset_prices (asset_id, ts DESC);

CREATE TABLE public.asset_candles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id text NOT NULL,
  symbol text NOT NULL,
  timeframe text NOT NULL,
  t timestamptz NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  volume numeric NOT NULL DEFAULT 0,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, timeframe, t)
);
GRANT SELECT ON public.asset_candles TO anon, authenticated;
GRANT ALL ON public.asset_candles TO service_role;
ALTER TABLE public.asset_candles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Candles are public" ON public.asset_candles FOR SELECT USING (true);
CREATE INDEX asset_candles_lookup_idx ON public.asset_candles (symbol, timeframe, t DESC);

CREATE TABLE public.market_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  asset_id text,
  symbol text,
  headline text NOT NULL,
  detail text,
  url text,
  sentiment numeric,
  weight numeric,
  source text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_events TO anon, authenticated;
GRANT ALL ON public.market_events TO service_role;
ALTER TABLE public.market_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Market events are public" ON public.market_events FOR SELECT USING (true);
CREATE INDEX market_events_symbol_ts_idx ON public.market_events (symbol, ts DESC);
CREATE INDEX market_events_kind_ts_idx ON public.market_events (kind, ts DESC);

CREATE TABLE public.market_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market text NOT NULL,
  phase text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_sessions TO anon, authenticated;
GRANT ALL ON public.market_sessions TO service_role;
ALTER TABLE public.market_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions are public" ON public.market_sessions FOR SELECT USING (true);
CREATE INDEX market_sessions_market_idx ON public.market_sessions (market, starts_at DESC);

CREATE TABLE public.options_contracts (
  id text PRIMARY KEY,
  underlying text NOT NULL,
  expiry date NOT NULL,
  strike numeric NOT NULL,
  option_type text NOT NULL,
  open_interest numeric,
  volume numeric,
  implied_volatility numeric,
  source text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.options_contracts TO anon, authenticated;
GRANT ALL ON public.options_contracts TO service_role;
ALTER TABLE public.options_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Option contracts are public" ON public.options_contracts FOR SELECT USING (true);
CREATE INDEX options_contracts_underlying_idx ON public.options_contracts (underlying, expiry);

CREATE TABLE public.options_flow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  contract_id text,
  flow_type text NOT NULL,
  side text,
  option_type text,
  strike numeric,
  expiry date,
  premium numeric,
  size numeric,
  open_interest numeric,
  spot numeric,
  sentiment text,
  source text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.options_flow TO anon, authenticated;
GRANT ALL ON public.options_flow TO service_role;
ALTER TABLE public.options_flow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Options flow is public" ON public.options_flow FOR SELECT USING (true);
CREATE INDEX options_flow_symbol_ts_idx ON public.options_flow (symbol, ts DESC);
CREATE INDEX options_flow_type_ts_idx ON public.options_flow (flow_type, ts DESC);

CREATE TABLE public.dark_pool_prints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  price numeric NOT NULL,
  size numeric NOT NULL,
  notional numeric,
  venue text,
  source text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dark_pool_prints TO anon, authenticated;
GRANT ALL ON public.dark_pool_prints TO service_role;
ALTER TABLE public.dark_pool_prints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dark pool prints are public" ON public.dark_pool_prints FOR SELECT USING (true);
CREATE INDEX dark_pool_prints_symbol_ts_idx ON public.dark_pool_prints (symbol, ts DESC);

CREATE TABLE public.short_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  settlement_date date NOT NULL,
  short_interest numeric,
  short_volume numeric,
  avg_daily_volume numeric,
  days_to_cover numeric,
  short_pct_float numeric,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symbol, settlement_date)
);
GRANT SELECT ON public.short_interest TO anon, authenticated;
GRANT ALL ON public.short_interest TO service_role;
ALTER TABLE public.short_interest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Short interest is public" ON public.short_interest FOR SELECT USING (true);
CREATE INDEX short_interest_symbol_idx ON public.short_interest (symbol, settlement_date DESC);

CREATE TABLE public.float_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  shares_outstanding numeric,
  free_float numeric,
  free_float_pct numeric,
  market_cap numeric,
  source text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symbol, ts)
);
GRANT SELECT ON public.float_data TO anon, authenticated;
GRANT ALL ON public.float_data TO service_role;
ALTER TABLE public.float_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Float data is public" ON public.float_data FOR SELECT USING (true);
CREATE INDEX float_data_symbol_idx ON public.float_data (symbol, ts DESC);

CREATE TABLE public.institutional_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  institution text NOT NULL,
  shares numeric,
  value numeric,
  change_shares numeric,
  change_pct numeric,
  report_date date,
  filing_type text,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.institutional_holdings TO anon, authenticated;
GRANT ALL ON public.institutional_holdings TO service_role;
ALTER TABLE public.institutional_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Institutional holdings are public" ON public.institutional_holdings FOR SELECT USING (true);
CREATE INDEX institutional_holdings_symbol_idx ON public.institutional_holdings (symbol, report_date DESC);

CREATE TABLE public.insider_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  insider_name text,
  role text,
  transaction_type text,
  shares numeric,
  price numeric,
  value numeric,
  filed_at timestamptz,
  transaction_date date,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.insider_trades TO anon, authenticated;
GRANT ALL ON public.insider_trades TO service_role;
ALTER TABLE public.insider_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insider trades are public" ON public.insider_trades FOR SELECT USING (true);
CREATE INDEX insider_trades_symbol_idx ON public.insider_trades (symbol, transaction_date DESC);

CREATE TABLE public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text,
  title text NOT NULL,
  summary text,
  url text,
  publisher text,
  image_url text,
  published_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news TO anon, authenticated;
GRANT ALL ON public.news TO service_role;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "News is public" ON public.news FOR SELECT USING (true);
CREATE INDEX news_symbol_published_idx ON public.news (symbol, published_at DESC);

CREATE TABLE public.news_sentiment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id uuid REFERENCES public.news(id) ON DELETE CASCADE,
  symbol text,
  score numeric,
  label text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_sentiment TO anon, authenticated;
GRANT ALL ON public.news_sentiment TO service_role;
ALTER TABLE public.news_sentiment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "News sentiment is public" ON public.news_sentiment FOR SELECT USING (true);
CREATE INDEX news_sentiment_symbol_idx ON public.news_sentiment (symbol, created_at DESC);

CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  asset_id text,
  signal_type text NOT NULL,
  direction text,
  timeframe text,
  strength numeric,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.signals TO anon, authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signals are public" ON public.signals FOR SELECT USING (true);
CREATE INDEX signals_symbol_ts_idx ON public.signals (symbol, ts DESC);

CREATE TABLE public.scanner_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id text NOT NULL,
  session_mode text NOT NULL DEFAULT 'regular',
  asset_kind text NOT NULL DEFAULT 'stock',
  symbol text NOT NULL,
  rank integer,
  score numeric,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scanner_results TO anon, authenticated;
GRANT ALL ON public.scanner_results TO service_role;
ALTER TABLE public.scanner_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scanner results are public" ON public.scanner_results FOR SELECT USING (true);
CREATE INDEX scanner_results_scan_ts_idx ON public.scanner_results (scan_id, ts DESC);
CREATE INDEX scanner_results_symbol_idx ON public.scanner_results (symbol, ts DESC);

CREATE TABLE public.ai_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  score_type text NOT NULL,
  score numeric NOT NULL,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  ts timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_scores TO anon, authenticated;
GRANT ALL ON public.ai_scores TO service_role;
ALTER TABLE public.ai_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI scores are public" ON public.ai_scores FOR SELECT USING (true);
CREATE INDEX ai_scores_symbol_idx ON public.ai_scores (symbol, score_type, ts DESC);

-- ============================ USER-OWNED DATA ============================

CREATE TABLE public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Watchlist',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists TO authenticated;
GRANT ALL ON public.watchlists TO service_role;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own watchlists" ON public.watchlists FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX watchlists_user_idx ON public.watchlists (user_id);
CREATE TRIGGER watchlists_touch BEFORE UPDATE ON public.watchlists FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.watchlist_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  asset_id text,
  asset_kind text NOT NULL DEFAULT 'stock',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (watchlist_id, symbol)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_assets TO authenticated;
GRANT ALL ON public.watchlist_assets TO service_role;
ALTER TABLE public.watchlist_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own watchlist assets" ON public.watchlist_assets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX watchlist_assets_user_idx ON public.watchlist_assets (user_id);
CREATE INDEX watchlist_assets_symbol_idx ON public.watchlist_assets (symbol);

CREATE TABLE public.portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Portfolio',
  base_currency text NOT NULL DEFAULT 'USD',
  origin text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolios TO authenticated;
GRANT ALL ON public.portfolios TO service_role;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own portfolios" ON public.portfolios FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX portfolios_user_idx ON public.portfolios (user_id);
CREATE TRIGGER portfolios_touch BEFORE UPDATE ON public.portfolios FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.portfolio_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  asset_id text,
  asset_kind text NOT NULL DEFAULT 'stock',
  quantity numeric NOT NULL DEFAULT 0,
  avg_cost numeric,
  market_value numeric,
  unrealized_pnl numeric,
  realized_pnl numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_positions TO authenticated;
GRANT ALL ON public.portfolio_positions TO service_role;
ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own positions" ON public.portfolio_positions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX portfolio_positions_user_idx ON public.portfolio_positions (user_id);
CREATE INDEX portfolio_positions_symbol_idx ON public.portfolio_positions (symbol);
CREATE TRIGGER portfolio_positions_touch BEFORE UPDATE ON public.portfolio_positions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.portfolio_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL,
  quantity numeric NOT NULL,
  price numeric,
  fees numeric,
  notional numeric,
  executed_at timestamptz NOT NULL DEFAULT now(),
  external_id text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_transactions TO authenticated;
GRANT ALL ON public.portfolio_transactions TO service_role;
ALTER TABLE public.portfolio_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own transactions" ON public.portfolio_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX portfolio_transactions_user_idx ON public.portfolio_transactions (user_id, executed_at DESC);

CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chain text NOT NULL DEFAULT 'solana',
  cluster text NOT NULL DEFAULT 'mainnet-beta',
  address text NOT NULL,
  provider text,
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  watch_only boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chain, address)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own wallets" ON public.wallets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX wallets_user_idx ON public.wallets (user_id);
CREATE INDEX wallets_address_idx ON public.wallets (address);
CREATE TRIGGER wallets_touch BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.wallet_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  address text NOT NULL,
  mint text,
  symbol text,
  name text,
  amount numeric NOT NULL DEFAULT 0,
  decimals integer,
  price_usd numeric,
  value_usd numeric,
  source text NOT NULL DEFAULT 'solana-rpc',
  ts timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_holdings TO authenticated;
GRANT ALL ON public.wallet_holdings TO service_role;
ALTER TABLE public.wallet_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own wallet holdings" ON public.wallet_holdings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX wallet_holdings_user_idx ON public.wallet_holdings (user_id);
CREATE INDEX wallet_holdings_address_idx ON public.wallet_holdings (address);

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  address text NOT NULL,
  signature text NOT NULL,
  direction text,
  symbol text,
  mint text,
  amount numeric,
  value_usd numeric,
  fee numeric,
  status text,
  block_time timestamptz,
  source text NOT NULL DEFAULT 'solana-rpc',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, signature)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own wallet transactions" ON public.wallet_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX wallet_transactions_user_idx ON public.wallet_transactions (user_id, block_time DESC);
CREATE INDEX wallet_transactions_address_idx ON public.wallet_transactions (address, block_time DESC);

-- ============================ BROKERAGE (metadata only) ============================

CREATE TABLE public.broker_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'snaptrade',
  provider_user_id text,
  connection_id text,
  institution text,
  status text NOT NULL DEFAULT 'pending',
  trading_enabled boolean NOT NULL DEFAULT false,
  disabled_reason text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_connections TO authenticated;
GRANT ALL ON public.broker_connections TO service_role;
ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own broker connections" ON public.broker_connections FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX broker_connections_user_idx ON public.broker_connections (user_id);
CREATE TRIGGER broker_connections_touch BEFORE UPDATE ON public.broker_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.broker_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider_account_id text NOT NULL,
  institution text,
  account_name text,
  account_type text,
  currency text NOT NULL DEFAULT 'USD',
  cash numeric,
  buying_power numeric,
  total_value numeric,
  read_only boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, provider_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_accounts TO authenticated;
GRANT ALL ON public.broker_accounts TO service_role;
ALTER TABLE public.broker_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own broker accounts" ON public.broker_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX broker_accounts_user_idx ON public.broker_accounts (user_id);
CREATE TRIGGER broker_accounts_touch BEFORE UPDATE ON public.broker_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.broker_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.broker_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  asset_kind text NOT NULL DEFAULT 'stock',
  quantity numeric NOT NULL DEFAULT 0,
  avg_cost numeric,
  market_value numeric,
  unrealized_pnl numeric,
  currency text NOT NULL DEFAULT 'USD',
  ts timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, symbol)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_positions TO authenticated;
GRANT ALL ON public.broker_positions TO service_role;
ALTER TABLE public.broker_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own broker positions" ON public.broker_positions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX broker_positions_user_idx ON public.broker_positions (user_id);
CREATE INDEX broker_positions_symbol_idx ON public.broker_positions (symbol);

CREATE TABLE public.broker_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.broker_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider_transaction_id text,
  symbol text,
  side text,
  quantity numeric,
  price numeric,
  fees numeric,
  amount numeric,
  currency text NOT NULL DEFAULT 'USD',
  transaction_type text,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider_transaction_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_transactions TO authenticated;
GRANT ALL ON public.broker_transactions TO service_role;
ALTER TABLE public.broker_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own broker transactions" ON public.broker_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX broker_transactions_user_idx ON public.broker_transactions (user_id, executed_at DESC);

-- ============================ ALERTS + AI ============================

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  asset_kind text NOT NULL DEFAULT 'stock',
  alert_type text NOT NULL DEFAULT 'price',
  direction text NOT NULL DEFAULT 'above',
  threshold numeric,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own alerts" ON public.alerts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX alerts_user_idx ON public.alerts (user_id);
CREATE INDEX alerts_symbol_idx ON public.alerts (symbol);
CREATE TRIGGER alerts_touch BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'chat',
  prompt text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  tokens integer,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_requests TO authenticated;
GRANT ALL ON public.ai_requests TO service_role;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own AI requests" ON public.ai_requests FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ai_requests_user_idx ON public.ai_requests (user_id, created_at DESC);

CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_id uuid REFERENCES public.ai_requests(id) ON DELETE SET NULL,
  symbol text,
  insight_type text NOT NULL DEFAULT 'analysis',
  title text,
  body text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own AI insights" ON public.ai_insights FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ai_insights_user_idx ON public.ai_insights (user_id, created_at DESC);
CREATE INDEX ai_insights_symbol_idx ON public.ai_insights (symbol);

-- ============================ COMMUNITY ============================

CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT ALL ON public.community_comments TO service_role;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are viewable by everyone" ON public.community_comments FOR SELECT USING (true);
CREATE POLICY "Users create their own comments" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own comments" ON public.community_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own comments" ON public.community_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX community_comments_post_idx ON public.community_comments (post_id, created_at DESC);
CREATE TRIGGER community_comments_touch BEFORE UPDATE ON public.community_comments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.community_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX community_likes_post_unique ON public.community_likes (user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX community_likes_comment_unique ON public.community_likes (user_id, comment_id) WHERE comment_id IS NOT NULL;
GRANT SELECT ON public.community_likes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_likes TO authenticated;
GRANT ALL ON public.community_likes TO service_role;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes are viewable by everyone" ON public.community_likes FOR SELECT USING (true);
CREATE POLICY "Users manage their own likes" ON public.community_likes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.community_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT ON public.community_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.community_follows TO authenticated;
GRANT ALL ON public.community_follows TO service_role;
ALTER TABLE public.community_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows are viewable by everyone" ON public.community_follows FOR SELECT USING (true);
CREATE POLICY "Users create their own follows" ON public.community_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users remove their own follows" ON public.community_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);
CREATE INDEX community_follows_following_idx ON public.community_follows (following_id);
CREATE INDEX community_follows_follower_idx ON public.community_follows (follower_id);

CREATE TABLE public.reputation (
  user_id uuid PRIMARY KEY,
  posts integer NOT NULL DEFAULT 0,
  ideas integer NOT NULL DEFAULT 0,
  followers integer NOT NULL DEFAULT 0,
  following integer NOT NULL DEFAULT 0,
  reputation_score numeric NOT NULL DEFAULT 0,
  accuracy_pct numeric,
  verified_calls integer NOT NULL DEFAULT 0,
  performance_verified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reputation TO anon, authenticated;
GRANT ALL ON public.reputation TO service_role;
ALTER TABLE public.reputation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reputation is viewable by everyone" ON public.reputation FOR SELECT USING (true);
CREATE INDEX reputation_score_idx ON public.reputation (reputation_score DESC);
CREATE TRIGGER reputation_touch BEFORE UPDATE ON public.reputation FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================ REALTIME ============================

ALTER TABLE public.alerts REPLICA IDENTITY FULL;
ALTER TABLE public.scanner_results REPLICA IDENTITY FULL;
ALTER TABLE public.community_comments REPLICA IDENTITY FULL;
ALTER TABLE public.community_likes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scanner_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_likes;