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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      event_announcements: {
        Row: {
          created_at: string
          discount_categories: string[] | null
          discount_percent: number | null
          event_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          message: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          discount_categories?: string[] | null
          discount_percent?: number | null
          event_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          discount_categories?: string[] | null
          discount_percent?: number | null
          event_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_chat_messages: {
        Row: {
          created_at: string
          event_id: string
          guest_name: string | null
          id: string
          is_pinned: boolean
          message: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_name?: string | null
          id?: string
          is_pinned?: boolean
          message: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_name?: string | null
          id?: string
          is_pinned?: boolean
          message?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_chat_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tickets: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          is_active: boolean
          name: string
          perk_bonus_votes: number
          perk_drink_discount: number
          perk_priority_queue: boolean
          price_cents: number
          quantity_available: number
          quantity_sold: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          is_active?: boolean
          name: string
          perk_bonus_votes?: number
          perk_drink_discount?: number
          perk_priority_queue?: boolean
          price_cents?: number
          quantity_available?: number
          quantity_sold?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          is_active?: boolean
          name?: string
          perk_bonus_votes?: number
          perk_drink_discount?: number
          perk_priority_queue?: boolean
          price_cents?: number
          quantity_available?: number
          quantity_sold?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          dj_id: string
          end_time: string | null
          genre: string | null
          id: string
          name: string
          qr_code: string | null
          settings: Json
          start_time: string
          status: Database["public"]["Enums"]["event_status"]
          theme_bg_image: string | null
          theme_color: string | null
          theme_logo_url: string | null
          updated_at: string
          venue_id: string | null
          join_policy: string
          join_code: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          dj_id: string
          end_time?: string | null
          genre?: string | null
          id?: string
          name: string
          qr_code?: string | null
          settings?: Json
          start_time: string
          status?: Database["public"]["Enums"]["event_status"]
          theme_bg_image?: string | null
          theme_color?: string | null
          theme_logo_url?: string | null
          updated_at?: string
          venue_id?: string | null
          join_policy?: string
          join_code?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          dj_id?: string
          end_time?: string | null
          genre?: string | null
          id?: string
          name?: string
          qr_code?: string | null
          settings?: Json
          start_time?: string
          status?: Database["public"]["Enums"]["event_status"]
          theme_bg_image?: string | null
          theme_color?: string | null
          theme_logo_url?: string | null
          updated_at?: string
          venue_id?: string | null
          join_policy?: string
          join_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_tables: {
        Row: {
          created_at: string
          event_id: string
          id: string
          status: string
          table_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          status?: string
          table_name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          table_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          transaction_type: Database["public"]["Enums"]["point_transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type: Database["public"]["Enums"]["point_transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type?: Database["public"]["Enums"]["point_transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          points_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          points_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          points_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      song_requests: {
        Row: {
          artist: string | null
          created_at: string
          event_id: string
          guest_id: string | null
          guest_name: string | null
          id: string
          is_pre_event: boolean
          shoutout_message: string | null
          song_title: string
          source: string | null
          source_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          thumbnail_url: string | null
          updated_at: string
          vote_count: number
        }
        Insert: {
          artist?: string | null
          created_at?: string
          event_id: string
          guest_id?: string | null
          guest_name?: string | null
          id?: string
          is_pre_event?: boolean
          shoutout_message?: string | null
          song_title: string
          source?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          thumbnail_url?: string | null
          updated_at?: string
          vote_count?: number
        }
        Update: {
          artist?: string | null
          created_at?: string
          event_id?: string
          guest_id?: string | null
          guest_name?: string | null
          id?: string
          is_pre_event?: boolean
          shoutout_message?: string | null
          song_title?: string
          source?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          thumbnail_url?: string | null
          updated_at?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "song_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      table_orders: {
        Row: {
          created_at: string
          id: string
          item_emoji: string
          item_name: string
          menu_item_id: string | null
          price_cents: number
          quantity: number
          status: string
          table_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_emoji?: string
          item_name: string
          menu_item_id?: string | null
          price_cents?: number
          quantity?: number
          status?: string
          table_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_emoji?: string
          item_name?: string
          menu_item_id?: string | null
          price_cents?: number
          quantity?: number
          status?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_orders_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "venue_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "guest_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_purchases: {
        Row: {
          event_id: string
          id: string
          purchased_at: string
          quantity: number
          ticket_id: string
          total_cents: number
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          purchased_at?: string
          quantity?: number
          ticket_id: string
          total_cents?: number
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          purchased_at?: string
          quantity?: number
          ticket_id?: string
          total_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_purchases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_purchases_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "event_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tips: {
        Row: {
          amount_cents: number
          created_at: string
          event_id: string | null
          from_user_id: string | null
          id: string
          message: string | null
          stripe_payment_id: string | null
          tip_type: Database["public"]["Enums"]["tip_type"]
          to_user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          event_id?: string | null
          from_user_id?: string | null
          id?: string
          message?: string | null
          stripe_payment_id?: string | null
          tip_type: Database["public"]["Enums"]["tip_type"]
          to_user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          event_id?: string | null
          from_user_id?: string | null
          id?: string
          message?: string | null
          stripe_payment_id?: string | null
          tip_type?: Database["public"]["Enums"]["tip_type"]
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tips_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venue_menu_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          emoji: string
          event_id: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          emoji?: string
          event_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          emoji?: string
          event_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_menu_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_menu_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_staff: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_staff_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          qr_code: string | null
          settings: Json
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          qr_code?: string | null
          settings?: Json
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          qr_code?: string | null
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          guest_session_id: string | null
          id: string
          points_spent: number
          request_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          guest_session_id?: string | null
          id?: string
          points_spent?: number
          request_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          guest_session_id?: string | null
          id?: string
          points_spent?: number
          request_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "song_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_event_leaderboard: { Args: { p_event_id: string }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_ticket_perks: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: Json
      }
      grant_demo_points: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      admin_exists: { Args: never; Returns: boolean }
      bootstrap_first_admin: {
        Args: { p_display_name?: string }
        Returns: Json
      }
      place_table_order: {
        Args: { p_items: Json; p_table_id: string }
        Returns: Json
      }
      purchase_ticket: {
        Args: { p_quantity?: number; p_ticket_id: string; p_user_id: string }
        Returns: Json
      }
      seed_default_menu_items: {
        Args: { p_venue_id: string }
        Returns: undefined
      }
      send_points_tip: {
        Args: {
          p_amount_cents: number
          p_event_id: string
          p_from_user_id: string
          p_message?: string
          p_to_user_id: string
        }
        Returns: Json
      }
      spend_points_on_vote: {
        Args: {
          p_guest_session_id?: string
          p_points_to_spend: number
          p_request_id: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "venue_owner" | "dj" | "bartender" | "guest"
      event_status: "draft" | "scheduled" | "live" | "ended" | "archived"
      point_transaction_type: "purchase" | "earned" | "spent" | "refund"
      request_status: "pending" | "accepted" | "declined" | "playing" | "played"
      tip_type: "direct" | "points"
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
      app_role: ["admin", "venue_owner", "dj", "bartender", "guest"],
      event_status: ["draft", "scheduled", "live", "ended", "archived"],
      point_transaction_type: ["purchase", "earned", "spent", "refund"],
      request_status: ["pending", "accepted", "declined", "playing", "played"],
      tip_type: ["direct", "points"],
    },
  },
} as const
