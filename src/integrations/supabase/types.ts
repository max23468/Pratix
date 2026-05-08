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
      activity_attachments: {
        Row: {
          activity_id: string
          bucket_id: string
          created_at: string
          display_name: string
          document_type: string | null
          id: string
          mime_type: string | null
          notes: string | null
          original_file_name: string | null
          preview_available: boolean
          size_bytes: number | null
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          bucket_id?: string
          created_at?: string
          display_name: string
          document_type?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_file_name?: string | null
          preview_available?: boolean
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          bucket_id?: string
          created_at?: string
          display_name?: string
          document_type?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_file_name?: string | null
          preview_available?: boolean
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_attachments_activity_owner_fkey"
            columns: ["activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "case_activities"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      billing_exports: {
        Row: {
          billing_run_id: string
          bucket_id: string
          created_at: string
          file_name: string
          generated_at: string
          id: string
          invoice_id: string | null
          kind: Database["public"]["Enums"]["billing_export_kind"]
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_run_id: string
          bucket_id?: string
          created_at?: string
          file_name: string
          generated_at?: string
          id?: string
          invoice_id?: string | null
          kind: Database["public"]["Enums"]["billing_export_kind"]
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_run_id?: string
          bucket_id?: string
          created_at?: string
          file_name?: string
          generated_at?: string
          id?: string
          invoice_id?: string | null
          kind?: Database["public"]["Enums"]["billing_export_kind"]
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_exports_invoice_owner_fkey"
            columns: ["invoice_id", "user_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "billing_exports_run_owner_fkey"
            columns: ["billing_run_id", "user_id"]
            isOneToOne: false
            referencedRelation: "billing_runs"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      billing_run_items: {
        Row: {
          activity_id: string
          billing_run_id: string
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["billing_run_item_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          billing_run_id: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["billing_run_item_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          billing_run_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["billing_run_item_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_run_items_activity_owner_fkey"
            columns: ["activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "case_activities"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "billing_run_items_run_owner_fkey"
            columns: ["billing_run_id", "user_id"]
            isOneToOne: false
            referencedRelation: "billing_runs"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      billing_runs: {
        Row: {
          cassa_amount: number
          cassa_base_amount: number
          cassa_rate: number
          compensation_total: number
          created_at: string
          general_expenses_amount: number
          general_expenses_rate: number
          id: string
          include_general_expenses: boolean
          invoice_id: string | null
          notes: string | null
          period_end: string
          period_start: string
          principal_id: string
          reimbursements_total: number
          status: Database["public"]["Enums"]["billing_run_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cassa_amount?: number
          cassa_base_amount?: number
          cassa_rate?: number
          compensation_total?: number
          created_at?: string
          general_expenses_amount?: number
          general_expenses_rate?: number
          id?: string
          include_general_expenses?: boolean
          invoice_id?: string | null
          notes?: string | null
          period_end: string
          period_start: string
          principal_id: string
          reimbursements_total?: number
          status?: Database["public"]["Enums"]["billing_run_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cassa_amount?: number
          cassa_base_amount?: number
          cassa_rate?: number
          compensation_total?: number
          created_at?: string
          general_expenses_amount?: number
          general_expenses_rate?: number
          id?: string
          include_general_expenses?: boolean
          invoice_id?: string | null
          notes?: string | null
          period_end?: string
          period_start?: string
          principal_id?: string
          reimbursements_total?: number
          status?: Database["public"]["Enums"]["billing_run_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_runs_invoice_owner_fkey"
            columns: ["invoice_id", "user_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "billing_runs_principal_owner_fkey"
            columns: ["principal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      case_activities: {
        Row: {
          activity_date: string
          amount: number
          case_id: string
          client_id: string
          counterparty_id: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string | null
          kind: Database["public"]["Enums"]["price_item_kind"]
          notes: string | null
          postponed_count: number
          postponed_until: string | null
          price_book_id: string
          price_item_id: string
          principal_id: string
          quantity: number
          snapshot_price_code: string
          snapshot_price_name: string
          snapshot_price_year: number
          status: Database["public"]["Enums"]["case_activity_status"]
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_date?: string
          amount?: number
          case_id: string
          client_id: string
          counterparty_id?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id?: string | null
          kind: Database["public"]["Enums"]["price_item_kind"]
          notes?: string | null
          postponed_count?: number
          postponed_until?: string | null
          price_book_id: string
          price_item_id: string
          principal_id: string
          quantity?: number
          snapshot_price_code: string
          snapshot_price_name: string
          snapshot_price_year: number
          status?: Database["public"]["Enums"]["case_activity_status"]
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_date?: string
          amount?: number
          case_id?: string
          client_id?: string
          counterparty_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string | null
          kind?: Database["public"]["Enums"]["price_item_kind"]
          notes?: string | null
          postponed_count?: number
          postponed_until?: string | null
          price_book_id?: string
          price_item_id?: string
          principal_id?: string
          quantity?: number
          snapshot_price_code?: string
          snapshot_price_name?: string
          snapshot_price_year?: number
          status?: Database["public"]["Enums"]["case_activity_status"]
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_activities_case_owner_fkey"
            columns: ["case_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "case_activities_client_owner_fkey"
            columns: ["client_id", "user_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "case_activities_counterparty_owner_fkey"
            columns: ["counterparty_id", "user_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "case_activities_invoice_owner_fkey"
            columns: ["invoice_id", "user_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "case_activities_price_book_owner_fkey"
            columns: ["price_book_id", "user_id"]
            isOneToOne: false
            referencedRelation: "price_books"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "case_activities_price_item_owner_fkey"
            columns: ["price_item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "price_items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "case_activities_principal_owner_fkey"
            columns: ["principal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      case_activity_hearings: {
        Row: {
          activity_id: string
          created_at: string
          hearing_date: string
          id: string
          notes: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          hearing_date: string
          id?: string
          notes?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          hearing_date?: string
          id?: string
          notes?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_activity_hearings_activity_owner_fkey"
            columns: ["activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "case_activities"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      case_credit_transfers: {
        Row: {
          case_id: string
          created_at: string
          id: string
          new_client_id: string
          notes: string | null
          previous_client_id: string | null
          transferred_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          new_client_id: string
          notes?: string | null
          previous_client_id?: string | null
          transferred_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          new_client_id?: string
          notes?: string | null
          previous_client_id?: string | null
          transferred_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_credit_transfers_case_owner_fkey"
            columns: ["case_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "case_credit_transfers_new_client_owner_fkey"
            columns: ["new_client_id", "user_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "case_credit_transfers_previous_client_owner_fkey"
            columns: ["previous_client_id", "user_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "user_id"]
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
          counterparty_id: string | null
          created_at: string
          fee_type: Database["public"]["Enums"]["fee_type"]
          hourly_rate: number | null
          id: string
          matter: Database["public"]["Enums"]["case_matter"]
          notes: string | null
          opened_at: string
          practice_number: number
          principal_id: string | null
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
          counterparty_id?: string | null
          created_at?: string
          fee_type?: Database["public"]["Enums"]["fee_type"]
          hourly_rate?: number | null
          id?: string
          matter?: Database["public"]["Enums"]["case_matter"]
          notes?: string | null
          opened_at?: string
          practice_number: number
          principal_id?: string | null
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
          counterparty_id?: string | null
          created_at?: string
          fee_type?: Database["public"]["Enums"]["fee_type"]
          hourly_rate?: number | null
          id?: string
          matter?: Database["public"]["Enums"]["case_matter"]
          notes?: string | null
          opened_at?: string
          practice_number?: number
          principal_id?: string | null
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
          {
            foreignKeyName: "cases_counterparty_owner_fkey"
            columns: ["counterparty_id", "user_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "cases_principal_owner_fkey"
            columns: ["principal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id", "user_id"]
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
      counterparties: {
        Row: {
          business_name: string | null
          created_at: string
          first_name: string | null
          id: string
          kind: Database["public"]["Enums"]["counterparty_kind"]
          last_name: string | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["counterparty_kind"]
          last_name?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["counterparty_kind"]
          last_name?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      counterparty_subjects: {
        Row: {
          business_name: string | null
          counterparty_id: string
          created_at: string
          first_name: string | null
          id: string
          kind: Database["public"]["Enums"]["client_kind"]
          last_name: string | null
          notes: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          counterparty_id: string
          created_at?: string
          first_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["client_kind"]
          last_name?: string | null
          notes?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string | null
          counterparty_id?: string
          created_at?: string
          first_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["client_kind"]
          last_name?: string | null
          notes?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "counterparty_subjects_counterparty_owner_fkey"
            columns: ["counterparty_id", "user_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      import_rows: {
        Row: {
          applied_case_id: string | null
          created_at: string
          error_messages: string[]
          id: string
          import_id: string
          normalized_data: Json
          raw_data: Json
          row_number: number
          status: Database["public"]["Enums"]["import_row_status"]
          updated_at: string
          user_id: string
          warning_messages: string[]
        }
        Insert: {
          applied_case_id?: string | null
          created_at?: string
          error_messages?: string[]
          id?: string
          import_id: string
          normalized_data?: Json
          raw_data?: Json
          row_number: number
          status?: Database["public"]["Enums"]["import_row_status"]
          updated_at?: string
          user_id: string
          warning_messages?: string[]
        }
        Update: {
          applied_case_id?: string | null
          created_at?: string
          error_messages?: string[]
          id?: string
          import_id?: string
          normalized_data?: Json
          raw_data?: Json
          row_number?: number
          status?: Database["public"]["Enums"]["import_row_status"]
          updated_at?: string
          user_id?: string
          warning_messages?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_applied_case_owner_fkey"
            columns: ["applied_case_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "import_rows_import_owner_fkey"
            columns: ["import_id", "user_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      imports: {
        Row: {
          created_at: string
          error_rows: number
          id: string
          mode: Database["public"]["Enums"]["import_mode"]
          notes: string | null
          source_file_name: string | null
          source_storage_path: string | null
          status: Database["public"]["Enums"]["import_status"]
          total_rows: number
          updated_at: string
          user_id: string
          valid_rows: number
        }
        Insert: {
          created_at?: string
          error_rows?: number
          id?: string
          mode?: Database["public"]["Enums"]["import_mode"]
          notes?: string | null
          source_file_name?: string | null
          source_storage_path?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          updated_at?: string
          user_id: string
          valid_rows?: number
        }
        Update: {
          created_at?: string
          error_rows?: number
          id?: string
          mode?: Database["public"]["Enums"]["import_mode"]
          notes?: string | null
          source_file_name?: string | null
          source_storage_path?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          updated_at?: string
          user_id?: string
          valid_rows?: number
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          activity_date: string | null
          amount: number
          case_activity_id: string | null
          client_name: string | null
          counterparty_name: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          kind: Database["public"]["Enums"]["invoice_line_kind"]
          position: number
          practice_number: number | null
          quantity: number
          unit_price: number
          user_id: string
        }
        Insert: {
          activity_date?: string | null
          amount?: number
          case_activity_id?: string | null
          client_name?: string | null
          counterparty_name?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          kind?: Database["public"]["Enums"]["invoice_line_kind"]
          position?: number
          practice_number?: number | null
          quantity?: number
          unit_price?: number
          user_id: string
        }
        Update: {
          activity_date?: string | null
          amount?: number
          case_activity_id?: string | null
          client_name?: string | null
          counterparty_name?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          kind?: Database["public"]["Enums"]["invoice_line_kind"]
          position?: number
          practice_number?: number | null
          quantity?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_case_activity_owner_fkey"
            columns: ["case_activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "case_activities"
            referencedColumns: ["id", "user_id"]
          },
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
          billing_run_id: string | null
          case_id: string | null
          cassa_amount: number
          cassa_base_amount: number
          cassa_rate: number
          client_id: string
          created_at: string
          due_date: string | null
          general_expenses_amount: number
          general_expenses_rate: number
          id: string
          include_general_expenses: boolean
          issue_date: string
          net_to_pay: number
          notes: string | null
          number: string
          paid_at: string | null
          payment_method: string | null
          principal_id: string | null
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
          billing_run_id?: string | null
          case_id?: string | null
          cassa_amount?: number
          cassa_base_amount?: number
          cassa_rate?: number
          client_id: string
          created_at?: string
          due_date?: string | null
          general_expenses_amount?: number
          general_expenses_rate?: number
          id?: string
          include_general_expenses?: boolean
          issue_date?: string
          net_to_pay?: number
          notes?: string | null
          number: string
          paid_at?: string | null
          payment_method?: string | null
          principal_id?: string | null
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
          billing_run_id?: string | null
          case_id?: string | null
          cassa_amount?: number
          cassa_base_amount?: number
          cassa_rate?: number
          client_id?: string
          created_at?: string
          due_date?: string | null
          general_expenses_amount?: number
          general_expenses_rate?: number
          id?: string
          include_general_expenses?: boolean
          issue_date?: string
          net_to_pay?: number
          notes?: string | null
          number?: string
          paid_at?: string | null
          payment_method?: string | null
          principal_id?: string | null
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
            foreignKeyName: "invoices_billing_run_owner_fkey"
            columns: ["billing_run_id", "user_id"]
            isOneToOne: false
            referencedRelation: "billing_runs"
            referencedColumns: ["id", "user_id"]
          },
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
          {
            foreignKeyName: "invoices_principal_owner_fkey"
            columns: ["principal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      price_books: {
        Row: {
          created_at: string
          expense_reimbursements_enabled: boolean
          fees_enabled: boolean
          id: string
          notes: string | null
          principal_id: string
          status: Database["public"]["Enums"]["price_book_status"]
          updated_at: string
          user_id: string
          valid_from: string
          valid_to: string | null
          year: number
        }
        Insert: {
          created_at?: string
          expense_reimbursements_enabled?: boolean
          fees_enabled?: boolean
          id?: string
          notes?: string | null
          principal_id: string
          status?: Database["public"]["Enums"]["price_book_status"]
          updated_at?: string
          user_id: string
          valid_from: string
          valid_to?: string | null
          year: number
        }
        Update: {
          created_at?: string
          expense_reimbursements_enabled?: boolean
          fees_enabled?: boolean
          id?: string
          notes?: string | null
          principal_id?: string
          status?: Database["public"]["Enums"]["price_book_status"]
          updated_at?: string
          user_id?: string
          valid_from?: string
          valid_to?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_books_principal_owner_fkey"
            columns: ["principal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      price_items: {
        Row: {
          code: string
          created_at: string
          id: string
          invoice_description: string | null
          is_enabled: boolean
          kind: Database["public"]["Enums"]["price_item_kind"]
          name: string
          price_book_id: string
          requires_hearing_dates: boolean
          sort_order: number
          unit_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          invoice_description?: string | null
          is_enabled?: boolean
          kind: Database["public"]["Enums"]["price_item_kind"]
          name: string
          price_book_id: string
          requires_hearing_dates?: boolean
          sort_order?: number
          unit_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          invoice_description?: string | null
          is_enabled?: boolean
          kind?: Database["public"]["Enums"]["price_item_kind"]
          name?: string
          price_book_id?: string
          requires_hearing_dates?: boolean
          sort_order?: number
          unit_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_items_price_book_owner_fkey"
            columns: ["price_book_id", "user_id"]
            isOneToOne: false
            referencedRelation: "price_books"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      principal_clients: {
        Row: {
          active_from: string | null
          active_to: string | null
          client_id: string
          created_at: string
          id: string
          notes: string | null
          principal_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_from?: string | null
          active_to?: string | null
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          principal_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_from?: string | null
          active_to?: string | null
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          principal_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "principal_clients_client_owner_fkey"
            columns: ["client_id", "user_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "principal_clients_principal_owner_fkey"
            columns: ["principal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "principals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      principals: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_province: string | null
          address_street: string | null
          address_zip: string | null
          archived_at: string | null
          business_name: string
          created_at: string
          default_cassa_rate: number
          default_general_expenses_rate: number
          email: string | null
          expense_reimbursements_enabled: boolean
          fees_enabled: boolean
          id: string
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
          archived_at?: string | null
          business_name: string
          created_at?: string
          default_cassa_rate?: number
          default_general_expenses_rate?: number
          email?: string | null
          expense_reimbursements_enabled?: boolean
          fees_enabled?: boolean
          id?: string
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
          archived_at?: string | null
          business_name?: string
          created_at?: string
          default_cassa_rate?: number
          default_general_expenses_rate?: number
          email?: string | null
          expense_reimbursements_enabled?: boolean
          fees_enabled?: boolean
          id?: string
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
      apply_import_row: { Args: { p_import_row_id: string }; Returns: string }
      get_next_practice_number: { Args: never; Returns: number }
    }
    Enums: {
      billing_export_kind: "fees" | "expenses"
      billing_run_item_status: "included" | "postponed" | "excluded"
      billing_run_status: "draft" | "finalized" | "cancelled"
      case_activity_status: "to_invoice" | "invoiced"
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
      counterparty_kind: "individual" | "company" | "group"
      fee_type: "flat" | "hourly"
      import_mode: "manual" | "excel"
      import_row_status:
        | "pending"
        | "valid"
        | "warning"
        | "error"
        | "imported"
        | "skipped"
      import_status: "draft" | "validated" | "imported" | "cancelled"
      invoice_line_kind: "fee" | "expense_taxable" | "expense_art15"
      invoice_status: "draft" | "issued" | "paid" | "overdue"
      price_book_status: "draft" | "active" | "archived"
      price_item_kind: "fee" | "expense_reimbursement"
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
      billing_export_kind: ["fees", "expenses"],
      billing_run_item_status: ["included", "postponed", "excluded"],
      billing_run_status: ["draft", "finalized", "cancelled"],
      case_activity_status: ["to_invoice", "invoiced"],
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
      counterparty_kind: ["individual", "company", "group"],
      fee_type: ["flat", "hourly"],
      import_mode: ["manual", "excel"],
      import_row_status: [
        "pending",
        "valid",
        "warning",
        "error",
        "imported",
        "skipped",
      ],
      import_status: ["draft", "validated", "imported", "cancelled"],
      invoice_line_kind: ["fee", "expense_taxable", "expense_art15"],
      invoice_status: ["draft", "issued", "paid", "overdue"],
      price_book_status: ["draft", "active", "archived"],
      price_item_kind: ["fee", "expense_reimbursement"],
      tax_regime: ["ordinario", "forfettario"],
    },
  },
} as const
