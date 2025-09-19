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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      anonymous_aliases: {
        Row: {
          changes_used: number | null
          created_at: string | null
          event_id: string
          id: string
          nickname: string
          participant_id: string
          updated_at: string | null
        }
        Insert: {
          changes_used?: number | null
          created_at?: string | null
          event_id: string
          id?: string
          nickname: string
          participant_id: string
          updated_at?: string | null
        }
        Update: {
          changes_used?: number | null
          created_at?: string | null
          event_id?: string
          id?: string
          nickname?: string
          participant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anonymous_aliases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anonymous_aliases_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          event_id: string | null
          first_reveal_pending: boolean
          generated_on: string | null
          giver_id: string | null
          id: string
          receiver_id: string | null
        }
        Insert: {
          event_id?: string | null
          first_reveal_pending?: boolean
          generated_on?: string | null
          giver_id?: string | null
          id?: string
          receiver_id?: string | null
        }
        Update: {
          event_id?: string | null
          first_reveal_pending?: boolean
          generated_on?: string | null
          giver_id?: string | null
          id?: string
          receiver_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_giver_id_fkey"
            columns: ["giver_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          alias_snapshot: string
          assignment_id: string | null
          author_participant_id: string
          channel: string
          color_snapshot: string | null
          content: string
          created_at: string | null
          event_id: string
          id: string
          recipient_participant_id: string | null
        }
        Insert: {
          alias_snapshot: string
          assignment_id?: string | null
          author_participant_id: string
          channel: string
          color_snapshot?: string | null
          content: string
          created_at?: string | null
          event_id: string
          id?: string
          recipient_participant_id?: string | null
        }
        Update: {
          alias_snapshot?: string
          assignment_id?: string | null
          author_participant_id?: string
          channel?: string
          color_snapshot?: string | null
          content?: string
          created_at?: string | null
          event_id?: string
          id?: string
          recipient_participant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_author_participant_id_fkey"
            columns: ["author_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_recipient_participant_id_fkey"
            columns: ["recipient_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          anonymous_email: string | null
          anonymous_name: string | null
          created_at: string | null
          display_name: string | null
          event_id: string | null
          id: string
          join_token: string | null
          participant_id: string | null
          role: string | null
          status: string | null
        }
        Insert: {
          anonymous_email?: string | null
          anonymous_name?: string | null
          created_at?: string | null
          display_name?: string | null
          event_id?: string | null
          id?: string
          join_token?: string | null
          participant_id?: string | null
          role?: string | null
          status?: string | null
        }
        Update: {
          anonymous_email?: string | null
          anonymous_name?: string | null
          created_at?: string | null
          display_name?: string | null
          event_id?: string | null
          id?: string
          join_token?: string | null
          participant_id?: string | null
          role?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_join_token_fkey"
            columns: ["join_token"]
            isOneToOne: false
            referencedRelation: "join_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          admin_profile_id: string | null
          amazon_marketplace: string | null
          budget: number | null
          cover_image_url: string | null
          created_at: string | null
          date: string | null
          draw_date: string | null
          draw_status: string | null
          id: string
          join_code: string | null
          name: string
          previous_event_id: string | null
        }
        Insert: {
          admin_profile_id?: string | null
          amazon_marketplace?: string | null
          budget?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          date?: string | null
          draw_date?: string | null
          draw_status?: string | null
          id?: string
          join_code?: string | null
          name: string
          previous_event_id?: string | null
        }
        Update: {
          admin_profile_id?: string | null
          amazon_marketplace?: string | null
          budget?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          date?: string | null
          draw_date?: string | null
          draw_status?: string | null
          id?: string
          join_code?: string | null
          name?: string
          previous_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_previous_event_id_fkey"
            columns: ["previous_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      exclusions: {
        Row: {
          active: boolean | null
          blocked_id: string | null
          created_at: string | null
          event_id: string | null
          giver_id: string | null
          id: string
          reason: string | null
        }
        Insert: {
          active?: boolean | null
          blocked_id?: string | null
          created_at?: string | null
          event_id?: string | null
          giver_id?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          active?: boolean | null
          blocked_id?: string | null
          created_at?: string | null
          event_id?: string | null
          giver_id?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exclusions_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exclusions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exclusions_giver_id_fkey"
            columns: ["giver_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      join_tokens: {
        Row: {
          created_at: string
          event_id: string
          expires_at: string
          id: string
          participant_id: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          expires_at: string
          id?: string
          participant_id?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          expires_at?: string
          id?: string
          participant_id?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "join_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_tokens_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          email_assignment: boolean
          email_chat_digest: boolean
          in_app: boolean
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_assignment?: boolean
          email_chat_digest?: boolean
          in_app?: boolean
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_assignment?: boolean
          email_chat_digest?: boolean
          in_app?: boolean
          profile_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          profile_id: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          profile_id: string
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          profile_id?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          created_at: string | null
          id: string
          profile_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string | null
          display_name: string | null
          family_group: string | null
          id: string
          phone: string | null
          postal_code: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          family_group?: string | null
          id: string
          phone?: string | null
          postal_code?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          family_group?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          affiliate_url: string | null
          asin: string | null
          created_at: string | null
          event_id: string | null
          id: string
          image_url: string | null
          is_purchased: boolean | null
          notes: string | null
          owner_id: string | null
          price_snapshot: string | null
          priority: number | null
          purchased_by: string | null
          raw_url: string | null
          title: string | null
          wishlist_id: string | null
        }
        Insert: {
          affiliate_url?: string | null
          asin?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          image_url?: string | null
          is_purchased?: boolean | null
          notes?: string | null
          owner_id?: string | null
          price_snapshot?: string | null
          priority?: number | null
          purchased_by?: string | null
          raw_url?: string | null
          title?: string | null
          wishlist_id?: string | null
        }
        Update: {
          affiliate_url?: string | null
          asin?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          image_url?: string | null
          is_purchased?: boolean | null
          notes?: string | null
          owner_id?: string | null
          price_snapshot?: string | null
          priority?: number | null
          purchased_by?: string | null
          raw_url?: string | null
          title?: string | null
          wishlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_purchased_by_fkey"
            columns: ["purchased_by"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          event_id: string | null
          id: string
          notes: string | null
          owner_id: string | null
          title: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          title?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_or_get_join_token: {
        Args: {
          _event_id: string
          _participant_id: string
          _ttl_minutes?: number
        }
        Returns: {
          token: string
          url: string
        }[]
      }
      fix_event_membership_duplicates: {
        Args: { _event_id: string; _profile_id: string }
        Returns: Json
      }
      generate_join_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_join_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_event_member_profile: {
        Args: { member_profile_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          family_group: string
          id: string
        }[]
      }
      get_own_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          address: string
          avatar_url: string
          city: string
          country: string
          display_name: string
          family_group: string
          id: string
          phone: string
          postal_code: string
        }[]
      }
      get_user_email: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_event_admin: {
        Args: { eid: string; uid: string }
        Returns: boolean
      }
      is_event_member: {
        Args: { eid: string; uid: string }
        Returns: boolean
      }
      is_event_participant: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_message_participant: {
        Args: { _author_id: string; _recipient_id: string; _user_id: string }
        Returns: boolean
      }
      list_event_members: {
        Args: { _event_id: string }
        Returns: {
          anonymous_name: string
          event_display_name: string
          participant_id: string
        }[]
      }
      remove_unjoined_participant: {
        Args: { _event_id: string; _participant_id: string }
        Returns: Json
      }
      reset_event_draw: {
        Args: { _event_id: string }
        Returns: undefined
      }
      update_profile_display_name: {
        Args: { _name: string; _profile_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
