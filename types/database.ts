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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
          session_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
          session_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_games: {
        Row: {
          app_type: string
          cache_expires_at: string | null
          categories: string[]
          coming_soon: boolean
          cover_image: string | null
          created_at: string
          developers: string[]
          features: string[]
          full_description: string | null
          genres: string[]
          header_image: string | null
          id: string
          import_attempts: number
          is_free: boolean
          last_import_attempt_at: string | null
          last_import_error: string | null
          metadata_status: Database["public"]["Enums"]["metadata_status"]
          metadata_updated_at: string | null
          name: string
          normalized_name: string
          platforms: string[]
          price: Json | null
          publishers: string[]
          raw_metadata: Json | null
          release_date: string | null
          short_description: string | null
          source: Database["public"]["Enums"]["game_source"]
          source_updated_at: string | null
          steam_appid: number | null
          store_url: string | null
          supported_languages: string[]
          updated_at: string
        }
        Insert: {
          app_type?: string
          cache_expires_at?: string | null
          categories?: string[]
          coming_soon?: boolean
          cover_image?: string | null
          created_at?: string
          developers?: string[]
          features?: string[]
          full_description?: string | null
          genres?: string[]
          header_image?: string | null
          id?: string
          import_attempts?: number
          is_free?: boolean
          last_import_attempt_at?: string | null
          last_import_error?: string | null
          metadata_status?: Database["public"]["Enums"]["metadata_status"]
          metadata_updated_at?: string | null
          name: string
          normalized_name: string
          platforms?: string[]
          price?: Json | null
          publishers?: string[]
          raw_metadata?: Json | null
          release_date?: string | null
          short_description?: string | null
          source?: Database["public"]["Enums"]["game_source"]
          source_updated_at?: string | null
          steam_appid?: number | null
          store_url?: string | null
          supported_languages?: string[]
          updated_at?: string
        }
        Update: {
          app_type?: string
          cache_expires_at?: string | null
          categories?: string[]
          coming_soon?: boolean
          cover_image?: string | null
          created_at?: string
          developers?: string[]
          features?: string[]
          full_description?: string | null
          genres?: string[]
          header_image?: string | null
          id?: string
          import_attempts?: number
          is_free?: boolean
          last_import_attempt_at?: string | null
          last_import_error?: string | null
          metadata_status?: Database["public"]["Enums"]["metadata_status"]
          metadata_updated_at?: string | null
          name?: string
          normalized_name?: string
          platforms?: string[]
          price?: Json | null
          publishers?: string[]
          raw_metadata?: Json | null
          release_date?: string | null
          short_description?: string | null
          source?: Database["public"]["Enums"]["game_source"]
          source_updated_at?: string | null
          steam_appid?: number | null
          store_url?: string | null
          supported_languages?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      decision_results: {
        Row: {
          chosen_at: string
          decision_run_id: string
          duration_minutes: number | null
          id: string
          notes: string | null
          played: boolean | null
          session_game_id: string
          session_id: string
        }
        Insert: {
          chosen_at?: string
          decision_run_id: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          played?: boolean | null
          session_game_id: string
          session_id: string
        }
        Update: {
          chosen_at?: string
          decision_run_id?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          played?: boolean | null
          session_game_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_results_decision_run_id_fkey"
            columns: ["decision_run_id"]
            isOneToOne: false
            referencedRelation: "decision_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_results_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_runs: {
        Row: {
          completed_at: string | null
          id: string
          initiated_by: string
          method: Database["public"]["Enums"]["decision_method"]
          seed: string | null
          session_id: string
          snapshot: Json
          started_at: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          initiated_by: string
          method: Database["public"]["Enums"]["decision_method"]
          seed?: string | null
          session_id: string
          snapshot?: Json
          started_at?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          initiated_by?: string
          method?: Database["public"]["Enums"]["decision_method"]
          seed?: string | null
          session_id?: string
          snapshot?: Json
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_ownership: {
        Row: {
          id: string
          platform: string | null
          session_game_id: string
          session_id: string
          status: Database["public"]["Enums"]["ownership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          platform?: string | null
          session_game_id: string
          session_id: string
          status?: Database["public"]["Enums"]["ownership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          platform?: string | null
          session_game_id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["ownership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_ownership_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_ownership_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          preferred_theme: Database["public"]["Enums"]["preferred_theme"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          preferred_theme?: Database["public"]["Enums"]["preferred_theme"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          preferred_theme?: Database["public"]["Enums"]["preferred_theme"]
          updated_at?: string
        }
        Relationships: []
      }
      session_games: {
        Row: {
          added_by: string
          catalog_game_id: string | null
          created_at: string
          description: string | null
          features: string[]
          game_mode: string | null
          id: string
          image_url: string | null
          max_players: number | null
          min_players: number | null
          name: string
          normalized_name: string
          notes: string | null
          platforms: string[]
          removed_at: string | null
          session_id: string
          source: Database["public"]["Enums"]["game_source"]
          steam_appid: number | null
          store_url: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          added_by: string
          catalog_game_id?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          game_mode?: string | null
          id?: string
          image_url?: string | null
          max_players?: number | null
          min_players?: number | null
          name: string
          normalized_name: string
          notes?: string | null
          platforms?: string[]
          removed_at?: string | null
          session_id: string
          source: Database["public"]["Enums"]["game_source"]
          steam_appid?: number | null
          store_url?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          added_by?: string
          catalog_game_id?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          game_mode?: string | null
          id?: string
          image_url?: string | null
          max_players?: number | null
          min_players?: number | null
          name?: string
          normalized_name?: string
          notes?: string | null
          platforms?: string[]
          removed_at?: string | null
          session_id?: string
          source?: Database["public"]["Enums"]["game_source"]
          steam_appid?: number | null
          store_url?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_games_catalog_game_id_fkey"
            columns: ["catalog_game_id"]
            isOneToOne: false
            referencedRelation: "catalog_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_games_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          revoked_at: string | null
          session_id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          session_id: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_invites_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_members: {
        Row: {
          display_name: string
          id: string
          joined_at: string
          last_seen_at: string
          removed_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          session_id: string
          user_id: string
        }
        Insert: {
          display_name: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          removed_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          session_id: string
          user_id: string
        }
        Update: {
          display_name?: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          removed_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          decision_method: Database["public"]["Enums"]["decision_method"]
          deleted_at: string | null
          description: string | null
          expires_at: string | null
          group_id: string | null
          hide_results_until_closed: boolean
          id: string
          kind: Database["public"]["Enums"]["session_kind"]
          last_activity_at: string
          max_participants: number
          owner_id: string
          public_code: string
          status: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_method?: Database["public"]["Enums"]["decision_method"]
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          group_id?: string | null
          hide_results_until_closed?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["session_kind"]
          last_activity_at?: string
          max_participants?: number
          owner_id: string
          public_code: string
          status?: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_method?: Database["public"]["Enums"]["decision_method"]
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          group_id?: string | null
          hide_results_until_closed?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["session_kind"]
          last_activity_at?: string
          max_participants?: number
          owner_id?: string
          public_code?: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      steam_app_index: {
        Row: {
          app_type: string
          appid: number
          catalog_type: string
          created_at: string
          indexed_at: string
          is_available: boolean
          last_modified: number | null
          last_seen_generation: string | null
          name: string
          normalized_name: string
          price_change_number: number | null
          source: string
          synced_at: string
          updated_at: string
        }
        Insert: {
          app_type?: string
          appid: number
          catalog_type?: string
          created_at?: string
          indexed_at?: string
          is_available?: boolean
          last_modified?: number | null
          last_seen_generation?: string | null
          name: string
          normalized_name: string
          price_change_number?: number | null
          source?: string
          synced_at?: string
          updated_at?: string
        }
        Update: {
          app_type?: string
          appid?: number
          catalog_type?: string
          created_at?: string
          indexed_at?: string
          is_available?: boolean
          last_modified?: number | null
          last_seen_generation?: string | null
          name?: string
          normalized_name?: string
          price_change_number?: number | null
          source?: string
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      steam_catalog_sync_runs: {
        Row: {
          apps_processed: number
          completed_at: string | null
          duration_ms: number | null
          end_appid: number
          errors: Json
          final_cursor: number
          id: string
          ignored_count: number
          initial_cursor: number
          inserted_count: number
          lock_token: string | null
          mode: string
          pages_processed: number
          received_count: number
          start_appid: number
          started_at: string
          status: string
          trigger_source: string
          updated_count: number
        }
        Insert: {
          apps_processed?: number
          completed_at?: string | null
          duration_ms?: number | null
          end_appid?: number
          errors?: Json
          final_cursor?: number
          id?: string
          ignored_count?: number
          initial_cursor?: number
          inserted_count?: number
          lock_token?: string | null
          mode?: string
          pages_processed?: number
          received_count?: number
          start_appid?: number
          started_at?: string
          status?: string
          trigger_source: string
          updated_count?: number
        }
        Update: {
          apps_processed?: number
          completed_at?: string | null
          duration_ms?: number | null
          end_appid?: number
          errors?: Json
          final_cursor?: number
          id?: string
          ignored_count?: number
          initial_cursor?: number
          inserted_count?: number
          lock_token?: string | null
          mode?: string
          pages_processed?: number
          received_count?: number
          start_appid?: number
          started_at?: string
          status?: string
          trigger_source?: string
          updated_count?: number
        }
        Relationships: []
      }
      steam_catalog_sync_state: {
        Row: {
          bootstrap_completed_at: string | null
          bootstrap_generation: string | null
          bootstrap_last_appid: number
          bootstrap_started_at: string | null
          catalog_complete: boolean
          if_modified_since: number
          incremental_last_appid: number
          last_appid: number
          last_appid_checkpoint: number
          last_completed_at: string | null
          last_error: string | null
          last_full_sync_at: string | null
          last_incremental_sync_at: string | null
          last_modified_checkpoint: number
          last_page_size: number
          last_started_at: string | null
          lease_expires_at: string | null
          lock_token: string | null
          processed_apps: number
          singleton: boolean
          status: string
          sync_mode: string
          total_indexed: number
          updated_at: string
        }
        Insert: {
          bootstrap_completed_at?: string | null
          bootstrap_generation?: string | null
          bootstrap_last_appid?: number
          bootstrap_started_at?: string | null
          catalog_complete?: boolean
          if_modified_since?: number
          incremental_last_appid?: number
          last_appid?: number
          last_appid_checkpoint?: number
          last_completed_at?: string | null
          last_error?: string | null
          last_full_sync_at?: string | null
          last_incremental_sync_at?: string | null
          last_modified_checkpoint?: number
          last_page_size?: number
          last_started_at?: string | null
          lease_expires_at?: string | null
          lock_token?: string | null
          processed_apps?: number
          singleton?: boolean
          status?: string
          sync_mode?: string
          total_indexed?: number
          updated_at?: string
        }
        Update: {
          bootstrap_completed_at?: string | null
          bootstrap_generation?: string | null
          bootstrap_last_appid?: number
          bootstrap_started_at?: string | null
          catalog_complete?: boolean
          if_modified_since?: number
          incremental_last_appid?: number
          last_appid?: number
          last_appid_checkpoint?: number
          last_completed_at?: string | null
          last_error?: string | null
          last_full_sync_at?: string | null
          last_incremental_sync_at?: string | null
          last_modified_checkpoint?: number
          last_page_size?: number
          last_started_at?: string | null
          lease_expires_at?: string | null
          lock_token?: string | null
          processed_apps?: number
          singleton?: boolean
          status?: string
          sync_mode?: string
          total_indexed?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_game_library: {
        Row: {
          catalog_game_id: string
          id: string
          imported_at: string | null
          notes: string | null
          ownership_type: Database["public"]["Enums"]["ownership_status"]
          platform: string
          source: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          catalog_game_id: string
          id?: string
          imported_at?: string | null
          notes?: string | null
          ownership_type: Database["public"]["Enums"]["ownership_status"]
          platform: string
          source?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          catalog_game_id?: string
          id?: string
          imported_at?: string | null
          notes?: string | null
          ownership_type?: Database["public"]["Enums"]["ownership_status"]
          platform?: string
          source?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_game_library_catalog_game_id_fkey"
            columns: ["catalog_game_id"]
            isOneToOne: false
            referencedRelation: "catalog_games"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          id: string
          session_game_id: string
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_game_id: string
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_game_id?: string
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      checkpoint_steam_catalog_sync: {
        Args: {
          claim_token: string
          next_cursor: number
          page_size: number
          received_delta: number
          requested_mode: string
        }
        Returns: boolean
      }
      claim_steam_catalog_sync: {
        Args: {
          lease_seconds?: number
          requested_mode: string
          requested_restart?: boolean
        }
        Returns: {
          acquired: boolean
          claim_token: string
          generation: string
          modified_since: number
          start_cursor: number
          sync_mode: string
        }[]
      }
      cleanup_expired_sessions: {
        Args: { batch_size?: number; dry_run?: boolean }
        Returns: number
      }
      create_quick_session: {
        Args: {
          expiry_days?: number
          method?: Database["public"]["Enums"]["decision_method"]
          owner_display_name: string
          session_title: string
        }
        Returns: Json
      }
      draw_session_game: {
        Args: { target_session_id: string; weighted?: boolean }
        Returns: Json
      }
      fail_steam_catalog_sync: {
        Args: { claim_token: string; safe_error: string }
        Returns: boolean
      }
      finish_steam_catalog_sync: {
        Args: {
          claim_token: string
          final_cursor: number
          modified_checkpoint: number
          reached_end: boolean
          requested_mode: string
        }
        Returns: boolean
      }
      join_session: {
        Args: { member_display_name: string; session_code: string }
        Returns: Json
      }
      search_catalog_games: {
        Args: { result_limit?: number; search_query: string }
        Returns: {
          features: string[]
          header_image: string
          id: string
          metadata_status: Database["public"]["Enums"]["metadata_status"]
          name: string
          platforms: string[]
          steam_appid: number
          store_url: string
        }[]
      }
      search_steam_apps: {
        Args: {
          result_limit?: number
          result_offset?: number
          search_query: string
        }
        Returns: {
          app_type: string
          appid: number
          cache_expires_at: string
          catalog_game_id: string
          header_image: string
          metadata_status: Database["public"]["Enums"]["metadata_status"]
          name: string
          platforms: string[]
          release_date: string
          relevance: number
          total_matches: number
        }[]
      }
      unaccent_safe: { Args: { value: string }; Returns: string }
    }
    Enums: {
      decision_method:
        | "multi_vote"
        | "single_vote"
        | "random"
        | "weighted_random"
        | "ranking"
        | "elimination"
        | "tournament"
        | "veto"
      game_source: "manual" | "steam"
      member_role: "owner" | "moderator" | "member"
      metadata_status: "pending" | "complete" | "partial" | "failed" | "stale"
      ownership_status:
        | "owns"
        | "does_not_own"
        | "other_platform"
        | "unknown"
        | "subscription"
        | "free"
      preferred_theme: "light" | "dark" | "dark-red"
      session_kind: "quick" | "group"
      session_status: "open" | "locked" | "deciding" | "closed" | "expired"
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
      decision_method: [
        "multi_vote",
        "single_vote",
        "random",
        "weighted_random",
        "ranking",
        "elimination",
        "tournament",
        "veto",
      ],
      game_source: ["manual", "steam"],
      member_role: ["owner", "moderator", "member"],
      metadata_status: ["pending", "complete", "partial", "failed", "stale"],
      ownership_status: [
        "owns",
        "does_not_own",
        "other_platform",
        "unknown",
        "subscription",
        "free",
      ],
      preferred_theme: ["light", "dark", "dark-red"],
      session_kind: ["quick", "group"],
      session_status: ["open", "locked", "deciding", "closed", "expired"],
    },
  },
} as const

