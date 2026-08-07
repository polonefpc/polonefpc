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
      agent_balances: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_contacts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          link: string
          name: string
          note: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          link: string
          name: string
          note?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          link?: string
          name?: string
          note?: string | null
        }
        Relationships: []
      }
      agent_grants: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          id: string
          to_user: string
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          id?: string
          to_user: string
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          id?: string
          to_user?: string
        }
        Relationships: []
      }
      daily_yields: {
        Row: {
          amount: number
          applied_on: string
          created_at: string
          id: string
          rate: number
          user_id: string
        }
        Insert: {
          amount: number
          applied_on?: string
          created_at?: string
          id?: string
          rate: number
          user_id: string
        }
        Update: {
          amount?: number
          applied_on?: string
          created_at?: string
          id?: string
          rate?: number
          user_id?: string
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          package_id: number | null
          processed_at: string | null
          status: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          package_id?: number | null
          processed_at?: string | null
          status?: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          package_id?: number | null
          processed_at?: string | null
          status?: string
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_requests_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_requests_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_wallets: {
        Row: {
          address: string
          created_at: string
          currency: string | null
          id: string
          image_url: string | null
          is_active: boolean
          label: string
          network: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          currency?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          label: string
          network?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          currency?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          label?: string
          network?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      help_sections: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      package_change_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          from_package_id: number | null
          id: string
          note: string | null
          points_required: number
          status: string
          to_package_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          from_package_id?: number | null
          id?: string
          note?: string | null
          points_required?: number
          status?: string
          to_package_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          from_package_id?: number | null
          id?: string
          note?: string | null
          points_required?: number
          status?: string
          to_package_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_change_requests_from_package_id_fkey"
            columns: ["from_package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_change_requests_to_package_id_fkey"
            columns: ["to_package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          daily_rate: number
          id: number
          name: string
          package_type: string
          price: number
        }
        Insert: {
          daily_rate: number
          id?: number
          name: string
          package_type?: string
          price: number
        }
        Update: {
          daily_rate?: number
          id?: number
          name?: string
          package_type?: string
          price?: number
        }
        Relationships: []
      }
      product_orders: {
        Row: {
          created_at: string
          id: string
          price: number
          processed_at: string | null
          product_id: string
          shipping_info: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price: number
          processed_at?: string | null
          product_id: string
          shipping_info?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          processed_at?: string | null
          product_id?: string
          shipping_info?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_orders_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activated_at: string | null
          balance: number
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          package_id: number | null
          referral_code: string
          referral_count: number
          referred_by: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          balance?: number
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          package_id?: number | null
          referral_code: string
          referral_count?: number
          referred_by?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          balance?: number
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          package_id?: number | null
          referral_code?: string
          referral_count?: number
          referred_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_milestone_claims: {
        Row: {
          amount: number
          claimed_at: string
          user_id: string
        }
        Insert: {
          amount: number
          claimed_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          from_user: string
          id: string
          to_user: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_user: string
          id?: string
          to_user: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_user?: string
          id?: string
          to_user?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          status: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_daily_yields: { Args: { _apply_date?: string }; Returns: number }
      approve_package_change: {
        Args: { _request_id: string }
        Returns: undefined
      }
      claim_referral_milestone: {
        Args: never
        Returns: {
          amount: number
          message: string
          ok: boolean
        }[]
      }
      gen_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_transfer_points: {
        Args: { _amount: number; _from_user: string; _to_code: string }
        Returns: undefined
      }
      reject_package_change: {
        Args: { _admin_note: string; _request_id: string }
        Returns: undefined
      }
      request_package_change: {
        Args: { _note: string; _to_package_id: number; _user_id: string }
        Returns: string
      }
      request_package_purchase: {
        Args: { _package_id: number; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "agent" | "user"
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
      app_role: ["admin", "agent", "user"],
    },
  },
} as const
