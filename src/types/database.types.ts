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
  auth: {
    Tables: {
      audit_log_entries: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string | null
          ip_address: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          id: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Relationships: []
      }
      custom_oauth_providers: {
        Row: {
          acceptable_client_ids: string[]
          attribute_mapping: Json
          authorization_params: Json
          authorization_url: string | null
          cached_discovery: Json | null
          client_id: string
          client_secret: string
          created_at: string
          custom_claims_allowlist: string[]
          discovery_cached_at: string | null
          discovery_url: string | null
          email_optional: boolean
          enabled: boolean
          id: string
          identifier: string
          issuer: string | null
          jwks_uri: string | null
          name: string
          pkce_enabled: boolean
          provider_type: string
          scopes: string[]
          skip_nonce_check: boolean
          token_url: string | null
          updated_at: string
          userinfo_url: string | null
        }
        Insert: {
          acceptable_client_ids?: string[]
          attribute_mapping?: Json
          authorization_params?: Json
          authorization_url?: string | null
          cached_discovery?: Json | null
          client_id: string
          client_secret: string
          created_at?: string
          custom_claims_allowlist?: string[]
          discovery_cached_at?: string | null
          discovery_url?: string | null
          email_optional?: boolean
          enabled?: boolean
          id?: string
          identifier: string
          issuer?: string | null
          jwks_uri?: string | null
          name: string
          pkce_enabled?: boolean
          provider_type: string
          scopes?: string[]
          skip_nonce_check?: boolean
          token_url?: string | null
          updated_at?: string
          userinfo_url?: string | null
        }
        Update: {
          acceptable_client_ids?: string[]
          attribute_mapping?: Json
          authorization_params?: Json
          authorization_url?: string | null
          cached_discovery?: Json | null
          client_id?: string
          client_secret?: string
          created_at?: string
          custom_claims_allowlist?: string[]
          discovery_cached_at?: string | null
          discovery_url?: string | null
          email_optional?: boolean
          enabled?: boolean
          id?: string
          identifier?: string
          issuer?: string | null
          jwks_uri?: string | null
          name?: string
          pkce_enabled?: boolean
          provider_type?: string
          scopes?: string[]
          skip_nonce_check?: boolean
          token_url?: string | null
          updated_at?: string
          userinfo_url?: string | null
        }
        Relationships: []
      }
      flow_state: {
        Row: {
          auth_code: string | null
          auth_code_issued_at: string | null
          authentication_method: string
          code_challenge: string | null
          code_challenge_method:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at: string | null
          email_optional: boolean
          id: string
          invite_token: string | null
          linking_target_id: string | null
          oauth_client_state_id: string | null
          provider_access_token: string | null
          provider_refresh_token: string | null
          provider_type: string
          referrer: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth_code?: string | null
          auth_code_issued_at?: string | null
          authentication_method: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string | null
          email_optional?: boolean
          id: string
          invite_token?: string | null
          linking_target_id?: string | null
          oauth_client_state_id?: string | null
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type: string
          referrer?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_code?: string | null
          auth_code_issued_at?: string | null
          authentication_method?: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string | null
          email_optional?: boolean
          id?: string
          invite_token?: string | null
          linking_target_id?: string | null
          oauth_client_state_id?: string | null
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type?: string
          referrer?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      identities: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          identity_data: Json
          last_sign_in_at: string | null
          provider: string
          provider_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data: Json
          last_sign_in_at?: string | null
          provider: string
          provider_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data?: Json
          last_sign_in_at?: string | null
          provider?: string
          provider_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          created_at: string | null
          id: string
          raw_base_config: string | null
          updated_at: string | null
          uuid: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Relationships: []
      }
      mfa_amr_claims: {
        Row: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Update: {
          authentication_method?: string
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_amr_claims_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_challenges: {
        Row: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code: string | null
          verified_at: string | null
          web_authn_session_data: Json | null
        }
        Insert: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Update: {
          created_at?: string
          factor_id?: string
          id?: string
          ip_address?: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_challenges_auth_factor_id_fkey"
            columns: ["factor_id"]
            isOneToOne: false
            referencedRelation: "mfa_factors"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_factors: {
        Row: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name: string | null
          id: string
          last_challenged_at: string | null
          last_webauthn_challenge_data: Json | null
          phone: string | null
          secret: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid: string | null
          web_authn_credential: Json | null
        }
        Insert: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Update: {
          created_at?: string
          factor_type?: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id?: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status?: Database["auth"]["Enums"]["factor_status"]
          updated_at?: string
          user_id?: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_factors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_authorizations: {
        Row: {
          approved_at: string | null
          authorization_code: string | null
          authorization_id: string
          client_id: string
          code_challenge: string | null
          code_challenge_method:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at: string
          expires_at: string
          id: string
          nonce: string | null
          redirect_uri: string
          resource: string | null
          response_type: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state: string | null
          status: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id: string
          client_id: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id: string
          nonce?: string | null
          redirect_uri: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id?: string
          client_id?: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string | null
          redirect_uri?: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope?: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorizations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_authorizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_client_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          id: string
          provider_type: string
        }
        Insert: {
          code_verifier?: string | null
          created_at: string
          id: string
          provider_type: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          id?: string
          provider_type?: string
        }
        Relationships: []
      }
      oauth_clients: {
        Row: {
          client_name: string | null
          client_secret_hash: string | null
          client_type: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri: string | null
          created_at: string
          deleted_at: string | null
          grant_types: string
          id: string
          logo_uri: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types: string
          id: string
          logo_uri?: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types?: string
          id?: string
          logo_uri?: string | null
          redirect_uris?: string
          registration_type?: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method?: string
          updated_at?: string
        }
        Relationships: []
      }
      oauth_consents: {
        Row: {
          client_id: string
          granted_at: string
          id: string
          revoked_at: string | null
          scopes: string
          user_id: string
        }
        Insert: {
          client_id: string
          granted_at?: string
          id: string
          revoked_at?: string | null
          scopes: string
          user_id: string
        }
        Update: {
          client_id?: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          scopes?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      one_time_tokens: {
        Row: {
          created_at: string
          id: string
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relates_to?: string
          token_hash?: string
          token_type?: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refresh_tokens: {
        Row: {
          created_at: string | null
          id: number
          instance_id: string | null
          parent: string | null
          revoked: boolean | null
          session_id: string | null
          token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_providers: {
        Row: {
          attribute_mapping: Json | null
          created_at: string | null
          entity_id: string
          id: string
          metadata_url: string | null
          metadata_xml: string
          name_id_format: string | null
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          attribute_mapping?: Json | null
          created_at?: string | null
          entity_id: string
          id: string
          metadata_url?: string | null
          metadata_xml: string
          name_id_format?: string | null
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          attribute_mapping?: Json | null
          created_at?: string | null
          entity_id?: string
          id?: string
          metadata_url?: string | null
          metadata_xml?: string
          name_id_format?: string | null
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_providers_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_relay_states: {
        Row: {
          created_at: string | null
          flow_state_id: string | null
          for_email: string | null
          id: string
          redirect_to: string | null
          request_id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id: string
          redirect_to?: string | null
          request_id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id?: string
          redirect_to?: string | null
          request_id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_relay_states_flow_state_id_fkey"
            columns: ["flow_state_id"]
            isOneToOne: false
            referencedRelation: "flow_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saml_relay_states_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          version: string
        }
        Insert: {
          version: string
        }
        Update: {
          version?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          aal: Database["auth"]["Enums"]["aal_level"] | null
          created_at: string | null
          factor_id: string | null
          id: string
          ip: unknown
          not_after: string | null
          oauth_client_id: string | null
          refresh_token_counter: number | null
          refresh_token_hmac_key: string | null
          refreshed_at: string | null
          scopes: string | null
          tag: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id: string
          ip?: unknown
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          scopes?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id?: string
          ip?: unknown
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          scopes?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_domains_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_providers: {
        Row: {
          created_at: string | null
          disabled: boolean | null
          id: string
          resource_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          disabled?: boolean | null
          id: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          disabled?: boolean | null
          id?: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          aud: string | null
          banned_until: string | null
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_change: string | null
          email_change_confirm_status: number | null
          email_change_sent_at: string | null
          email_change_token_current: string | null
          email_change_token_new: string | null
          email_confirmed_at: string | null
          encrypted_password: string | null
          id: string
          instance_id: string | null
          invited_at: string | null
          is_anonymous: boolean
          is_sso_user: boolean
          is_super_admin: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_change: string | null
          phone_change_sent_at: string | null
          phone_change_token: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          reauthentication_sent_at: string | null
          reauthentication_token: string | null
          recovery_sent_at: string | null
          recovery_token: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webauthn_challenges: {
        Row: {
          challenge_type: string
          created_at: string
          expires_at: string
          id: string
          session_data: Json
          user_id: string | null
        }
        Insert: {
          challenge_type: string
          created_at?: string
          expires_at: string
          id?: string
          session_data: Json
          user_id?: string | null
        }
        Update: {
          challenge_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          session_data?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_credentials: {
        Row: {
          aaguid: string | null
          attestation_type: string
          backed_up: boolean
          backup_eligible: boolean
          created_at: string
          credential_id: string
          friendly_name: string
          id: string
          last_used_at: string | null
          public_key: string
          sign_count: number
          transports: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          aaguid?: string | null
          attestation_type?: string
          backed_up?: boolean
          backup_eligible?: boolean
          created_at?: string
          credential_id: string
          friendly_name?: string
          id?: string
          last_used_at?: string | null
          public_key: string
          sign_count?: number
          transports?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          aaguid?: string | null
          attestation_type?: string
          backed_up?: boolean
          backup_eligible?: boolean
          created_at?: string
          credential_id?: string
          friendly_name?: string
          id?: string
          last_used_at?: string | null
          public_key?: string
          sign_count?: number
          transports?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      email: { Args: never; Returns: string }
      jwt: { Args: never; Returns: Json }
      role: { Args: never; Returns: string }
      uid: { Args: never; Returns: string }
    }
    Enums: {
      aal_level: "aal1" | "aal2" | "aal3"
      code_challenge_method: "s256" | "plain"
      factor_status: "unverified" | "verified"
      factor_type: "totp" | "webauthn" | "phone"
      oauth_authorization_status: "pending" | "approved" | "denied" | "expired"
      oauth_client_type: "public" | "confidential"
      oauth_registration_type: "dynamic" | "manual"
      oauth_response_type: "code"
      one_time_token_type:
        | "confirmation_token"
        | "reauthentication_token"
        | "recovery_token"
        | "email_change_token_new"
        | "email_change_token_current"
        | "phone_change_token"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          code: string
          criteria: Json
          description: string
          icon: string
          title: string
        }
        Insert: {
          category: string
          code: string
          criteria: Json
          description: string
          icon: string
          title: string
        }
        Update: {
          category?: string
          code?: string
          criteria?: Json
          description?: string
          icon?: string
          title?: string
        }
        Relationships: []
      }
      broadcast_recipients: {
        Row: {
          broadcast_id: string
          delivered_at: string | null
          person_id: string
          read_at: string | null
        }
        Insert: {
          broadcast_id: string
          delivered_at?: string | null
          person_id: string
          read_at?: string | null
        }
        Update: {
          broadcast_id?: string
          delivered_at?: string | null
          person_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_recipients_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          branch_root_id: string | null
          created_at: string
          id: string
          message: string
          scope: Database["public"]["Enums"]["broadcast_scope"]
          sender_user_id: string
        }
        Insert: {
          branch_root_id?: string | null
          created_at?: string
          id?: string
          message: string
          scope?: Database["public"]["Enums"]["broadcast_scope"]
          sender_user_id: string
        }
        Update: {
          branch_root_id?: string | null
          created_at?: string
          id?: string
          message?: string
          scope?: Database["public"]["Enums"]["broadcast_scope"]
          sender_user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          media_url: string | null
          room_id: string
          sender_user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          media_url?: string | null
          room_id: string
          sender_user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          media_url?: string | null
          room_id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_members: {
        Row: {
          last_read_at: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string | null
          type?: string
        }
        Relationships: []
      }
      claim_requests: {
        Row: {
          confirmations_needed: number
          confirmations_received: string[] | null
          created_at: string
          evidence: Json | null
          id: string
          person_id: string
          requesting_user_id: string
          resolved_at: string | null
        }
        Insert: {
          confirmations_needed?: number
          confirmations_received?: string[] | null
          created_at?: string
          evidence?: Json | null
          id?: string
          person_id: string
          requesting_user_id: string
          resolved_at?: string | null
        }
        Update: {
          confirmations_needed?: number
          confirmations_received?: string[] | null
          created_at?: string
          evidence?: Json | null
          id?: string
          person_id?: string
          requesting_user_id?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      consents: {
        Row: {
          consent_type: string
          created_at: string | null
          granted: boolean | null
          id: string
          ip_hash: string | null
          person_id: string | null
          policy_version: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          consent_type: string
          created_at?: string | null
          granted?: boolean | null
          id?: string
          ip_hash?: string | null
          person_id?: string | null
          policy_version: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          consent_type?: string
          created_at?: string | null
          granted?: boolean | null
          id?: string
          ip_hash?: string | null
          person_id?: string | null
          policy_version?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          id: string
          processed_at: string | null
          processing_notes: string | null
          request_type: string | null
          requested_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          id?: string
          processed_at?: string | null
          processing_notes?: string | null
          request_type?: string | null
          requested_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          id?: string
          processed_at?: string | null
          processing_notes?: string | null
          request_type?: string | null
          requested_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      family_events: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          location: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          event_date: string
          event_type: string
          id?: string
          location?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          location?: string | null
          title?: string
        }
        Relationships: []
      }
      family_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          room_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          room_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          room_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      family_space_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          space_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          space_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_space_events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "family_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      family_spaces: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          root_person_id: string | null
          status: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          root_person_id?: string | null
          status?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          root_person_id?: string | null
          status?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_trees_root_person_id_fkey"
            columns: ["root_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          invitation_id: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          invitation_id: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          invitation_id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          delivery_channel: string | null
          expires_at: string | null
          id: string
          invited_by: string | null
          person_id: string | null
          recipient_email: string | null
          recipient_phone_hash: string | null
          revoked_at: string | null
          space_id: string | null
          status: Database["public"]["Enums"]["invitation_status"] | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          delivery_channel?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          person_id?: string | null
          recipient_email?: string | null
          recipient_phone_hash?: string | null
          revoked_at?: string | null
          space_id?: string | null
          status?: Database["public"]["Enums"]["invitation_status"] | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          delivery_channel?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          person_id?: string | null
          recipient_email?: string | null
          recipient_phone_hash?: string | null
          revoked_at?: string | null
          space_id?: string | null
          status?: Database["public"]["Enums"]["invitation_status"] | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tree_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "family_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      match_candidates: {
        Row: {
          candidate_person_id: string
          created_at: string | null
          created_by: string | null
          id: string
          match_reasons: Json | null
          match_score: number | null
          proposed_person_data: Json | null
          related_to_person_id: string | null
          requested_by: string | null
          requested_relationship:
            | Database["public"]["Enums"]["relationship_type"]
            | null
          resolved_at: string | null
          reviewed_by: string | null
          source_person_id: string
          space_id: string | null
          status: Database["public"]["Enums"]["match_status"] | null
        }
        Insert: {
          candidate_person_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          match_reasons?: Json | null
          match_score?: number | null
          proposed_person_data?: Json | null
          related_to_person_id?: string | null
          requested_by?: string | null
          requested_relationship?:
            | Database["public"]["Enums"]["relationship_type"]
            | null
          resolved_at?: string | null
          reviewed_by?: string | null
          source_person_id: string
          space_id?: string | null
          status?: Database["public"]["Enums"]["match_status"] | null
        }
        Update: {
          candidate_person_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          match_reasons?: Json | null
          match_score?: number | null
          proposed_person_data?: Json | null
          related_to_person_id?: string | null
          requested_by?: string | null
          requested_relationship?:
            | Database["public"]["Enums"]["relationship_type"]
            | null
          resolved_at?: string | null
          reviewed_by?: string | null
          source_person_id?: string
          space_id?: string | null
          status?: Database["public"]["Enums"]["match_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "match_candidates_candidate_person_id_fkey"
            columns: ["candidate_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_candidates_related_to_person_id_fkey"
            columns: ["related_to_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_candidates_source_person_id_fkey"
            columns: ["source_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_candidates_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "family_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      matching_config: {
        Row: {
          weight_name: string
          weight_value: number
        }
        Insert: {
          weight_name: string
          weight_value: number
        }
        Update: {
          weight_name?: string
          weight_value?: number
        }
        Relationships: []
      }
      merge_history: {
        Row: {
          created_at: string
          id: string
          performed_by: string | null
          reason: string | null
          snapshot: Json | null
          source_person_id: string
          target_person_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          performed_by?: string | null
          reason?: string | null
          snapshot?: Json | null
          source_person_id: string
          target_person_id: string
        }
        Update: {
          created_at?: string
          id?: string
          performed_by?: string | null
          reason?: string | null
          snapshot?: Json | null
          source_person_id?: string
          target_person_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          birthdays: boolean | null
          broadcasts: boolean | null
          chat: boolean | null
          new_family_members: boolean | null
          sos: boolean | null
          user_id: string
        }
        Insert: {
          birthdays?: boolean | null
          broadcasts?: boolean | null
          chat?: boolean | null
          new_family_members?: boolean | null
          sos?: boolean | null
          user_id: string
        }
        Update: {
          birthdays?: boolean | null
          broadcasts?: boolean | null
          chat?: boolean | null
          new_family_members?: boolean | null
          sos?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      person_claims: {
        Row: {
          approved_at: string | null
          claim_status: Database["public"]["Enums"]["claim_status"] | null
          claimed_at: string | null
          id: string
          person_id: string
          revoked_at: string | null
          user_id: string
          verification_method: string | null
        }
        Insert: {
          approved_at?: string | null
          claim_status?: Database["public"]["Enums"]["claim_status"] | null
          claimed_at?: string | null
          id?: string
          person_id: string
          revoked_at?: string | null
          user_id: string
          verification_method?: string | null
        }
        Update: {
          approved_at?: string | null
          claim_status?: Database["public"]["Enums"]["claim_status"] | null
          claimed_at?: string | null
          id?: string
          person_id?: string
          revoked_at?: string | null
          user_id?: string
          verification_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_claims_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      person_locations: {
        Row: {
          city: string
          country: string
          lat_city: number | null
          lon_city: number | null
          person_id: string
          updated_at: string
        }
        Insert: {
          city: string
          country: string
          lat_city?: number | null
          lon_city?: number | null
          person_id: string
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          lat_city?: number | null
          lon_city?: number | null
          person_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      persons: {
        Row: {
          birth_city: string | null
          birth_country: string | null
          birth_date: string | null
          birth_date_precision: string | null
          birth_year: number | null
          created_at: string | null
          created_by: string | null
          death_date: string | null
          deleted_at: string | null
          first_name: string
          first_surname: string
          gender: string | null
          id: string
          is_deceased: boolean | null
          middle_name: string | null
          normalized_full_name: string | null
          photo_path: string | null
          public_id: string
          second_surname: string | null
          status: Database["public"]["Enums"]["person_status"] | null
          updated_at: string | null
        }
        Insert: {
          birth_city?: string | null
          birth_country?: string | null
          birth_date?: string | null
          birth_date_precision?: string | null
          birth_year?: number | null
          created_at?: string | null
          created_by?: string | null
          death_date?: string | null
          deleted_at?: string | null
          first_name: string
          first_surname: string
          gender?: string | null
          id?: string
          is_deceased?: boolean | null
          middle_name?: string | null
          normalized_full_name?: string | null
          photo_path?: string | null
          public_id?: string
          second_surname?: string | null
          status?: Database["public"]["Enums"]["person_status"] | null
          updated_at?: string | null
        }
        Update: {
          birth_city?: string | null
          birth_country?: string | null
          birth_date?: string | null
          birth_date_precision?: string | null
          birth_year?: number | null
          created_at?: string | null
          created_by?: string | null
          death_date?: string | null
          deleted_at?: string | null
          first_name?: string
          first_surname?: string
          gender?: string | null
          id?: string
          is_deceased?: boolean | null
          middle_name?: string | null
          normalized_full_name?: string | null
          photo_path?: string | null
          public_id?: string
          second_surname?: string | null
          status?: Database["public"]["Enums"]["person_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      photo_tags: {
        Row: {
          person_id: string
          photo_id: string
        }
        Insert: {
          person_id: string
          photo_id: string
        }
        Update: {
          person_id?: string
          photo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_tags_photo_id_fkey1"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          scope: Database["public"]["Enums"]["broadcast_scope"]
          storage_path: string
          taken_at: string | null
          uploader_user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          scope?: Database["public"]["Enums"]["broadcast_scope"]
          storage_path: string
          taken_at?: string | null
          uploader_user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          scope?: Database["public"]["Enums"]["broadcast_scope"]
          storage_path?: string
          taken_at?: string | null
          uploader_user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string | null
          avatar_path: string | null
          created_at: string | null
          deleted_at: string | null
          display_name: string | null
          id: string
          locale: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_status?: string | null
          avatar_path?: string | null
          created_at?: string | null
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          locale?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_status?: string | null
          avatar_path?: string | null
          created_at?: string | null
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          locale?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      relaciones_rotas_backup: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          declared_by_user_id: string | null
          id: string | null
          notes: string | null
          pair_key: string | null
          person_a_id: string | null
          person_b_id: string | null
          source: string | null
          status: Database["public"]["Enums"]["relationship_status"] | null
          system_inferred: boolean | null
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          declared_by_user_id?: string | null
          id?: string | null
          notes?: string | null
          pair_key?: string | null
          person_a_id?: string | null
          person_b_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["relationship_status"] | null
          system_inferred?: boolean | null
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          declared_by_user_id?: string | null
          id?: string | null
          notes?: string | null
          pair_key?: string | null
          person_a_id?: string | null
          person_b_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["relationship_status"] | null
          system_inferred?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      relationships: {
        Row: {
          confirmed_by: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string
          is_current: boolean | null
          parent_kind: string | null
          person_a_id: string
          person_b_id: string
          relationship_status: string | null
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          source: string | null
          updated_at: string | null
        }
        Insert: {
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_current?: boolean | null
          parent_kind?: string | null
          person_a_id: string
          person_b_id: string
          relationship_status?: string | null
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_current?: boolean | null
          parent_kind?: string | null
          person_a_id?: string
          person_b_id?: string
          relationship_status?: string | null
          relationship_type?: Database["public"]["Enums"]["relationship_type"]
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relationships_person_a_id_fkey"
            columns: ["person_a_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_person_b_id_fkey"
            columns: ["person_b_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      relationships_legacy: {
        Row: {
          confirmed: boolean | null
          created_at: string | null
          id: string
          profile_a: string
          profile_b: string
          relation_from_a: string
          relation_from_b: string
          relation_kind: string
        }
        Insert: {
          confirmed?: boolean | null
          created_at?: string | null
          id?: string
          profile_a: string
          profile_b: string
          relation_from_a: string
          relation_from_b: string
          relation_kind?: string
        }
        Update: {
          confirmed?: boolean | null
          created_at?: string | null
          id?: string
          profile_a?: string
          profile_b?: string
          relation_from_a?: string
          relation_from_b?: string
          relation_kind?: string
        }
        Relationships: []
      }
      shared_trees: {
        Row: {
          created_at: string | null
          id: string
          profile_id: string
          token: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_id: string
          token?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_id?: string
          token?: string
        }
        Relationships: []
      }
      sos_alerts: {
        Row: {
          cooldown_until: string | null
          id: string
          lat: number | null
          lon: number | null
          message: string | null
          resolved_at: string | null
          scope_degree: number
          sender_user_id: string
          status: Database["public"]["Enums"]["sos_status"]
          triggered_at: string
        }
        Insert: {
          cooldown_until?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          message?: string | null
          resolved_at?: string | null
          scope_degree?: number
          sender_user_id: string
          status?: Database["public"]["Enums"]["sos_status"]
          triggered_at?: string
        }
        Update: {
          cooldown_until?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          message?: string | null
          resolved_at?: string | null
          scope_degree?: number
          sender_user_id?: string
          status?: Database["public"]["Enums"]["sos_status"]
          triggered_at?: string
        }
        Relationships: []
      }
      sos_responses: {
        Row: {
          message: string | null
          responded_at: string
          responder_user_id: string
          response: string
          sos_id: string
        }
        Insert: {
          message?: string | null
          responded_at?: string
          responder_user_id: string
          response: string
          sos_id: string
        }
        Update: {
          message?: string | null
          responded_at?: string
          responder_user_id?: string
          response?: string
          sos_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sos_responses_sos_id_fkey"
            columns: ["sos_id"]
            isOneToOne: false
            referencedRelation: "sos_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      space_memberships: {
        Row: {
          added_by: string | null
          created_at: string | null
          id: string
          person_id: string
          space_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          id?: string
          person_id: string
          space_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          id?: string
          person_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tree_memberships_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tree_memberships_tree_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "family_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          space_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          space_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tree_user_roles_tree_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "family_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      system_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_code: string
          earned_at: string
          user_id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string
          user_id: string
        }
        Update: {
          badge_code?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _admin_birthdays_for_person: {
        Args: { p_days?: number; p_person: string }
        Returns: {
          birth_date: string
          days_until: number
          full_name: string
          next_birthday: string
          person_id: string
          profile_photo_url: string
        }[]
      }
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      award_badge: {
        Args: { p_badge: string; p_user: string }
        Returns: boolean
      }
      can_edit_space: { Args: { p_space_id: string }; Returns: boolean }
      can_manage_space: { Args: { p_space_id: string }; Returns: boolean }
      can_view_relationship: {
        Args: { p_relationship_id: string }
        Returns: boolean
      }
      can_view_space: { Args: { p_space_id: string }; Returns: boolean }
      cancel_sos: { Args: { p_sos: string }; Returns: undefined }
      check_no_parent_cycle: {
        Args: { p_child_id: string; p_parent_id: string }
        Returns: boolean
      }
      claim_person: {
        Args: {
          p_invitation_token?: string
          p_person_id: string
          p_verification_method?: string
        }
        Returns: Json
      }
      confirm_name_match: {
        Args: { p_family_member_id: string; p_user_id: string }
        Returns: undefined
      }
      create_invitation: {
        Args: { p_channel?: string; p_person_id: string; p_template?: string }
        Returns: Json
      }
      create_person: {
        Args: { p_created_by?: string; p_data: Json }
        Returns: {
          person_id: string
          public_id: string
        }[]
      }
      create_relationship: {
        Args: {
          p_close_previous_partners?: boolean
          p_created_by?: string
          p_is_current?: boolean
          p_parent_kind?: string
          p_person_a_id: string
          p_person_b_id: string
          p_relationship: Database["public"]["Enums"]["relationship_type"]
          p_source?: string
        }
        Returns: string
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      find_name_matches: {
        Args: { p_first_name: string; p_last_name: string; p_user_id: string }
        Returns: {
          adder_first_name: string
          adder_id: string
          adder_last_name: string
          family_member_id: string
          relation_kind: string
          relation_type: string
        }[]
      }
      find_person_matches: {
        Args: {
          p_birth_city?: string
          p_birth_country?: string
          p_birth_date?: string
          p_first_name: string
          p_first_surname: string
          p_known_child_ids?: string[]
          p_known_parent_ids?: string[]
          p_known_partner_ids?: string[]
          p_second_surname?: string
        }
        Returns: {
          first_name: string
          first_surname: string
          match_reasons: Json
          match_score: number
          person_id: string
        }[]
      }
      generate_family_suggestions: {
        Args: {
          p_adder_id: string
          p_family_member_id: string
          p_first_name: string
          p_last_name: string
          p_relation_type: string
        }
        Returns: undefined
      }
      generate_person_public_id: { Args: never; Returns: string }
      generate_reverse_suggestions: {
        Args: {
          p_connector_id: string
          p_my_relation: string
          p_new_user_id: string
        }
        Returns: undefined
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_family_ids_up_to: {
        Args: { p_degree?: number; p_person: string }
        Returns: {
          person_id: string
        }[]
      }
      get_family_tree: {
        Args: { max_depth?: number; start_profile_id: string }
        Returns: {
          avatar_url: string
          city: string
          country: string
          depth: number
          first_name: string
          last_name: string
          latitude: number
          location_enabled: boolean
          longitude: number
          profile_id: string
          relation_path: string[]
        }[]
      }
      get_my_family_graph: { Args: { p_depth?: number }; Returns: Json }
      get_shared_tree: {
        Args: { p_token: string }
        Returns: {
          member_first_name: string
          member_has_profile: boolean
          member_last_name: string
          member_relation_type: string
          owner_avatar_url: string
          owner_city: string
          owner_country: string
          owner_first_name: string
          owner_id: string
          owner_last_name: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      infer_relation: {
        Args: { connector_relation: string; new_relation: string }
        Returns: string
      }
      is_in_my_family: {
        Args: { degree?: number; target_person: string }
        Returns: boolean
      }
      link_persons: {
        Args: { member_id_a: string; member_id_b: string }
        Returns: undefined
      }
      log_audit_critical: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      log_family_space_event: {
        Args: {
          p_actor_user_id: string
          p_event_type: string
          p_payload?: Json
          p_space_id: string
        }
        Returns: undefined
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_invitation_shared: {
        Args: { p_channel: string; p_invitation: string }
        Returns: undefined
      }
      normalize_text: { Args: { p_text: string }; Returns: string }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      record_invitation_event: {
        Args: { p_code: string; p_event: string; p_metadata?: Json }
        Returns: undefined
      }
      reject_match: { Args: { p_candidate: string }; Returns: undefined }
      respond_sos: {
        Args: { p_message?: string; p_response: string; p_sos: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      trigger_sos: {
        Args: {
          p_lat?: number
          p_lon?: number
          p_message?: string
          p_scope?: number
        }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
      unlockrows: { Args: { "": string }; Returns: number }
      upcoming_birthdays: {
        Args: { days?: number }
        Returns: {
          birth_date: string
          days_until: number
          full_name: string
          next_birthday: string
          person_id: string
          profile_photo_url: string
        }[]
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      validate_person_data: { Args: { p_data: Json }; Returns: undefined }
    }
    Enums: {
      broadcast_scope:
        | "direct_family"
        | "extended_family"
        | "specific_branch"
        | "all"
      claim_status: "pending" | "approved" | "rejected" | "revoked"
      gender_enum: "M" | "F" | "X" | "unknown"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      match_status:
        | "pending"
        | "confirmed_same"
        | "confirmed_different"
        | "needs_second_confirmation"
        | "expired"
      person_status: "active" | "merged" | "deleted" | "locked"
      relationship_status:
        | "pending"
        | "confirmed"
        | "rejected"
        | "system_inferred"
      relationship_type: "parent" | "partner" | "guardian"
      sos_status: "active" | "resolved" | "cancelled" | "expired"
      verification_level: "unverified" | "family_verified" | "self_verified"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
  auth: {
    Enums: {
      aal_level: ["aal1", "aal2", "aal3"],
      code_challenge_method: ["s256", "plain"],
      factor_status: ["unverified", "verified"],
      factor_type: ["totp", "webauthn", "phone"],
      oauth_authorization_status: ["pending", "approved", "denied", "expired"],
      oauth_client_type: ["public", "confidential"],
      oauth_registration_type: ["dynamic", "manual"],
      oauth_response_type: ["code"],
      one_time_token_type: [
        "confirmation_token",
        "reauthentication_token",
        "recovery_token",
        "email_change_token_new",
        "email_change_token_current",
        "phone_change_token",
      ],
    },
  },
  public: {
    Enums: {
      broadcast_scope: [
        "direct_family",
        "extended_family",
        "specific_branch",
        "all",
      ],
      claim_status: ["pending", "approved", "rejected", "revoked"],
      gender_enum: ["M", "F", "X", "unknown"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      match_status: [
        "pending",
        "confirmed_same",
        "confirmed_different",
        "needs_second_confirmation",
        "expired",
      ],
      person_status: ["active", "merged", "deleted", "locked"],
      relationship_status: [
        "pending",
        "confirmed",
        "rejected",
        "system_inferred",
      ],
      relationship_type: ["parent", "partner", "guardian"],
      sos_status: ["active", "resolved", "cancelled", "expired"],
      verification_level: ["unverified", "family_verified", "self_verified"],
    },
  },
} as const
