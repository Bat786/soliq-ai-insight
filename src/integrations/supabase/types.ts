export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          body: string
          citations: Json
          created_at: string
          data_sources: Json
          id: string
          insight_type: string
          request_id: string | null
          symbol: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          body: string
          citations?: Json
          created_at?: string
          data_sources?: Json
          id?: string
          insight_type?: string
          request_id?: string | null
          symbol?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          body?: string
          citations?: Json
          created_at?: string
          data_sources?: Json
          id?: string
          insight_type?: string
          request_id?: string | null
          symbol?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ai_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_requests: {
        Row: {
          context: Json
          created_at: string
          id: string
          latency_ms: number | null
          mode: string
          model: string | null
          prompt: string
          tokens: number | null
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          latency_ms?: number | null
          mode?: string
          model?: string | null
          prompt: string
          tokens?: number | null
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          latency_ms?: number | null
          mode?: string
          model?: string | null
          prompt?: string
          tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_scores: {
        Row: {
          factors: Json
          id: string
          model: string | null
          score: number
          score_type: string
          symbol: string
          ts: string
        }
        Insert: {
          factors?: Json
          id?: string
          model?: string | null
          score: number
          score_type: string
          symbol: string
          ts?: string
        }
        Update: {
          factors?: Json
          id?: string
          model?: string | null
          score?: number
          score_type?: string
          symbol?: string
          ts?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          active: boolean
          alert_type: string
          asset_kind: string
          conditions: Json
          created_at: string
          direction: string
          id: string
          last_triggered_at: string | null
          symbol: string
          threshold: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          alert_type?: string
          asset_kind?: string
          conditions?: Json
          created_at?: string
          direction?: string
          id?: string
          last_triggered_at?: string | null
          symbol: string
          threshold?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          alert_type?: string
          asset_kind?: string
          conditions?: Json
          created_at?: string
          direction?: string
          id?: string
          last_triggered_at?: string | null
          symbol?: string
          threshold?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_candles: {
        Row: {
          asset_id: string
          close: number
          created_at: string
          high: number
          id: string
          low: number
          open: number
          source: string
          symbol: string
          t: string
          timeframe: string
          volume: number
        }
        Insert: {
          asset_id: string
          close: number
          created_at?: string
          high: number
          id?: string
          low: number
          open: number
          source: string
          symbol: string
          t: string
          timeframe: string
          volume?: number
        }
        Update: {
          asset_id?: string
          close?: number
          created_at?: string
          high?: number
          id?: string
          low?: number
          open?: number
          source?: string
          symbol?: string
          t?: string
          timeframe?: string
          volume?: number
        }
        Relationships: []
      }
      asset_prices: {
        Row: {
          asset_id: string
          change: number | null
          change_pct: number | null
          created_at: string
          high: number | null
          id: string
          low: number | null
          open: number | null
          prev_close: number | null
          price: number
          source: string
          symbol: string
          ts: string
          volume: number | null
        }
        Insert: {
          asset_id: string
          change?: number | null
          change_pct?: number | null
          created_at?: string
          high?: number | null
          id?: string
          low?: number | null
          open?: number | null
          prev_close?: number | null
          price: number
          source: string
          symbol: string
          ts?: string
          volume?: number | null
        }
        Update: {
          asset_id?: string
          change?: number | null
          change_pct?: number | null
          created_at?: string
          high?: number | null
          id?: string
          low?: number | null
          open?: number | null
          prev_close?: number | null
          price?: number
          source?: string
          symbol?: string
          ts?: string
          volume?: number | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          currency: string
          exchange: string | null
          id: string
          kind: string
          metadata: Json
          name: string | null
          symbol: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          currency?: string
          exchange?: string | null
          id: string
          kind: string
          metadata?: Json
          name?: string | null
          symbol: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          currency?: string
          exchange?: string | null
          id?: string
          kind?: string
          metadata?: Json
          name?: string | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_name: string | null
          account_subtype: string | null
          account_type: string | null
          available_balance: number | null
          connection_id: string
          created_at: string
          currency: string
          current_balance: number | null
          id: string
          institution_name: string | null
          last_synced_at: string | null
          mask: string | null
          official_name: string | null
          provider_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_subtype?: string | null
          account_type?: string | null
          available_balance?: number | null
          connection_id: string
          created_at?: string
          currency?: string
          current_balance?: number | null
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          mask?: string | null
          official_name?: string | null
          provider_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_subtype?: string | null
          account_type?: string | null
          available_balance?: number | null
          connection_id?: string
          created_at?: string
          currency?: string
          current_balance?: number | null
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          mask?: string | null
          official_name?: string | null
          provider_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          access_token: string
          created_at: string
          id: string
          institution_id: string | null
          institution_name: string | null
          item_id: string
          last_synced_at: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          item_id: string
          last_synced_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          item_id?: string
          last_synced_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_accounts: {
        Row: {
          account_name: string | null
          account_type: string | null
          buying_power: number | null
          cash: number | null
          connection_id: string
          created_at: string
          currency: string
          id: string
          institution: string | null
          last_synced_at: string | null
          provider_account_id: string
          read_only: boolean
          total_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_type?: string | null
          buying_power?: number | null
          cash?: number | null
          connection_id: string
          created_at?: string
          currency?: string
          id?: string
          institution?: string | null
          last_synced_at?: string | null
          provider_account_id: string
          read_only?: boolean
          total_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_type?: string | null
          buying_power?: number | null
          cash?: number | null
          connection_id?: string
          created_at?: string
          currency?: string
          id?: string
          institution?: string | null
          last_synced_at?: string | null
          provider_account_id?: string
          read_only?: boolean
          total_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_connections: {
        Row: {
          connection_id: string | null
          created_at: string
          disabled_reason: string | null
          id: string
          institution: string | null
          last_synced_at: string | null
          provider: string
          provider_user_id: string | null
          status: string
          trading_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          disabled_reason?: string | null
          id?: string
          institution?: string | null
          last_synced_at?: string | null
          provider?: string
          provider_user_id?: string | null
          status?: string
          trading_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          disabled_reason?: string | null
          id?: string
          institution?: string | null
          last_synced_at?: string | null
          provider?: string
          provider_user_id?: string | null
          status?: string
          trading_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_positions: {
        Row: {
          account_id: string
          asset_kind: string
          avg_cost: number | null
          currency: string
          id: string
          market_value: number | null
          quantity: number
          symbol: string
          ts: string
          unrealized_pnl: number | null
          user_id: string
        }
        Insert: {
          account_id: string
          asset_kind?: string
          avg_cost?: number | null
          currency?: string
          id?: string
          market_value?: number | null
          quantity?: number
          symbol: string
          ts?: string
          unrealized_pnl?: number | null
          user_id: string
        }
        Update: {
          account_id?: string
          asset_kind?: string
          avg_cost?: number | null
          currency?: string
          id?: string
          market_value?: number | null
          quantity?: number
          symbol?: string
          ts?: string
          unrealized_pnl?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "broker_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_provider_secrets: {
        Row: {
          created_at: string
          id: string
          provider: string
          provider_user_id: string
          provider_user_secret: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider?: string
          provider_user_id: string
          provider_user_secret: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          provider_user_id?: string
          provider_user_secret?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_transactions: {
        Row: {
          account_id: string
          amount: number | null
          created_at: string
          currency: string
          executed_at: string | null
          fees: number | null
          id: string
          price: number | null
          provider_transaction_id: string | null
          quantity: number | null
          side: string | null
          symbol: string | null
          transaction_type: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount?: number | null
          created_at?: string
          currency?: string
          executed_at?: string | null
          fees?: number | null
          id?: string
          price?: number | null
          provider_transaction_id?: string | null
          quantity?: number | null
          side?: string | null
          symbol?: string | null
          transaction_type?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number | null
          created_at?: string
          currency?: string
          executed_at?: string | null
          fees?: number | null
          id?: string
          price?: number | null
          provider_transaction_id?: string | null
          quantity?: number | null
          side?: string | null
          symbol?: string | null
          transaction_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "broker_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      community_likes: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          body: string
          created_at: string
          id: string
          tags: string[]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          tags?: string[]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      dark_pool_prints: {
        Row: {
          created_at: string
          id: string
          notional: number | null
          price: number
          size: number
          source: string
          symbol: string
          ts: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notional?: number | null
          price: number
          size: number
          source: string
          symbol: string
          ts?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notional?: number | null
          price?: number
          size?: number
          source?: string
          symbol?: string
          ts?: string
          venue?: string | null
        }
        Relationships: []
      }
      float_data: {
        Row: {
          free_float: number | null
          free_float_pct: number | null
          id: string
          market_cap: number | null
          shares_outstanding: number | null
          source: string
          symbol: string
          ts: string
        }
        Insert: {
          free_float?: number | null
          free_float_pct?: number | null
          id?: string
          market_cap?: number | null
          shares_outstanding?: number | null
          source: string
          symbol: string
          ts?: string
        }
        Update: {
          free_float?: number | null
          free_float_pct?: number | null
          id?: string
          market_cap?: number | null
          shares_outstanding?: number | null
          source?: string
          symbol?: string
          ts?: string
        }
        Relationships: []
      }
      insider_trades: {
        Row: {
          created_at: string
          filed_at: string | null
          id: string
          insider_name: string | null
          price: number | null
          role: string | null
          shares: number | null
          source: string
          symbol: string
          transaction_date: string | null
          transaction_type: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          filed_at?: string | null
          id?: string
          insider_name?: string | null
          price?: number | null
          role?: string | null
          shares?: number | null
          source: string
          symbol: string
          transaction_date?: string | null
          transaction_type?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          filed_at?: string | null
          id?: string
          insider_name?: string | null
          price?: number | null
          role?: string | null
          shares?: number | null
          source?: string
          symbol?: string
          transaction_date?: string | null
          transaction_type?: string | null
          value?: number | null
        }
        Relationships: []
      }
      institutional_holdings: {
        Row: {
          change_pct: number | null
          change_shares: number | null
          created_at: string
          filing_type: string | null
          id: string
          institution: string
          report_date: string | null
          shares: number | null
          source: string
          symbol: string
          value: number | null
        }
        Insert: {
          change_pct?: number | null
          change_shares?: number | null
          created_at?: string
          filing_type?: string | null
          id?: string
          institution: string
          report_date?: string | null
          shares?: number | null
          source: string
          symbol: string
          value?: number | null
        }
        Update: {
          change_pct?: number | null
          change_shares?: number | null
          created_at?: string
          filing_type?: string | null
          id?: string
          institution?: string
          report_date?: string | null
          shares?: number | null
          source?: string
          symbol?: string
          value?: number | null
        }
        Relationships: []
      }
      linked_wallets: {
        Row: {
          address: string
          chain: string
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          chain: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          chain?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_events: {
        Row: {
          asset_id: string | null
          created_at: string
          detail: string | null
          headline: string
          id: string
          kind: string
          payload: Json
          sentiment: number | null
          source: string
          symbol: string | null
          ts: string
          url: string | null
          weight: number | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          detail?: string | null
          headline: string
          id?: string
          kind: string
          payload?: Json
          sentiment?: number | null
          source: string
          symbol?: string | null
          ts?: string
          url?: string | null
          weight?: number | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          detail?: string | null
          headline?: string
          id?: string
          kind?: string
          payload?: Json
          sentiment?: number | null
          source?: string
          symbol?: string | null
          ts?: string
          url?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      market_sessions: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          market: string
          phase: string
          starts_at: string
          timezone: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          market: string
          phase: string
          starts_at: string
          timezone?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          market?: string
          phase?: string
          starts_at?: string
          timezone?: string
        }
        Relationships: []
      }
      news: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          published_at: string
          publisher: string | null
          source: string
          summary: string | null
          symbol: string | null
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          published_at?: string
          publisher?: string | null
          source: string
          summary?: string | null
          symbol?: string | null
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          published_at?: string
          publisher?: string | null
          source?: string
          summary?: string | null
          symbol?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      news_sentiment: {
        Row: {
          created_at: string
          id: string
          label: string | null
          model: string | null
          news_id: string | null
          score: number | null
          symbol: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          model?: string | null
          news_id?: string | null
          score?: number | null
          symbol?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          model?: string | null
          news_id?: string | null
          score?: number | null
          symbol?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_sentiment_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          alert_id: string | null
          body: string
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          alert_id?: string | null
          body: string
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          alert_id?: string | null
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "watchlist_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      options_contracts: {
        Row: {
          expiry: string
          id: string
          implied_volatility: number | null
          open_interest: number | null
          option_type: string
          source: string
          strike: number
          ts: string
          underlying: string
          volume: number | null
        }
        Insert: {
          expiry: string
          id: string
          implied_volatility?: number | null
          open_interest?: number | null
          option_type: string
          source: string
          strike: number
          ts?: string
          underlying: string
          volume?: number | null
        }
        Update: {
          expiry?: string
          id?: string
          implied_volatility?: number | null
          open_interest?: number | null
          option_type?: string
          source?: string
          strike?: number
          ts?: string
          underlying?: string
          volume?: number | null
        }
        Relationships: []
      }
      options_flow: {
        Row: {
          contract_id: string | null
          created_at: string
          expiry: string | null
          flow_type: string
          id: string
          open_interest: number | null
          option_type: string | null
          premium: number | null
          sentiment: string | null
          side: string | null
          size: number | null
          source: string
          spot: number | null
          strike: number | null
          symbol: string
          ts: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          expiry?: string | null
          flow_type: string
          id?: string
          open_interest?: number | null
          option_type?: string | null
          premium?: number | null
          sentiment?: string | null
          side?: string | null
          size?: number | null
          source: string
          spot?: number | null
          strike?: number | null
          symbol: string
          ts?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          expiry?: string | null
          flow_type?: string
          id?: string
          open_interest?: number | null
          option_type?: string | null
          premium?: number | null
          sentiment?: string | null
          side?: string | null
          size?: number | null
          source?: string
          spot?: number | null
          strike?: number | null
          symbol?: string
          ts?: string
        }
        Relationships: []
      }
      portfolio_positions: {
        Row: {
          asset_id: string | null
          asset_kind: string
          avg_cost: number | null
          created_at: string
          id: string
          market_value: number | null
          portfolio_id: string
          quantity: number
          realized_pnl: number | null
          symbol: string
          unrealized_pnl: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          asset_kind?: string
          avg_cost?: number | null
          created_at?: string
          id?: string
          market_value?: number | null
          portfolio_id: string
          quantity?: number
          realized_pnl?: number | null
          symbol: string
          unrealized_pnl?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          asset_kind?: string
          avg_cost?: number | null
          created_at?: string
          id?: string
          market_value?: number | null
          portfolio_id?: string
          quantity?: number
          realized_pnl?: number | null
          symbol?: string
          unrealized_pnl?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_positions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_transactions: {
        Row: {
          created_at: string
          executed_at: string
          external_id: string | null
          fees: number | null
          id: string
          notional: number | null
          portfolio_id: string
          price: number | null
          quantity: number
          side: string
          source: string
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          executed_at?: string
          external_id?: string | null
          fees?: number | null
          id?: string
          notional?: number | null
          portfolio_id: string
          price?: number | null
          quantity: number
          side: string
          source?: string
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          executed_at?: string
          external_id?: string | null
          fees?: number | null
          id?: string
          notional?: number | null
          portfolio_id?: string
          price?: number | null
          quantity?: number
          side?: string
          source?: string
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_transactions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          name: string
          origin: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          id?: string
          name?: string
          origin?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          name?: string
          origin?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          handle: string | null
          id: string
          member_since: string | null
          membership_tier: Database["public"]["Enums"]["membership_tier"]
          renews_at: string | null
          telegram_handle: string | null
          timezone: string | null
          updated_at: string
          x_handle: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          handle?: string | null
          id: string
          member_since?: string | null
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          renews_at?: string | null
          telegram_handle?: string | null
          timezone?: string | null
          updated_at?: string
          x_handle?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          handle?: string | null
          id?: string
          member_since?: string | null
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          renews_at?: string | null
          telegram_handle?: string | null
          timezone?: string | null
          updated_at?: string
          x_handle?: string | null
        }
        Relationships: []
      }
      reputation: {
        Row: {
          accuracy_pct: number | null
          created_at: string
          followers: number
          following: number
          ideas: number
          performance_verified: boolean
          posts: number
          reputation_score: number
          updated_at: string
          user_id: string
          verified_calls: number
        }
        Insert: {
          accuracy_pct?: number | null
          created_at?: string
          followers?: number
          following?: number
          ideas?: number
          performance_verified?: boolean
          posts?: number
          reputation_score?: number
          updated_at?: string
          user_id: string
          verified_calls?: number
        }
        Update: {
          accuracy_pct?: number | null
          created_at?: string
          followers?: number
          following?: number
          ideas?: number
          performance_verified?: boolean
          posts?: number
          reputation_score?: number
          updated_at?: string
          user_id?: string
          verified_calls?: number
        }
        Relationships: []
      }
      scanner_results: {
        Row: {
          asset_kind: string
          id: string
          metrics: Json
          rank: number | null
          reasons: Json
          scan_id: string
          score: number | null
          session_mode: string
          source: string
          symbol: string
          ts: string
        }
        Insert: {
          asset_kind?: string
          id?: string
          metrics?: Json
          rank?: number | null
          reasons?: Json
          scan_id: string
          score?: number | null
          session_mode?: string
          source: string
          symbol: string
          ts?: string
        }
        Update: {
          asset_kind?: string
          id?: string
          metrics?: Json
          rank?: number | null
          reasons?: Json
          scan_id?: string
          score?: number | null
          session_mode?: string
          source?: string
          symbol?: string
          ts?: string
        }
        Relationships: []
      }
      short_interest: {
        Row: {
          avg_daily_volume: number | null
          created_at: string
          days_to_cover: number | null
          id: string
          settlement_date: string
          short_interest: number | null
          short_pct_float: number | null
          short_volume: number | null
          source: string
          symbol: string
        }
        Insert: {
          avg_daily_volume?: number | null
          created_at?: string
          days_to_cover?: number | null
          id?: string
          settlement_date: string
          short_interest?: number | null
          short_pct_float?: number | null
          short_volume?: number | null
          source: string
          symbol: string
        }
        Update: {
          avg_daily_volume?: number | null
          created_at?: string
          days_to_cover?: number | null
          id?: string
          settlement_date?: string
          short_interest?: number | null
          short_pct_float?: number | null
          short_volume?: number | null
          source?: string
          symbol?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          asset_id: string | null
          created_at: string
          direction: string | null
          id: string
          reasons: Json
          signal_type: string
          source: string
          strength: number | null
          symbol: string
          timeframe: string | null
          ts: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          direction?: string | null
          id?: string
          reasons?: Json
          signal_type: string
          source: string
          strength?: number | null
          symbol: string
          timeframe?: string | null
          ts?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          direction?: string | null
          id?: string
          reasons?: Json
          signal_type?: string
          source?: string
          strength?: number | null
          symbol?: string
          timeframe?: string | null
          ts?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          contact_email: string | null
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          contact_email?: string | null
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          contact_email?: string | null
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_holdings: {
        Row: {
          address: string
          amount: number
          decimals: number | null
          id: string
          mint: string | null
          name: string | null
          price_usd: number | null
          source: string
          symbol: string | null
          ts: string
          user_id: string
          value_usd: number | null
          wallet_id: string
        }
        Insert: {
          address: string
          amount?: number
          decimals?: number | null
          id?: string
          mint?: string | null
          name?: string | null
          price_usd?: number | null
          source?: string
          symbol?: string | null
          ts?: string
          user_id: string
          value_usd?: number | null
          wallet_id: string
        }
        Update: {
          address?: string
          amount?: number
          decimals?: number | null
          id?: string
          mint?: string | null
          name?: string | null
          price_usd?: number | null
          source?: string
          symbol?: string | null
          ts?: string
          user_id?: string
          value_usd?: number | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_holdings_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          address: string
          amount: number | null
          block_time: string | null
          created_at: string
          direction: string | null
          fee: number | null
          id: string
          mint: string | null
          signature: string
          source: string
          status: string | null
          symbol: string | null
          user_id: string
          value_usd: number | null
          wallet_id: string
        }
        Insert: {
          address: string
          amount?: number | null
          block_time?: string | null
          created_at?: string
          direction?: string | null
          fee?: number | null
          id?: string
          mint?: string | null
          signature: string
          source?: string
          status?: string | null
          symbol?: string | null
          user_id: string
          value_usd?: number | null
          wallet_id: string
        }
        Update: {
          address?: string
          amount?: number | null
          block_time?: string | null
          created_at?: string
          direction?: string | null
          fee?: number | null
          id?: string
          mint?: string | null
          signature?: string
          source?: string
          status?: string | null
          symbol?: string | null
          user_id?: string
          value_usd?: number | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          address: string
          chain: string
          cluster: string
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          last_synced_at: string | null
          provider: string | null
          updated_at: string
          user_id: string
          watch_only: boolean
        }
        Insert: {
          address: string
          chain?: string
          cluster?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          last_synced_at?: string | null
          provider?: string | null
          updated_at?: string
          user_id: string
          watch_only?: boolean
        }
        Update: {
          address?: string
          chain?: string
          cluster?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          last_synced_at?: string | null
          provider?: string | null
          updated_at?: string
          user_id?: string
          watch_only?: boolean
        }
        Relationships: []
      }
      watchlist_alerts: {
        Row: {
          active: boolean
          asset_id: string
          asset_symbol: string
          created_at: string
          direction: string
          id: string
          last_triggered_at: string | null
          list_name: string
          threshold: number
          user_id: string
        }
        Insert: {
          active?: boolean
          asset_id: string
          asset_symbol: string
          created_at?: string
          direction?: string
          id?: string
          last_triggered_at?: string | null
          list_name?: string
          threshold: number
          user_id: string
        }
        Update: {
          active?: boolean
          asset_id?: string
          asset_symbol?: string
          created_at?: string
          direction?: string
          id?: string
          last_triggered_at?: string | null
          list_name?: string
          threshold?: number
          user_id?: string
        }
        Relationships: []
      }
      watchlist_assets: {
        Row: {
          asset_id: string | null
          asset_kind: string
          created_at: string
          id: string
          note: string | null
          symbol: string
          user_id: string
          watchlist_id: string
        }
        Insert: {
          asset_id?: string | null
          asset_kind?: string
          created_at?: string
          id?: string
          note?: string | null
          symbol: string
          user_id: string
          watchlist_id: string
        }
        Update: {
          asset_id?: string | null
          asset_kind?: string
          created_at?: string
          id?: string
          note?: string | null
          symbol?: string
          user_id?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_assets_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      effective_tier: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["membership_tier"]
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      is_paid_member: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      membership_tier: "free" | "pro" | "elite"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      membership_tier: ["free", "pro", "elite"],
    },
  },
} as const
