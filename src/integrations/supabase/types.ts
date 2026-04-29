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
      case_deadlines: {
        Row: {
          case_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_status_history: {
        Row: {
          case_id: string
          changed_at: string
          id: string
          new_status: Database["public"]["Enums"]["case_status"]
          note: string | null
          previous_status: Database["public"]["Enums"]["case_status"] | null
          user_id: string
        }
        Insert: {
          case_id: string
          changed_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["case_status"]
          note?: string | null
          previous_status?: Database["public"]["Enums"]["case_status"] | null
          user_id: string
        }
        Update: {
          case_id?: string
          changed_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["case_status"]
          note?: string | null
          previous_status?: Database["public"]["Enums"]["case_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_status_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          agreed_fee: number | null
          authority: string | null
          case_number: string
          client_id: string | null
          closed_at: string | null
          counterparty: string | null
          created_at: string
          fee_type: Database["public"]["Enums"]["fee_type"]
          hourly_rate: number | null
          id: string
          matter: Database["public"]["Enums"]["case_matter"]
          notes: string | null
          opened_at: string
          retainer: number | null
          rg_number: string | null
          status: Database["public"]["Enums"]["case_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agreed_fee?: number | null
          authority?: string | null
          case_number: string
          client_id?: string | null
          closed_at?: string | null
          counterparty?: string | null
          created_at?: string
          fee_type?: Database["public"]["Enums"]["fee_type"]
          hourly_rate?: number | null
          id?: string
          matter?: Database["public"]["Enums"]["case_matter"]
          notes?: string | null
          opened_at?: string
          retainer?: number | null
          rg_number?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agreed_fee?: number | null
          authority?: string | null
          case_number?: string
          client_id?: string | null
          closed_at?: string | null
          counterparty?: string | null
          created_at?: string
          fee_type?: Database["public"]["Enums"]["fee_type"]
          hourly_rate?: number | null
          id?: string
          matter?: Database["public"]["Enums"]["case_matter"]
          notes?: string | null
          opened_at?: string
          retainer?: number | null
          rg_number?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_province: string | null
          address_street: string | null
          address_zip: string | null
          business_name: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          kind: Database["public"]["Enums"]["client_kind"]
          last_name: string | null
          notes: string | null
          pec: string | null
          phone: string | null
          sdi_code: string | null
          tax_code: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_province?: string | null
          address_street?: string | null
          address_zip?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["client_kind"]
          last_name?: string | null
          notes?: string | null
          pec?: string | null
          phone?: string | null
          sdi_code?: string | null
          tax_code?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_province?: string | null
          address_street?: string | null
          address_zip?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["client_kind"]
          last_name?: string | null
          notes?: string | null
          pec?: string | null
          phone?: string | null
          sdi_code?: string | null
          tax_code?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          case_id: string
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          description: string
          expense_date: string
          id: string
          invoice_id: string | null
          is_art15: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          case_id: string
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          invoice_id?: string | null
          is_art15?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          case_id?: string
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          invoice_id?: string | null
          is_art15?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_invoice_fk"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          kind: Database["public"]["Enums"]["invoice_line_kind"]
          position: number
          quantity: number
          unit_price: number
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          kind?: Database["public"]["Enums"]["invoice_line_kind"]
          position?: number
          quantity?: number
          unit_price?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          kind?: Database["public"]["Enums"]["invoice_line_kind"]
          position?: number
          quantity?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          apply_withholding: boolean
          art15_expenses: number
          case_id: string | null
          cassa_amount: number
          cassa_rate: number
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          issue_date: string
          net_to_pay: number
          notes: string | null
          number: string
          paid_at: string | null
          payment_method: string | null
          stamp_amount: number
          status: Database["public"]["Enums"]["invoice_status"]
          taxable_expenses: number
          taxable_fees: number
          total_amount: number
          updated_at: string
          user_id: string
          vat_amount: number
          vat_rate: number
          withholding_amount: number
          withholding_rate: number
          year: number
        }
        Insert: {
          apply_withholding?: boolean
          art15_expenses?: number
          case_id?: string | null
          cassa_amount?: number
          cassa_rate?: number
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          net_to_pay?: number
          notes?: string | null
          number: string
          paid_at?: string | null
          payment_method?: string | null
          stamp_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          taxable_expenses?: number
          taxable_fees?: number
          total_amount?: number
          updated_at?: string
          user_id: string
          vat_amount?: number
          vat_rate?: number
          withholding_amount?: number
          withholding_rate?: number
          year: number
        }
        Update: {
          apply_withholding?: boolean
          art15_expenses?: number
          case_id?: string | null
          cassa_amount?: number
          cassa_rate?: number
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          net_to_pay?: number
          notes?: string | null
          number?: string
          paid_at?: string | null
          payment_method?: string | null
          stamp_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          taxable_expenses?: number
          taxable_fees?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
          vat_amount?: number
          vat_rate?: number
          withholding_amount?: number
          withholding_rate?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_province: string | null
          address_street: string | null
          address_zip: string | null
          apply_withholding: boolean
          bank_name: string | null
          bar_association: string | null
          business_name: string | null
          cassa_rate: number
          created_at: string
          email: string | null
          full_name: string | null
          iban: string | null
          id: string
          invoice_next_number: number
          invoice_number_prefix: string | null
          invoice_year: number
          last_seen_changelog_version: string | null
          logo_url: string | null
          onboarding_completed: boolean
          pec: string | null
          phone: string | null
          rea: string | null
          tax_code: string | null
          tax_regime: Database["public"]["Enums"]["tax_regime"]
          updated_at: string
          vat_number: string | null
          vat_rate: number
          withholding_rate: number
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_province?: string | null
          address_street?: string | null
          address_zip?: string | null
          apply_withholding?: boolean
          bank_name?: string | null
          bar_association?: string | null
          business_name?: string | null
          cassa_rate?: number
          created_at?: string
          email?: string | null
          full_name?: string | null
          iban?: string | null
          id: string
          invoice_next_number?: number
          invoice_number_prefix?: string | null
          invoice_year?: number
          last_seen_changelog_version?: string | null
          logo_url?: string | null
          onboarding_completed?: boolean
          pec?: string | null
          phone?: string | null
          rea?: string | null
          tax_code?: string | null
          tax_regime?: Database["public"]["Enums"]["tax_regime"]
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number
          withholding_rate?: number
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_province?: string | null
          address_street?: string | null
          address_zip?: string | null
          apply_withholding?: boolean
          bank_name?: string | null
          bar_association?: string | null
          business_name?: string | null
          cassa_rate?: number
          created_at?: string
          email?: string | null
          full_name?: string | null
          iban?: string | null
          id?: string
          invoice_next_number?: number
          invoice_number_prefix?: string | null
          invoice_year?: number
          last_seen_changelog_version?: string | null
          logo_url?: string | null
          onboarding_completed?: boolean
          pec?: string | null
          phone?: string | null
          rea?: string | null
          tax_code?: string | null
          tax_regime?: Database["public"]["Enums"]["tax_regime"]
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number
          withholding_rate?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      case_matter:
        | "civile"
        | "penale"
        | "lavoro"
        | "famiglia"
        | "amministrativo"
        | "tributario"
        | "commerciale"
        | "altro"
      case_status: "open" | "in_progress" | "suspended" | "closed" | "archived"
      client_kind: "individual" | "company"
      expense_category:
        | "contributo_unificato"
        | "marche_da_bollo"
        | "copie"
        | "trasferte"
        | "ctu"
        | "notifiche"
        | "altro"
      fee_type: "flat" | "hourly"
      invoice_line_kind: "fee" | "expense_taxable" | "expense_art15"
      invoice_status: "draft" | "issued" | "paid" | "overdue"
      tax_regime: "ordinario" | "forfettario"
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
      case_matter: [
        "civile",
        "penale",
        "lavoro",
        "famiglia",
        "amministrativo",
        "tributario",
        "commerciale",
        "altro",
      ],
      case_status: ["open", "in_progress", "suspended", "closed", "archived"],
      client_kind: ["individual", "company"],
      expense_category: [
        "contributo_unificato",
        "marche_da_bollo",
        "copie",
        "trasferte",
        "ctu",
        "notifiche",
        "altro",
      ],
      fee_type: ["flat", "hourly"],
      invoice_line_kind: ["fee", "expense_taxable", "expense_art15"],
      invoice_status: ["draft", "issued", "paid", "overdue"],
      tax_regime: ["ordinario", "forfettario"],
    },
  },
} as const
