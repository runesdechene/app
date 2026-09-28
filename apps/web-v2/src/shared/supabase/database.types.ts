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
      activity_log: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json | null
          faction_id: string | null
          id: number
          place_id: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          faction_id?: string | null
          id?: number
          place_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          faction_id?: string | null
          id?: number
          place_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_screens: {
        Row: {
          active: boolean
          created_at: string | null
          id: number
          image_url: string
          linked_tip_id: number | null
          product_url: string | null
          title: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          id?: number
          image_url: string
          linked_tip_id?: number | null
          product_url?: string | null
          title?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          id?: number
          image_url?: string
          linked_tip_id?: number | null
          product_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_screens_linked_tip_id_fkey"
            columns: ["linked_tip_id"]
            isOneToOne: false
            referencedRelation: "ad_tips"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_tips: {
        Row: {
          active: boolean
          created_at: string | null
          id: number
          subtitle: string | null
          tag: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          id?: number
          subtitle?: string | null
          tag?: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          id?: number
          subtitle?: string | null
          tag?: string
          title?: string
        }
        Relationships: []
      }
      allowed_emojis: {
        Row: {
          category: string
          display_order: number
          emoji: string
        }
        Insert: {
          category: string
          display_order?: number
          emoji: string
        }
        Update: {
          category?: string
          display_order?: number
          emoji?: string
        }
        Relationships: []
      }
      announcement_comment_likes: {
        Row: {
          comment_id: number
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: number
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: number
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "announcement_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_comments: {
        Row: {
          announcement_id: string
          content: string
          created_at: string
          id: number
          parent_id: number | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          content: string
          created_at?: string
          id?: never
          parent_id?: number | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          content?: string
          created_at?: string
          id?: never
          parent_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "announcement_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_likes: {
        Row: {
          announcement_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_likes_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          body: string
          channels: Json
          cover_image: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          insta_caption: string | null
          published_at: string | null
          push_text: string | null
          shopify_article_id: string | null
          slug: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body?: string
          channels?: Json
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          insta_caption?: string | null
          published_at?: string | null
          push_text?: string | null
          shopify_article_id?: string | null
          slug: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          channels?: Json
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          insta_caption?: string | null
          published_at?: string | null
          push_text?: string | null
          shopify_article_id?: string | null
          slug?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      chat_mentions: {
        Row: {
          message_id: number
          user_id: string
        }
        Insert: {
          message_id: number
          user_id: string
        }
        Update: {
          message_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          channel: string
          content: string
          created_at: string
          faction_color: string | null
          faction_id: string | null
          faction_pattern: string | null
          id: number
          user_id: string
          user_name: string
        }
        Insert: {
          channel: string
          content: string
          created_at?: string
          faction_color?: string | null
          faction_id?: string | null
          faction_pattern?: string | null
          id?: number
          user_id: string
          user_name: string
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          faction_color?: string | null
          faction_id?: string | null
          faction_pattern?: string | null
          id?: number
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      community_quest_contributions: {
        Row: {
          count: number
          quest_id: string
          rewarded_at: string | null
          user_id: string
        }
        Insert: {
          count?: number
          quest_id: string
          rewarded_at?: string | null
          user_id: string
        }
        Update: {
          count?: number
          quest_id?: string
          rewarded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_quest_contributions_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "community_quests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_quest_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_quest_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      community_quests: {
        Row: {
          created_at: string
          current_count: number
          ends_at: string | null
          icon: string
          id: string
          place_type_filter: string | null
          reward_couronnes: number
          reward_xp: number
          starts_at: string
          status: string
          target: number
          tracker_kind: string
          wording: string
        }
        Insert: {
          created_at?: string
          current_count?: number
          ends_at?: string | null
          icon?: string
          id: string
          place_type_filter?: string | null
          reward_couronnes?: number
          reward_xp?: number
          starts_at?: string
          status?: string
          target: number
          tracker_kind: string
          wording: string
        }
        Update: {
          created_at?: string
          current_count?: number
          ends_at?: string | null
          icon?: string
          id?: string
          place_type_filter?: string | null
          reward_couronnes?: number
          reward_xp?: number
          starts_at?: string
          status?: string
          target?: number
          tracker_kind?: string
          wording?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          color: string
          created_at: string
          description: string | null
          founder_user_id: string | null
          id: string
          image_url: string | null
          is_official: boolean
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          founder_user_id?: string | null
          id?: string
          image_url?: string | null
          is_official?: boolean
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          founder_user_id?: string | null
          id?: string
          image_url?: string | null
          is_official?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_founder_user_id_fkey"
            columns: ["founder_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_founder_user_id_fkey"
            columns: ["founder_user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      company_bans: {
        Row: {
          company_id: string
          until: string
          user_id: string
        }
        Insert: {
          company_id: string
          until: string
          user_id: string
        }
        Update: {
          company_id?: string
          until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_bans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      company_messages: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: number
          user_id: string
          user_name: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: never
          user_id: string
          user_name: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: never
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_votes: {
        Row: {
          contribution_id: number
          created_at: string
          id: number
          user_id: string
          vote: number
        }
        Insert: {
          contribution_id: number
          created_at?: string
          id?: number
          user_id: string
          vote: number
        }
        Update: {
          contribution_id?: number
          created_at?: string
          id?: number
          user_id?: string
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "contribution_votes_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "place_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      coupe_seasons: {
        Row: {
          ended_at: string | null
          id: number
          name: string
          started_at: string
        }
        Insert: {
          ended_at?: string | null
          id?: number
          name: string
          started_at?: string
        }
        Update: {
          ended_at?: string | null
          id?: number
          name?: string
          started_at?: string
        }
        Relationships: []
      }
      crown_harvest: {
        Row: {
          last_harvested_at: string
          place_id: string
          user_id: string
        }
        Insert: {
          last_harvested_at?: string
          place_id: string
          user_id: string
        }
        Update: {
          last_harvested_at?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crown_harvest_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crown_harvest_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crown_harvest_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      defi_claims: {
        Row: {
          claimed_at: string
          defi_id: string
          period_key: string
          reward_couronnes: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          defi_id: string
          period_key: string
          reward_couronnes?: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          defi_id?: string
          period_key?: string
          reward_couronnes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "defi_claims_defi_id_fkey"
            columns: ["defi_id"]
            isOneToOne: false
            referencedRelation: "defis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defi_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defi_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      defis: {
        Row: {
          action: string
          active: boolean
          cadence: string
          counts_from: string | null
          created_at: string
          display_order: number
          icon: string
          id: string
          reward_couronnes: number
          scope: string
          tag_id: string | null
          threshold: number
          wording: string
        }
        Insert: {
          action: string
          active?: boolean
          cadence: string
          counts_from?: string | null
          created_at?: string
          display_order?: number
          icon?: string
          id: string
          reward_couronnes?: number
          scope?: string
          tag_id?: string | null
          threshold: number
          wording: string
        }
        Update: {
          action?: string
          active?: boolean
          cadence?: string
          counts_from?: string | null
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          reward_couronnes?: number
          scope?: string
          tag_id?: string | null
          threshold?: number
          wording?: string
        }
        Relationships: []
      }
      enigma_responses: {
        Row: {
          answer_given: string
          correct: boolean
          enigma_id: number
          erudition_gained: number
          fragment_id: number | null
          id: number
          influence_gained: number
          responded_at: string
          user_id: string
        }
        Insert: {
          answer_given: string
          correct: boolean
          enigma_id: number
          erudition_gained?: number
          fragment_id?: number | null
          id?: number
          influence_gained?: number
          responded_at?: string
          user_id: string
        }
        Update: {
          answer_given?: string
          correct?: boolean
          enigma_id?: number
          erudition_gained?: number
          fragment_id?: number | null
          id?: number
          influence_gained?: number
          responded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enigma_responses_enigma_id_fkey"
            columns: ["enigma_id"]
            isOneToOne: false
            referencedRelation: "enigmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enigma_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enigma_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      enigma_themes: {
        Row: {
          active: boolean
          color: string | null
          icon: string | null
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          color?: string | null
          icon?: string | null
          id: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          color?: string | null
          icon?: string | null
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      enigmas: {
        Row: {
          active: boolean
          answer: string
          choices: Json | null
          created_at: string
          difficulty: string
          explanation: string
          format: string
          fragment_id: number | null
          id: number
          lore_text: string
          place_tag: string | null
          question: string
          theme: string | null
          type: string
        }
        Insert: {
          active?: boolean
          answer: string
          choices?: Json | null
          created_at?: string
          difficulty: string
          explanation: string
          format: string
          fragment_id?: number | null
          id?: number
          lore_text: string
          place_tag?: string | null
          question: string
          theme?: string | null
          type: string
        }
        Update: {
          active?: boolean
          answer?: string
          choices?: Json | null
          created_at?: string
          difficulty?: string
          explanation?: string
          format?: string
          fragment_id?: number | null
          id?: number
          lore_text?: string
          place_tag?: string | null
          question?: string
          theme?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "enigmas_fragment_id_fkey"
            columns: ["fragment_id"]
            isOneToOne: false
            referencedRelation: "title_fragments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enigmas_theme_fkey"
            columns: ["theme"]
            isOneToOne: false
            referencedRelation: "enigma_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      eras: {
        Row: {
          id: string
          name: string
          sort_order: number
          year_end: number | null
          year_start: number | null
        }
        Insert: {
          id: string
          name: string
          sort_order: number
          year_end?: number | null
          year_start?: number | null
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          year_end?: number | null
          year_start?: number | null
        }
        Relationships: []
      }
      expedition_members: {
        Row: {
          expedition_id: string
          faction_id: string | null
          user_id: string
        }
        Insert: {
          expedition_id: string
          faction_id?: string | null
          user_id: string
        }
        Update: {
          expedition_id?: string
          faction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expedition_members_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedition_members_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedition_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedition_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      expeditions: {
        Row: {
          created_at: string
          faction_id: string | null
          id: string
          is_neutral: boolean
          place_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          faction_id?: string | null
          id?: string
          is_neutral?: boolean
          place_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          faction_id?: string | null
          id?: string
          is_neutral?: boolean
          place_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expeditions_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expeditions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      faction_banner_history: {
        Row: {
          ended_at: string | null
          faction_id: string
          id: number
          started_at: string
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          faction_id: string
          id?: never
          started_at?: string
          user_id: string
        }
        Update: {
          ended_at?: string | null
          faction_id?: string
          id?: never
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faction_banner_history_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faction_banner_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faction_banner_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      faction_gold_log: {
        Row: {
          amount: number
          day: string
          faction_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          day?: string
          faction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          day?: string
          faction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faction_gold_log_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faction_gold_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faction_gold_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      faction_grade_labels: {
        Row: {
          capacity: number | null
          faction_id: string
          label_f: string
          label_m: string
          label_n: string | null
          rank: number
        }
        Insert: {
          capacity?: number | null
          faction_id: string
          label_f: string
          label_m: string
          label_n?: string | null
          rank: number
        }
        Update: {
          capacity?: number | null
          faction_id?: string
          label_f?: string
          label_m?: string
          label_n?: string | null
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "faction_grade_labels_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
        ]
      }
      faction_members: {
        Row: {
          crowns_conquered: number
          crowns_invested: number
          faction_id: string
          is_founder: boolean
          joined_at: string
          last_heralded_grade: number | null
          user_id: string
        }
        Insert: {
          crowns_conquered?: number
          crowns_invested?: number
          faction_id: string
          is_founder?: boolean
          joined_at?: string
          last_heralded_grade?: number | null
          user_id: string
        }
        Update: {
          crowns_conquered?: number
          crowns_invested?: number
          faction_id?: string
          is_founder?: boolean
          joined_at?: string
          last_heralded_grade?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faction_members_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faction_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faction_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      faction_tag_bonuses: {
        Row: {
          cost_reduction: number
          faction_id: string
          tag_id: string
        }
        Insert: {
          cost_reduction?: number
          faction_id: string
          tag_id: string
        }
        Update: {
          cost_reduction?: number
          faction_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faction_tag_bonuses_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faction_tag_bonuses_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      factions: {
        Row: {
          adjective: string | null
          bonus_conquest: number
          bonus_construction: number
          bonus_energy: number
          bonus_regen: number
          bonus_regen_conquest: number
          bonus_regen_construction: number
          bonus_regen_energy: number
          bonus_regen_vitalite: number | null
          bonus_vitalite: number | null
          color: string
          created_at: string | null
          created_by: string | null
          description: string | null
          emblem_icon: string | null
          emblem_mono: string
          govern_grades: number
          id: string
          image_url: string | null
          order: number
          pattern: string | null
          public_slug: string | null
          retired: boolean
          tags: string[]
          title: string
          updated_at: string | null
        }
        Insert: {
          adjective?: string | null
          bonus_conquest?: number
          bonus_construction?: number
          bonus_energy?: number
          bonus_regen?: number
          bonus_regen_conquest?: number
          bonus_regen_construction?: number
          bonus_regen_energy?: number
          bonus_regen_vitalite?: number | null
          bonus_vitalite?: number | null
          color?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          emblem_icon?: string | null
          emblem_mono?: string
          govern_grades?: number
          id: string
          image_url?: string | null
          order?: number
          pattern?: string | null
          public_slug?: string | null
          retired?: boolean
          tags?: string[]
          title: string
          updated_at?: string | null
        }
        Update: {
          adjective?: string | null
          bonus_conquest?: number
          bonus_construction?: number
          bonus_energy?: number
          bonus_regen?: number
          bonus_regen_conquest?: number
          bonus_regen_construction?: number
          bonus_regen_energy?: number
          bonus_regen_vitalite?: number | null
          bonus_vitalite?: number | null
          color?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          emblem_icon?: string | null
          emblem_mono?: string
          govern_grades?: number
          id?: string
          image_url?: string | null
          order?: number
          pattern?: string | null
          public_slug?: string | null
          retired?: boolean
          tags?: string[]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      flyer_signup_log: {
        Row: {
          created_at: string
          email: string | null
          id: number
          ip: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: number
          ip: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: number
          ip?: string
        }
        Relationships: []
      }
      fragment_ability_uses: {
        Row: {
          fragment_id: number
          used_at: string
          user_id: string
        }
        Insert: {
          fragment_id: number
          used_at?: string
          user_id: string
        }
        Update: {
          fragment_id?: number
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fragment_ability_uses_fragment_id_fkey"
            columns: ["fragment_id"]
            isOneToOne: false
            referencedRelation: "title_fragments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fragment_ability_uses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fragment_ability_uses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      fragment_audio_plays: {
        Row: {
          completed: boolean
          created_at: string
          duration_seconds: number | null
          id: number
          illustration_handle: string
          listened_seconds: number
          played_on: string
          session_id: string
          source: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          id?: never
          illustration_handle: string
          listened_seconds?: number
          played_on?: string
          session_id: string
          source: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          id?: never
          illustration_handle?: string
          listened_seconds?: number
          played_on?: string
          session_id?: string
          source?: string
        }
        Relationships: []
      }
      fragment_tag_affinities: {
        Row: {
          bonus_points: number
          fragment_id: number
          tag_id: string
        }
        Insert: {
          bonus_points?: number
          fragment_id: number
          tag_id: string
        }
        Update: {
          bonus_points?: number
          fragment_id?: number
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fragment_tag_affinities_fragment_id_fkey"
            columns: ["fragment_id"]
            isOneToOne: false
            referencedRelation: "title_fragments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fragment_tag_affinities_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      fragment_words: {
        Row: {
          created_at: string | null
          fragment_id: number
          gender: string | null
          id: number
          slot: string
          word: string
        }
        Insert: {
          created_at?: string | null
          fragment_id: number
          gender?: string | null
          id?: number
          slot: string
          word: string
        }
        Update: {
          created_at?: string | null
          fragment_id?: number
          gender?: string | null
          id?: number
          slot?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "fragment_words_fragment_id_fkey"
            columns: ["fragment_id"]
            isOneToOne: false
            referencedRelation: "title_fragments"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_departements: {
        Row: {
          code: string
          de_nom: string
          geom: unknown
          nom: string
        }
        Insert: {
          code: string
          de_nom: string
          geom: unknown
          nom: string
        }
        Update: {
          code?: string
          de_nom?: string
          geom?: unknown
          nom?: string
        }
        Relationships: []
      }
      geo_pays: {
        Row: {
          geom: unknown
          iso2: string
          nom_fr: string
        }
        Insert: {
          geom: unknown
          iso2: string
          nom_fr: string
        }
        Update: {
          geom?: unknown
          iso2?: string
          nom_fr?: string
        }
        Relationships: []
      }
      home_banners: {
        Row: {
          active: boolean
          created_at: string
          id: number
          image_url: string
          link_url: string
          overlay_color: string
          overlay_opacity: number
          shadow_color: string
          shadow_strength: number
          subtitle: string | null
          subtitle_color: string
          tag_color: string
          title: string
          title_color: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          image_url: string
          link_url: string
          overlay_color?: string
          overlay_opacity?: number
          shadow_color?: string
          shadow_strength?: number
          subtitle?: string | null
          subtitle_color?: string
          tag_color?: string
          title: string
          title_color?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          image_url?: string
          link_url?: string
          overlay_color?: string
          overlay_opacity?: number
          shadow_color?: string
          shadow_strength?: number
          subtitle?: string | null
          subtitle_color?: string
          tag_color?: string
          title?: string
          title_color?: string
        }
        Relationships: []
      }
      hub_community_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          image_url: string
          metadata: Json | null
          moderated_at: string | null
          moderated_by: string | null
          rejection_reason: string | null
          status: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          metadata?: Json | null
          moderated_at?: string | null
          moderated_by?: string | null
          rejection_reason?: string | null
          status?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          metadata?: Json | null
          moderated_at?: string | null
          moderated_by?: string | null
          rejection_reason?: string | null
          status?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_community_photos_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_community_photos_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_community_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_community_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_photo_submission_tags: {
        Row: {
          submission_id: string
          tag_id: string
        }
        Insert: {
          submission_id: string
          tag_id: string
        }
        Update: {
          submission_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_photo_submission_tags_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "hub_photo_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_photo_submission_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "hub_photo_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_photo_submissions: {
        Row: {
          consent_account_creation: boolean
          consent_brand_usage: boolean
          created_at: string | null
          departement: string | null
          id: string
          location_name: string | null
          location_zip: string | null
          message: string | null
          model_height_cm: number | null
          model_shoulder_width_cm: number | null
          moderated_at: string | null
          moderated_by: string | null
          product_size: string | null
          product_worn: string | null
          quest_ref: string | null
          rating_experience: number | null
          rating_products: number | null
          reward_crowns: number | null
          rewarded_at: string | null
          status: string | null
          submitter_email: string
          submitter_instagram: string | null
          submitter_name: string
          submitter_role: string | null
          team_note: string | null
          user_id: string | null
        }
        Insert: {
          consent_account_creation?: boolean
          consent_brand_usage?: boolean
          created_at?: string | null
          departement?: string | null
          id?: string
          location_name?: string | null
          location_zip?: string | null
          message?: string | null
          model_height_cm?: number | null
          model_shoulder_width_cm?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          product_size?: string | null
          product_worn?: string | null
          quest_ref?: string | null
          rating_experience?: number | null
          rating_products?: number | null
          reward_crowns?: number | null
          rewarded_at?: string | null
          status?: string | null
          submitter_email: string
          submitter_instagram?: string | null
          submitter_name: string
          submitter_role?: string | null
          team_note?: string | null
          user_id?: string | null
        }
        Update: {
          consent_account_creation?: boolean
          consent_brand_usage?: boolean
          created_at?: string | null
          departement?: string | null
          id?: string
          location_name?: string | null
          location_zip?: string | null
          message?: string | null
          model_height_cm?: number | null
          model_shoulder_width_cm?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          product_size?: string | null
          product_worn?: string | null
          quest_ref?: string | null
          rating_experience?: number | null
          rating_products?: number | null
          reward_crowns?: number | null
          rewarded_at?: string | null
          status?: string | null
          submitter_email?: string
          submitter_instagram?: string | null
          submitter_name?: string
          submitter_role?: string | null
          team_note?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_photo_submissions_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_photo_submissions_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_photo_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_photo_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_photo_tags: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      hub_submission_images: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          product_worn: string | null
          shopify_media_id: string | null
          shopify_product_handle: string | null
          shopify_product_id: string | null
          shopify_product_title: string | null
          show_in_community: boolean
          show_on_wall: boolean
          size: string | null
          sort_order: number | null
          status: string
          storage_path: string
          submission_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          product_worn?: string | null
          shopify_media_id?: string | null
          shopify_product_handle?: string | null
          shopify_product_id?: string | null
          shopify_product_title?: string | null
          show_in_community?: boolean
          show_on_wall?: boolean
          size?: string | null
          sort_order?: number | null
          status?: string
          storage_path: string
          submission_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          product_worn?: string | null
          shopify_media_id?: string | null
          shopify_product_handle?: string | null
          shopify_product_id?: string | null
          shopify_product_title?: string | null
          show_in_community?: boolean
          show_on_wall?: boolean
          size?: string | null
          sort_order?: number | null
          status?: string
          storage_path?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_submission_images_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "hub_photo_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      image_media: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          variants: Json
        }
        Insert: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          variants: Json
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "image_media_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_media_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      member_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_consumed: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          code: string
          created_at: string
          id: string
          is_consumed: boolean
          updated_at: string
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_consumed?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_codes_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_codes_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      mikro_orm_migrations: {
        Row: {
          executed_at: string | null
          id: number
          name: string | null
        }
        Insert: {
          executed_at?: string | null
          id?: number
          name?: string | null
        }
        Update: {
          executed_at?: string | null
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      mission_message_reads: {
        Row: {
          last_read_at: string
          mission_slug: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          mission_slug: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          mission_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_message_reads_mission_slug_fkey"
            columns: ["mission_slug"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "mission_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          mission_slug: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          mission_slug: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          mission_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_messages_mission_slug_fkey"
            columns: ["mission_slug"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "mission_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_participants: {
        Row: {
          joined_at: string
          mission_slug: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          mission_slug: string
          user_id: string
        }
        Update: {
          joined_at?: string
          mission_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_participants_mission_slug_fkey"
            columns: ["mission_slug"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "mission_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          brief: string | null
          call: string | null
          cover_image_url: string | null
          created_at: string
          cta_label: string | null
          cta_url: string | null
          deliverable_kind: string
          emblem: string | null
          ends_at: string | null
          eyebrow: string | null
          floor_crowns: number
          floor_glory: number
          pact_question: string | null
          product_handle: string | null
          promo_code: string | null
          promo_note: string | null
          reward_hint: string | null
          salon_intro: string | null
          slug: string
          starts_at: string | null
          status: string
          title: string
        }
        Insert: {
          brief?: string | null
          call?: string | null
          cover_image_url?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          deliverable_kind?: string
          emblem?: string | null
          ends_at?: string | null
          eyebrow?: string | null
          floor_crowns?: number
          floor_glory?: number
          pact_question?: string | null
          product_handle?: string | null
          promo_code?: string | null
          promo_note?: string | null
          reward_hint?: string | null
          salon_intro?: string | null
          slug: string
          starts_at?: string | null
          status?: string
          title: string
        }
        Update: {
          brief?: string | null
          call?: string | null
          cover_image_url?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          deliverable_kind?: string
          emblem?: string | null
          ends_at?: string | null
          eyebrow?: string | null
          floor_crowns?: number
          floor_glory?: number
          pact_question?: string | null
          product_handle?: string | null
          promo_code?: string | null
          promo_note?: string | null
          reward_hint?: string | null
          salon_intro?: string | null
          slug?: string
          starts_at?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      murmures: {
        Row: {
          a: string
          cree_le: string
          de: string
          id: number
          lu_le: string | null
          texte: string
        }
        Insert: {
          a: string
          cree_le?: string
          de: string
          id?: number
          lu_le?: string | null
          texte: string
        }
        Update: {
          a?: string
          cree_le?: string
          de?: string
          id?: number
          lu_le?: string | null
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "murmures_a_fkey"
            columns: ["a"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murmures_a_fkey"
            columns: ["a"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murmures_de_fkey"
            columns: ["de"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murmures_de_fkey"
            columns: ["de"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: number
          read: boolean
          recipient_id: string
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: number
          read?: boolean
          recipient_id: string
          type: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: number
          read?: boolean
          recipient_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      password_resets: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          is_consumed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at: string
          expires_at: string
          id: string
          is_consumed: boolean
          updated_at: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_consumed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_resets_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "password_resets_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      place_contributions: {
        Row: {
          content: string | null
          created_at: string
          faction_id: string | null
          id: number
          image_url: string | null
          images: Json | null
          parent_id: number | null
          place_id: string
          rating: number | null
          title: string | null
          type: string
          updated_at: string
          user_id: string
          votes_down: number
          votes_up: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          faction_id?: string | null
          id?: number
          image_url?: string | null
          images?: Json | null
          parent_id?: number | null
          place_id: string
          rating?: number | null
          title?: string | null
          type: string
          updated_at?: string
          user_id: string
          votes_down?: number
          votes_up?: number
        }
        Update: {
          content?: string | null
          created_at?: string
          faction_id?: string | null
          id?: number
          image_url?: string | null
          images?: Json | null
          parent_id?: number | null
          place_id?: string
          rating?: number | null
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          votes_down?: number
          votes_up?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_contributions_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_contributions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "place_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_contributions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      place_court_action: {
        Row: {
          amount: number
          beneficiary_user_id: string
          created_at: string
          expedition_id: string
          id: number
          place_id: string
          side: string
          user_id: string
        }
        Insert: {
          amount: number
          beneficiary_user_id: string
          created_at?: string
          expedition_id: string
          id?: number
          place_id: string
          side: string
          user_id: string
        }
        Update: {
          amount?: number
          beneficiary_user_id?: string
          created_at?: string
          expedition_id?: string
          id?: number
          place_id?: string
          side?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_court_action_beneficiary_user_id_fkey"
            columns: ["beneficiary_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_court_action_beneficiary_user_id_fkey"
            columns: ["beneficiary_user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_court_action_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_court_action_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_court_action_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_court_action_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      place_court_score: {
        Row: {
          expedition_id: string
          last_action_at: string
          place_id: string
          score: number
        }
        Insert: {
          expedition_id: string
          last_action_at?: string
          place_id: string
          score?: number
        }
        Update: {
          expedition_id?: string
          last_action_at?: string
          place_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_court_score_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_court_score_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_description_revisions: {
        Row: {
          content: string
          created_at: string
          edited_by: string
          id: number
          place_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_by: string
          id?: never
          place_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_by?: string
          id?: never
          place_id?: string
        }
        Relationships: []
      }
      place_drafts: {
        Row: {
          accuracy_m: number | null
          created_at: string
          id: string
          images: Json
          latitude: number
          longitude: number
          published_at: string | null
          published_place_id: string | null
          status: string
          title: string | null
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          created_at?: string
          id?: string
          images?: Json
          latitude: number
          longitude: number
          published_at?: string | null
          published_place_id?: string | null
          status?: string
          title?: string | null
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          created_at?: string
          id?: string
          images?: Json
          latitude?: number
          longitude?: number
          published_at?: string | null
          published_place_id?: string | null
          status?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_drafts_published_place_id_fkey"
            columns: ["published_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      place_explorers: {
        Row: {
          id: number
          place_id: string
          user_id: string
          visited_at: string
        }
        Insert: {
          id?: number
          place_id: string
          user_id: string
          visited_at?: string
        }
        Update: {
          id?: number
          place_id?: string
          user_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_explorers_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_explorers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_explorers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      place_moderation_log: {
        Row: {
          action: string
          created_at: string
          detail: Json
          id: number
          moderator_id: string | null
          place_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json
          id?: never
          moderator_id?: string | null
          place_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json
          id?: never
          moderator_id?: string | null
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_moderation_log_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_moderation_log_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_moderation_log_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_position_history: {
        Row: {
          created_at: string
          id: string
          new_address: string | null
          new_latitude: number
          new_longitude: number
          old_address: string | null
          old_latitude: number
          old_longitude: number
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_address?: string | null
          new_latitude: number
          new_longitude: number
          old_address?: string | null
          old_latitude: number
          old_longitude: number
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_address?: string | null
          new_latitude?: number
          new_longitude?: number
          old_address?: string | null
          old_latitude?: number
          old_longitude?: number
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_position_history_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_position_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_position_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      place_ratings: {
        Row: {
          created_at: string
          id: number
          place_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          place_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          place_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_ratings_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      place_tags: {
        Row: {
          created_at: string
          created_by: string | null
          is_primary: boolean
          place_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_primary?: boolean
          place_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_primary?: boolean
          place_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_tags_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      place_tags_revisions: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          new_tag_ids: string[]
          old_tag_ids: string[]
          place_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_tag_ids: string[]
          old_tag_ids?: string[]
          place_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_tag_ids?: string[]
          old_tag_ids?: string[]
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_tags_revisions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_tags_revisions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_tags_revisions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_types: {
        Row: {
          background: string | null
          border: string | null
          color: string
          created_at: string
          faded_color: string | null
          form_description: string
          hidden: boolean | null
          id: string
          images: Json
          long_description: string
          order: number
          parent_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          background?: string | null
          border?: string | null
          color: string
          created_at: string
          faded_color?: string | null
          form_description: string
          hidden?: boolean | null
          id: string
          images: Json
          long_description: string
          order: number
          parent_id?: string | null
          title: string
          updated_at: string
        }
        Update: {
          background?: string | null
          border?: string | null
          color?: string
          created_at?: string
          faded_color?: string | null
          form_description?: string
          hidden?: boolean | null
          id?: string
          images?: Json
          long_description?: string
          order?: number
          parent_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_types_parent_id_foreign"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "place_types"
            referencedColumns: ["id"]
          },
        ]
      }
      place_veille: {
        Row: {
          by_influence: boolean
          expedition_id: string
          faction_id: string | null
          is_neutral: boolean
          place_id: string
          planted_at: string
          previous_expedition_id: string | null
          veilleur_user_id: string | null
        }
        Insert: {
          by_influence?: boolean
          expedition_id: string
          faction_id?: string | null
          is_neutral?: boolean
          place_id: string
          planted_at?: string
          previous_expedition_id?: string | null
          veilleur_user_id?: string | null
        }
        Update: {
          by_influence?: boolean
          expedition_id?: string
          faction_id?: string | null
          is_neutral?: boolean
          place_id?: string
          planted_at?: string
          previous_expedition_id?: string | null
          veilleur_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_veille_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_veille_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_veille_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_veille_previous_expedition_id_fkey"
            columns: ["previous_expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_veille_veilleur_user_id_fkey"
            columns: ["veilleur_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_veille_veilleur_user_id_fkey"
            columns: ["veilleur_user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      place_wishlist: {
        Row: {
          created_at: string
          id: number
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_wishlist_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_wishlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_wishlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          accessibility: string | null
          address: string
          author_id: string
          begin_at: string | null
          best_season: string | null
          bivouac: string | null
          created_at: string
          departement: string | null
          end_at: string | null
          era_id: string | null
          faction_id: string | null
          geocaching: string | null
          id: string
          images: Json
          latitude: number
          longitude: number
          masked: boolean
          nature: string
          pays: string | null
          place_type_id: string
          private: boolean
          sensible: boolean | null
          seo_description: string | null
          seo_generated_at: string | null
          seo_source_hash: string | null
          slug: string | null
          text: string
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          year_exact: number | null
        }
        Insert: {
          accessibility?: string | null
          address: string
          author_id: string
          begin_at?: string | null
          best_season?: string | null
          bivouac?: string | null
          created_at: string
          departement?: string | null
          end_at?: string | null
          era_id?: string | null
          faction_id?: string | null
          geocaching?: string | null
          id: string
          images: Json
          latitude: number
          longitude: number
          masked: boolean
          nature?: string
          pays?: string | null
          place_type_id: string
          private: boolean
          sensible?: boolean | null
          seo_description?: string | null
          seo_generated_at?: string | null
          seo_source_hash?: string | null
          slug?: string | null
          text: string
          title: string
          updated_at: string
          verified_at?: string | null
          verified_by?: string | null
          year_exact?: number | null
        }
        Update: {
          accessibility?: string | null
          address?: string
          author_id?: string
          begin_at?: string | null
          best_season?: string | null
          bivouac?: string | null
          created_at?: string
          departement?: string | null
          end_at?: string | null
          era_id?: string | null
          faction_id?: string | null
          geocaching?: string | null
          id?: string
          images?: Json
          latitude?: number
          longitude?: number
          masked?: boolean
          nature?: string
          pays?: string | null
          place_type_id?: string
          private?: boolean
          sensible?: boolean | null
          seo_description?: string | null
          seo_generated_at?: string | null
          seo_source_hash?: string | null
          slug?: string | null
          text?: string
          title?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          year_exact?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "places_author_id_foreign"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_author_id_foreign"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_era_id_fkey"
            columns: ["era_id"]
            isOneToOne: false
            referencedRelation: "eras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_place_type_id_foreign"
            columns: ["place_type_id"]
            isOneToOne: false
            referencedRelation: "place_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      places_bookmarked: {
        Row: {
          created_at: string
          id: string
          place_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          id: string
          place_id: string
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_bookmarked_place_id_foreign"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_bookmarked_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_bookmarked_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      places_discovered: {
        Row: {
          discovered_at: string
          method: string
          place_id: string
          user_id: string
        }
        Insert: {
          discovered_at?: string
          method?: string
          place_id: string
          user_id: string
        }
        Update: {
          discovered_at?: string
          method?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_discovered_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_discovered_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_discovered_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      places_explored: {
        Row: {
          created_at: string
          id: string
          place_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          id: string
          place_id: string
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_explored_place_id_foreign"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_explored_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_explored_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      places_liked: {
        Row: {
          created_at: string
          id: string
          place_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          id: string
          place_id: string
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_liked_place_id_foreign"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_liked_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_liked_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      places_viewed: {
        Row: {
          created_at: string
          id: string
          place_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          id: string
          place_id: string
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_viewed_place_id_foreign"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_viewed_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_viewed_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      presences: {
        Row: {
          latitude: number
          longitude: number
          user_id: string
          vu_a: string
        }
        Insert: {
          latitude: number
          longitude: number
          user_id: string
          vu_a?: string
        }
        Update: {
          latitude?: number
          longitude?: number
          user_id?: string
          vu_a?: string
        }
        Relationships: [
          {
            foreignKeyName: "presences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_log: {
        Row: {
          created_at: string | null
          email: string | null
          id: number
          shopify_order_id: string | null
          shopify_tag: string | null
          status: string
          unlock_ref_id: number | null
          unlock_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: number
          shopify_order_id?: string | null
          shopify_tag?: string | null
          status?: string
          unlock_ref_id?: number | null
          unlock_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: number
          shopify_order_id?: string | null
          shopify_tag?: string | null
          status?: string
          unlock_ref_id?: number | null
          unlock_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: number
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: number
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: number
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_templates: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          icon: string
          id: string
          reward_couronnes: number
          reward_xp: number
          threshold: number
          tracker_kind: string
          type: string
          wording: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          icon: string
          id: string
          reward_couronnes?: number
          reward_xp: number
          threshold: number
          tracker_kind: string
          type: string
          wording: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          reward_couronnes?: number
          reward_xp?: number
          threshold?: number
          tracker_kind?: string
          type?: string
          wording?: string
        }
        Relationships: []
      }
      refresh_tokens: {
        Row: {
          created_at: string
          disabled: boolean
          expires_at: string
          id: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at: string
          disabled: boolean
          expires_at: string
          id: string
          updated_at: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          disabled?: boolean
          expires_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refresh_tokens_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          geocache: boolean | null
          id: string
          message: string
          place_id: string
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          geocache?: boolean | null
          id: string
          message: string
          place_id: string
          score: number
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          geocache?: boolean | null
          id?: string
          message?: string
          place_id?: string
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_place_id_foreign"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_foreign"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews_images: {
        Row: {
          image_media_id: string
          review_id: string
        }
        Insert: {
          image_media_id: string
          review_id: string
        }
        Update: {
          image_media_id?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_images_image_media_id_foreign"
            columns: ["image_media_id"]
            isOneToOne: false
            referencedRelation: "image_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_images_review_id_foreign"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      saluts: {
        Row: {
          created_at: string
          destinataire: string
          evenement: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destinataire: string
          evenement: string
          user_id: string
        }
        Update: {
          created_at?: string
          destinataire?: string
          evenement?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saluts_destinataire_fkey"
            columns: ["destinataire"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saluts_destinataire_fkey"
            columns: ["destinataire"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saluts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saluts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_unlocks: {
        Row: {
          created_at: string | null
          id: number
          shopify_tag: string
          unlock_ref_id: number
          unlock_type: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          shopify_tag: string
          unlock_ref_id: number
          unlock_type?: string
        }
        Update: {
          created_at?: string | null
          id?: number
          shopify_tag?: string
          unlock_ref_id?: number
          unlock_type?: string
        }
        Relationships: []
      }
      tag_gauge_mapping: {
        Row: {
          gauge: string
          tag_id: string
        }
        Insert: {
          gauge?: string
          tag_id: string
        }
        Update: {
          gauge?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_gauge_mapping_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: true
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          background: string
          base_cost: number
          color: string
          created_at: string
          gauge: string
          icon: string | null
          id: string
          order: number
          reward_conquest: number
          reward_construction: number
          reward_energy: number
          title: string
          updated_at: string
        }
        Insert: {
          background?: string
          base_cost?: number
          color?: string
          created_at?: string
          gauge?: string
          icon?: string | null
          id: string
          order?: number
          reward_conquest?: number
          reward_construction?: number
          reward_energy?: number
          title: string
          updated_at?: string
        }
        Update: {
          background?: string
          base_cost?: number
          color?: string
          created_at?: string
          gauge?: string
          icon?: string | null
          id?: string
          order?: number
          reward_conquest?: number
          reward_construction?: number
          reward_energy?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      territoires_historiques: {
        Row: {
          departement: string
          nom: string
        }
        Insert: {
          departement: string
          nom: string
        }
        Update: {
          departement?: string
          nom?: string
        }
        Relationships: []
      }
      territory_name_proposals: {
        Row: {
          anchor_place_id: string
          created_at: string | null
          id: string
          name: string
          proposed_by: string
        }
        Insert: {
          anchor_place_id: string
          created_at?: string | null
          id?: string
          name: string
          proposed_by: string
        }
        Update: {
          anchor_place_id?: string
          created_at?: string | null
          id?: string
          name?: string
          proposed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_name_proposals_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_name_proposals_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_name_votes: {
        Row: {
          created_at: string | null
          id: string
          proposal_id: string
          value: number
          voter_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          proposal_id: string
          value: number
          voter_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          proposal_id?: string
          value?: number
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_name_votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "territory_name_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_name_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_name_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_tiers: {
        Row: {
          id: number
          min_places: number
          title: string
        }
        Insert: {
          id?: number
          min_places: number
          title: string
        }
        Update: {
          id?: number
          min_places?: number
          title?: string
        }
        Relationships: []
      }
      title_fragments: {
        Row: {
          ability_cooldown_hours: number | null
          ability_type: string | null
          ability_value: number | null
          bonus_type: string | null
          bonus_value: number | null
          collection: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          icon_url: string | null
          id: number
          image_url: string | null
          link_url: string | null
          name: string
          theme: string | null
          visible: boolean
        }
        Insert: {
          ability_cooldown_hours?: number | null
          ability_type?: string | null
          ability_value?: number | null
          bonus_type?: string | null
          bonus_value?: number | null
          collection?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          icon_url?: string | null
          id?: number
          image_url?: string | null
          link_url?: string | null
          name: string
          theme?: string | null
          visible?: boolean
        }
        Update: {
          ability_cooldown_hours?: number | null
          ability_type?: string | null
          ability_value?: number | null
          bonus_type?: string | null
          bonus_value?: number | null
          collection?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          icon_url?: string | null
          id?: number
          image_url?: string | null
          link_url?: string | null
          name?: string
          theme?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "title_fragments_theme_fkey"
            columns: ["theme"]
            isOneToOne: false
            referencedRelation: "enigma_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      titles: {
        Row: {
          condition: Json
          created_at: string | null
          description: string | null
          faction_id: string | null
          icon: string | null
          id: number
          name: string
          order: number
          type: string
          unlocks: string[] | null
        }
        Insert: {
          condition?: Json
          created_at?: string | null
          description?: string | null
          faction_id?: string | null
          icon?: string | null
          id?: number
          name: string
          order?: number
          type: string
          unlocks?: string[] | null
        }
        Update: {
          condition?: Json
          created_at?: string | null
          description?: string | null
          faction_id?: string | null
          icon?: string | null
          id?: number
          name?: string
          order?: number
          type?: string
          unlocks?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "titles_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_slides: {
        Row: {
          active: boolean | null
          body: string
          created_at: string | null
          id: number
          image_url: string | null
          phase: string
          position: number
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          body: string
          created_at?: string | null
          id?: number
          image_url?: string | null
          phase: string
          position: number
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          body?: string
          created_at?: string | null
          id?: number
          image_url?: string | null
          phase?: string
          position?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_crowns: {
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
        Relationships: [
          {
            foreignKeyName: "user_crowns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_crowns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      user_fragments: {
        Row: {
          fragment_id: number
          source: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          fragment_id: number
          source?: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          fragment_id?: number
          source?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_fragments_fragment_id_fkey"
            columns: ["fragment_id"]
            isOneToOne: false
            referencedRelation: "title_fragments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_fragments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_fragments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      user_quest_progress: {
        Row: {
          completed_at: string | null
          count: number
          date_local: string
          quest_template_id: string
          rewarded: boolean
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          count?: number
          date_local: string
          quest_template_id: string
          rewarded?: boolean
          user_id: string
        }
        Update: {
          completed_at?: string | null
          count?: number
          date_local?: string
          quest_template_id?: string
          rewarded?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_quest_progress_quest_template_id_fkey"
            columns: ["quest_template_id"]
            isOneToOne: false
            referencedRelation: "quest_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_quest_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_quest_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_source: string | null
          active_banner_switched_at: string | null
          active_company_id: string | null
          avatar_url: string | null
          bio: string | null
          biography: string
          brouiller_pistes: boolean
          charte_signee_le: string | null
          conquest_points: number
          conquest_reset_at: string | null
          construction_points: number
          construction_reset_at: string | null
          contributions_count: number
          created_at: string
          display_name: string | null
          displayed_general_title_ids: number[] | null
          displayed_title_ids_v3: number[] | null
          email_address: string
          energy_points: number
          energy_reset_at: string
          erudition_points: number
          exploration_points: number
          faction_change_count: number
          faction_change_window_start: string | null
          faction_changed_at: string | null
          faction_id: string | null
          first_name: string | null
          game_mode: string | null
          gender: string | null
          id: string
          instagram: string | null
          instagram_id: string | null
          is_active: boolean | null
          last_access: string | null
          last_device_os: string | null
          last_device_version: string | null
          last_login_at: string | null
          lieux_en_couleur: boolean
          location_name: string | null
          location_zip: string | null
          max_conquest: number
          max_construction: number
          max_energy: number
          max_vitalite: number | null
          muted_user_ids: string[]
          notoriety_points: number
          password: string | null
          push_important_enabled: boolean
          push_recap_enabled: boolean
          rank: string
          role: string
          shopify_customer_id: number | null
          show_departement: boolean
          show_envies: boolean
          signe_fragment_id: number | null
          timezone: string
          title_gender: string
          tutorial_completed_at: string | null
          updated_at: string
          v2_access: boolean
          veteran_first_era: boolean
          veteran_welcomed_at: string | null
          vitalite_points: number | null
          vitalite_reset_at: string | null
          website_url: string | null
          xp_total: number
        }
        Insert: {
          account_source?: string | null
          active_banner_switched_at?: string | null
          active_company_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          biography?: string
          brouiller_pistes?: boolean
          charte_signee_le?: string | null
          conquest_points?: number
          conquest_reset_at?: string | null
          construction_points?: number
          construction_reset_at?: string | null
          contributions_count?: number
          created_at?: string
          display_name?: string | null
          displayed_general_title_ids?: number[] | null
          displayed_title_ids_v3?: number[] | null
          email_address: string
          energy_points?: number
          energy_reset_at?: string
          erudition_points?: number
          exploration_points?: number
          faction_change_count?: number
          faction_change_window_start?: string | null
          faction_changed_at?: string | null
          faction_id?: string | null
          first_name?: string | null
          game_mode?: string | null
          gender?: string | null
          id: string
          instagram?: string | null
          instagram_id?: string | null
          is_active?: boolean | null
          last_access?: string | null
          last_device_os?: string | null
          last_device_version?: string | null
          last_login_at?: string | null
          lieux_en_couleur?: boolean
          location_name?: string | null
          location_zip?: string | null
          max_conquest?: number
          max_construction?: number
          max_energy?: number
          max_vitalite?: number | null
          muted_user_ids?: string[]
          notoriety_points?: number
          password?: string | null
          push_important_enabled?: boolean
          push_recap_enabled?: boolean
          rank?: string
          role: string
          shopify_customer_id?: number | null
          show_departement?: boolean
          show_envies?: boolean
          signe_fragment_id?: number | null
          timezone?: string
          title_gender?: string
          tutorial_completed_at?: string | null
          updated_at?: string
          v2_access?: boolean
          veteran_first_era?: boolean
          veteran_welcomed_at?: string | null
          vitalite_points?: number | null
          vitalite_reset_at?: string | null
          website_url?: string | null
          xp_total?: number
        }
        Update: {
          account_source?: string | null
          active_banner_switched_at?: string | null
          active_company_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          biography?: string
          brouiller_pistes?: boolean
          charte_signee_le?: string | null
          conquest_points?: number
          conquest_reset_at?: string | null
          construction_points?: number
          construction_reset_at?: string | null
          contributions_count?: number
          created_at?: string
          display_name?: string | null
          displayed_general_title_ids?: number[] | null
          displayed_title_ids_v3?: number[] | null
          email_address?: string
          energy_points?: number
          energy_reset_at?: string
          erudition_points?: number
          exploration_points?: number
          faction_change_count?: number
          faction_change_window_start?: string | null
          faction_changed_at?: string | null
          faction_id?: string | null
          first_name?: string | null
          game_mode?: string | null
          gender?: string | null
          id?: string
          instagram?: string | null
          instagram_id?: string | null
          is_active?: boolean | null
          last_access?: string | null
          last_device_os?: string | null
          last_device_version?: string | null
          last_login_at?: string | null
          lieux_en_couleur?: boolean
          location_name?: string | null
          location_zip?: string | null
          max_conquest?: number
          max_construction?: number
          max_energy?: number
          max_vitalite?: number | null
          muted_user_ids?: string[]
          notoriety_points?: number
          password?: string | null
          push_important_enabled?: boolean
          push_recap_enabled?: boolean
          rank?: string
          role?: string
          shopify_customer_id?: number | null
          show_departement?: boolean
          show_envies?: boolean
          signe_fragment_id?: number | null
          timezone?: string
          title_gender?: string
          tutorial_completed_at?: string | null
          updated_at?: string
          v2_access?: boolean
          veteran_first_era?: boolean
          veteran_welcomed_at?: string | null
          vitalite_points?: number | null
          vitalite_reset_at?: string | null
          website_url?: string | null
          xp_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "users_active_company_id_fkey"
            columns: ["active_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_signe_fragment_id_fkey"
            columns: ["signe_fragment_id"]
            isOneToOne: false
            referencedRelation: "title_fragments"
            referencedColumns: ["id"]
          },
        ]
      }
      veille_history: {
        Row: {
          expedition_id: string | null
          faction_id: string | null
          id: number
          is_neutral: boolean
          place_id: string
          planted_at: string
          user_id: string | null
        }
        Insert: {
          expedition_id?: string | null
          faction_id?: string | null
          id?: number
          is_neutral?: boolean
          place_id: string
          planted_at?: string
          user_id?: string | null
        }
        Update: {
          expedition_id?: string | null
          faction_id?: string | null
          id?: number
          is_neutral?: boolean
          place_id?: string
          planted_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "veille_history_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veille_history_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veille_history_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veille_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veille_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      voyage_flags: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          reason: string
          reporter_user_id: string
          resolved_at: string | null
          resolved_by: string | null
          voyage_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          reason: string
          reporter_user_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          voyage_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          reason?: string
          reporter_user_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_flags_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_flags_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_flags_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      voyage_message_reads: {
        Row: {
          last_read_at: string
          user_id: string
          voyage_id: string
        }
        Insert: {
          last_read_at?: string
          user_id: string
          voyage_id: string
        }
        Update: {
          last_read_at?: string
          user_id?: string
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_message_reads_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      voyage_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          user_id: string
          voyage_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: number
          user_id: string
          voyage_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: number
          user_id?: string
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_messages_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      voyage_participants: {
        Row: {
          joined_at: string
          request_message: string | null
          status: string
          user_id: string
          validated_at: string | null
          voyage_id: string
        }
        Insert: {
          joined_at?: string
          request_message?: string | null
          status: string
          user_id: string
          validated_at?: string | null
          voyage_id: string
        }
        Update: {
          joined_at?: string
          request_message?: string | null
          status?: string
          user_id?: string
          validated_at?: string | null
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_participants_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      voyage_report_medias: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          kind: string
          size_bytes: number | null
          storage_path: string
          user_id: string
          voyage_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
          voyage_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
          voyage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyage_report_medias_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_report_medias_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_report_medias_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_report_medias_voyage_id_user_id_fkey"
            columns: ["voyage_id", "user_id"]
            isOneToOne: false
            referencedRelation: "voyage_reports"
            referencedColumns: ["voyage_id", "user_id"]
          },
        ]
      }
      voyage_reports: {
        Row: {
          cover_media_id: string | null
          created_at: string
          is_public: boolean
          text_content: string | null
          updated_at: string
          user_id: string
          voyage_id: string
          xp_awarded: boolean
        }
        Insert: {
          cover_media_id?: string | null
          created_at?: string
          is_public?: boolean
          text_content?: string | null
          updated_at?: string
          user_id: string
          voyage_id: string
          xp_awarded?: boolean
        }
        Update: {
          cover_media_id?: string | null
          created_at?: string
          is_public?: boolean
          text_content?: string | null
          updated_at?: string
          user_id?: string
          voyage_id?: string
          xp_awarded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "voyage_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyage_reports_voyage_id_fkey"
            columns: ["voyage_id"]
            isOneToOne: false
            referencedRelation: "voyages"
            referencedColumns: ["id"]
          },
        ]
      }
      voyages: {
        Row: {
          call_author_id: string | null
          call_text: string | null
          call_updated_at: string | null
          cancelled_at: string | null
          chief_user_id: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          rdv_at: string | null
          rdv_label: string | null
          rdv_lat: number
          rdv_lng: number
          slots_max: number | null
          slots_open: boolean
          status: string
          updated_at: string
          validation_mode: string
        }
        Insert: {
          call_author_id?: string | null
          call_text?: string | null
          call_updated_at?: string | null
          cancelled_at?: string | null
          chief_user_id: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          rdv_at?: string | null
          rdv_label?: string | null
          rdv_lat: number
          rdv_lng: number
          slots_max?: number | null
          slots_open?: boolean
          status?: string
          updated_at?: string
          validation_mode: string
        }
        Update: {
          call_author_id?: string | null
          call_text?: string | null
          call_updated_at?: string | null
          cancelled_at?: string | null
          chief_user_id?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          rdv_at?: string | null
          rdv_label?: string | null
          rdv_lat?: number
          rdv_lng?: number
          slots_max?: number | null
          slots_open?: boolean
          status?: string
          updated_at?: string
          validation_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "voyages_call_author_id_fkey"
            columns: ["call_author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyages_call_author_id_fkey"
            columns: ["call_author_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyages_chief_user_id_fkey"
            columns: ["chief_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voyages_chief_user_id_fkey"
            columns: ["chief_user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      daily_enigma_status: {
        Row: {
          correct: boolean | null
          enigma_id: number | null
          response_date: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enigma_responses_enigma_id_fkey"
            columns: ["enigma_id"]
            isOneToOne: false
            referencedRelation: "enigmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enigma_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enigma_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_stats: {
        Row: {
          places_count: number | null
          users_count: number | null
        }
        Relationships: []
      }
      movement_wall_photos: {
        Row: {
          created_at: string | null
          image_id: string | null
          image_url: string | null
          message: string | null
          rating_experience: number | null
          rating_products: number | null
          shopify_product_handle: string | null
          shopify_product_title: string | null
          submitter_instagram: string | null
          submitter_name: string | null
        }
        Relationships: []
      }
      users_admin: {
        Row: {
          account_source: string | null
          active_banner_switched_at: string | null
          active_company_id: string | null
          avatar_url: string | null
          bio: string | null
          biography: string | null
          brouiller_pistes: boolean | null
          conquest_points: number | null
          conquest_reset_at: string | null
          construction_points: number | null
          construction_reset_at: string | null
          contributions_count: number | null
          created_at: string | null
          display_name: string | null
          displayed_general_title_ids: number[] | null
          displayed_title_ids_v3: number[] | null
          email_address: string | null
          energy_points: number | null
          energy_reset_at: string | null
          erudition_points: number | null
          exploration_points: number | null
          faction_change_count: number | null
          faction_change_window_start: string | null
          faction_changed_at: string | null
          faction_id: string | null
          first_name: string | null
          game_mode: string | null
          gender: string | null
          id: string | null
          instagram: string | null
          instagram_id: string | null
          is_active: boolean | null
          last_access: string | null
          last_device_os: string | null
          last_device_version: string | null
          last_login_at: string | null
          location_name: string | null
          location_zip: string | null
          max_conquest: number | null
          max_construction: number | null
          max_energy: number | null
          max_vitalite: number | null
          muted_user_ids: string[] | null
          notoriety_points: number | null
          password: string | null
          push_important_enabled: boolean | null
          push_recap_enabled: boolean | null
          rank: string | null
          role: string | null
          shopify_customer_id: number | null
          timezone: string | null
          title_gender: string | null
          tutorial_completed_at: string | null
          updated_at: string | null
          v2_access: boolean | null
          veteran_first_era: boolean | null
          veteran_welcomed_at: string | null
          vitalite_points: number | null
          vitalite_reset_at: string | null
          website_url: string | null
          xp_total: number | null
        }
        Insert: {
          account_source?: string | null
          active_banner_switched_at?: string | null
          active_company_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          biography?: string | null
          brouiller_pistes?: boolean | null
          conquest_points?: number | null
          conquest_reset_at?: string | null
          construction_points?: number | null
          construction_reset_at?: string | null
          contributions_count?: number | null
          created_at?: string | null
          display_name?: string | null
          displayed_general_title_ids?: number[] | null
          displayed_title_ids_v3?: number[] | null
          email_address?: string | null
          energy_points?: number | null
          energy_reset_at?: string | null
          erudition_points?: number | null
          exploration_points?: number | null
          faction_change_count?: number | null
          faction_change_window_start?: string | null
          faction_changed_at?: string | null
          faction_id?: string | null
          first_name?: string | null
          game_mode?: string | null
          gender?: string | null
          id?: string | null
          instagram?: string | null
          instagram_id?: string | null
          is_active?: boolean | null
          last_access?: string | null
          last_device_os?: string | null
          last_device_version?: string | null
          last_login_at?: string | null
          location_name?: string | null
          location_zip?: string | null
          max_conquest?: number | null
          max_construction?: number | null
          max_energy?: number | null
          max_vitalite?: number | null
          muted_user_ids?: string[] | null
          notoriety_points?: number | null
          password?: string | null
          push_important_enabled?: boolean | null
          push_recap_enabled?: boolean | null
          rank?: string | null
          role?: string | null
          shopify_customer_id?: number | null
          timezone?: string | null
          title_gender?: string | null
          tutorial_completed_at?: string | null
          updated_at?: string | null
          v2_access?: boolean | null
          veteran_first_era?: boolean | null
          veteran_welcomed_at?: string | null
          vitalite_points?: number | null
          vitalite_reset_at?: string | null
          website_url?: string | null
          xp_total?: number | null
        }
        Update: {
          account_source?: string | null
          active_banner_switched_at?: string | null
          active_company_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          biography?: string | null
          brouiller_pistes?: boolean | null
          conquest_points?: number | null
          conquest_reset_at?: string | null
          construction_points?: number | null
          construction_reset_at?: string | null
          contributions_count?: number | null
          created_at?: string | null
          display_name?: string | null
          displayed_general_title_ids?: number[] | null
          displayed_title_ids_v3?: number[] | null
          email_address?: string | null
          energy_points?: number | null
          energy_reset_at?: string | null
          erudition_points?: number | null
          exploration_points?: number | null
          faction_change_count?: number | null
          faction_change_window_start?: string | null
          faction_changed_at?: string | null
          faction_id?: string | null
          first_name?: string | null
          game_mode?: string | null
          gender?: string | null
          id?: string | null
          instagram?: string | null
          instagram_id?: string | null
          is_active?: boolean | null
          last_access?: string | null
          last_device_os?: string | null
          last_device_version?: string | null
          last_login_at?: string | null
          location_name?: string | null
          location_zip?: string | null
          max_conquest?: number | null
          max_construction?: number | null
          max_energy?: number | null
          max_vitalite?: number | null
          muted_user_ids?: string[] | null
          notoriety_points?: number | null
          password?: string | null
          push_important_enabled?: boolean | null
          push_recap_enabled?: boolean | null
          rank?: string | null
          role?: string | null
          shopify_customer_id?: number | null
          timezone?: string | null
          title_gender?: string | null
          tutorial_completed_at?: string | null
          updated_at?: string | null
          v2_access?: boolean | null
          veteran_first_era?: boolean | null
          veteran_welcomed_at?: string | null
          vitalite_points?: number | null
          vitalite_reset_at?: string | null
          website_url?: string | null
          xp_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "users_active_company_id_fkey"
            columns: ["active_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _announcement_slugify: { Args: { p_title: string }; Returns: string }
      _answer_enigma_internal: {
        Args: { p_answer: string; p_enigma_id: number; p_user_id: string }
        Returns: Json
      }
      _answer_fragment_enigma_internal: {
        Args: {
          p_answer: string
          p_enigma_id: number
          p_fragment_id: number
          p_user_id: string
        }
        Returns: Json
      }
      _auteur_du_chemin: { Args: { p_evenement: string }; Returns: string }
      _barem: { Args: { p_default?: number; p_key: string }; Returns: number }
      _blob_dominant_faction: {
        Args: { p_blob_place_ids: string[] }
        Returns: string
      }
      _caller_user_id: { Args: never; Returns: string }
      _can_edit_place_meta: {
        Args: { p_caller: string; p_place_id: string }
        Returns: boolean
      }
      _carte_lieu: { Args: { p_place_id: string }; Returns: Json }
      _contribute_to_place_internal: {
        Args: {
          p_content?: string
          p_era_id?: string
          p_image_url?: string
          p_place_id: string
          p_type: string
          p_user_id: string
          p_year_exact?: number
        }
        Returns: Json
      }
      _create_place_internal: {
        Args: {
          p_address?: string
          p_carnet_title?: string
          p_era_id?: string
          p_images?: Json
          p_latitude: number
          p_longitude: number
          p_tag_id: string
          p_text?: string
          p_title: string
          p_user_id: string
          p_user_lat?: number
          p_user_lng?: number
          p_year_exact?: number
        }
        Returns: Json
      }
      _crown_eligible_today: {
        Args: { p_n_total: number; p_place_id: string; p_user_id: string }
        Returns: boolean
      }
      _crown_proba_for_n: { Args: { p_n: number }; Returns: number }
      _defender_effective_score: {
        Args: { p_place_id: string }
        Returns: number
      }
      _defender_favor_only: { Args: { p_place_id: string }; Returns: number }
      _defi_completed_at: {
        Args: {
          p_action: string
          p_tag_id: string
          p_threshold: number
          p_ws: string
        }
        Returns: string
      }
      _defi_effective_ws: {
        Args: { p_cadence: string; p_counts_from: string }
        Returns: string
      }
      _defi_events: {
        Args: { p_action: string; p_tag_id: string; p_ws: string }
        Returns: {
          ts: string
          uid: string
        }[]
      }
      _defi_period_key: { Args: { p_cadence: string }; Returns: string }
      _defi_progress: {
        Args: {
          p_action: string
          p_collective: boolean
          p_tag_id: string
          p_user_id: string
          p_ws: string
        }
        Returns: number
      }
      _defi_window_start: { Args: { p_cadence: string }; Returns: string }
      _distance_m: {
        Args: { p_lat1: number; p_lat2: number; p_lng1: number; p_lng2: number }
        Returns: number
      }
      _enigma_answer_matches: {
        Args: { p_correct: string; p_user: string }
        Returns: boolean
      }
      _enigma_normalize: { Args: { p_input: string }; Returns: string }
      _enigma_score_weighted: {
        Args: { p_from?: string; p_to?: string; p_user_id: string }
        Returns: number
      }
      _faction_chef: { Args: { p_faction_id: string }; Returns: string }
      _faction_gold_coupe: {
        Args: { p_faction_id: string; p_from?: string; p_to?: string }
        Returns: number
      }
      _faction_is_locked: { Args: { p_faction_id: string }; Returns: boolean }
      _faction_member_scores: {
        Args: {
          p_faction_id: string
          p_season_from: string
          p_season_to: string
        }
        Returns: {
          coupe_score: number
          faction_rank: number
          glory: number
          user_id: string
        }[]
      }
      _grade_label: {
        Args: { p_faction_id: string; p_gender: string; p_rank: number }
        Returns: string
      }
      _has_discovered: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: boolean
      }
      _is_admin: { Args: never; Returns: boolean }
      _is_staff:
        | { Args: never; Returns: boolean }
        | { Args: { p_caller: string }; Returns: boolean }
      _is_voyage_admin: { Args: { p_user_id: string }; Returns: boolean }
      _level_from_xp: { Args: { p_xp: number }; Returns: number }
      _lieu_visible: { Args: { p_id: string }; Returns: boolean }
      _member_gold_coupe: {
        Args: {
          p_faction_id: string
          p_from?: string
          p_to?: string
          p_user_id: string
        }
        Returns: number
      }
      _member_grade_rank: {
        Args: { p_faction_id: string; p_user_id: string }
        Returns: number
      }
      _notify_court_challengers: {
        Args: {
          p_data: Json
          p_exclude_user_id?: string
          p_place_id: string
          p_type: string
          p_veilleur_exp_id: string
        }
        Returns: undefined
      }
      _notify_court_members: {
        Args: {
          p_data: Json
          p_exclude_user_id?: string
          p_expedition_id: string
          p_type: string
        }
        Returns: undefined
      }
      _pick_defi: {
        Args: { p_cadence: string; p_scope: string }
        Returns: {
          action: string
          active: boolean
          cadence: string
          counts_from: string | null
          created_at: string
          display_order: number
          icon: string
          id: string
          reward_couronnes: number
          scope: string
          tag_id: string | null
          threshold: number
          wording: string
        }
        SetofOptions: {
          from: "*"
          to: "defis"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _presents_autour: {
        Args: { p_id: string }
        Returns: {
          distance: number
          user_id: string
        }[]
      }
      _rattacher_lieu: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          departement: string
          pays: string
        }[]
      }
      _region_montree: { Args: { p_user: string }; Returns: string }
      _require_min_discoveries: {
        Args: { p_min: number; p_user_id: string }
        Returns: Json
      }
      _require_min_level: {
        Args: { p_min_level: number; p_user_id: string }
        Returns: Json
      }
      _silhouette: { Args: { p_geom: unknown }; Returns: Json }
      _top_user_for_place: { Args: { p_place_id: string }; Returns: string }
      _unlike_contribution_internal: {
        Args: { p_contribution_id: number; p_user_id: string }
        Returns: Json
      }
      _user_blob_influence: {
        Args: {
          p_blob_place_ids: string[]
          p_faction_id: string
          p_user_id: string
        }
        Returns: number
      }
      _user_coupe_score: {
        Args: { p_from?: string; p_to?: string; p_user_id: string }
        Returns: number
      }
      _user_date_local: { Args: { p_user_id: string }; Returns: string }
      _user_faction_coupe: {
        Args: {
          p_faction_id: string
          p_from?: string
          p_to?: string
          p_user_id: string
        }
        Returns: number
      }
      _user_glory_score: {
        Args: { p_from?: string; p_to?: string; p_user_id: string }
        Returns: number
      }
      _user_gold_coupe: {
        Args: { p_from?: string; p_to?: string; p_user_id: string }
        Returns: number
      }
      _user_level_state: { Args: { p_user_id: string }; Returns: Json }
      _user_place_score: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: number
      }
      _visit_place_gps_internal: {
        Args: {
          p_place_id: string
          p_user_id: string
          p_user_lat: number
          p_user_lng: number
        }
        Returns: Json
      }
      _vote_contribution_internal: {
        Args: { p_contribution_id: number; p_user_id: string; p_vote: number }
        Returns: Json
      }
      _xp_epoch: { Args: never; Returns: string }
      _xp_for_level: { Args: { p_level: number }; Returns: number }
      accueil_ajoutes: { Args: { p_limite?: number }; Returns: Json }
      accueil_nouveaute: { Args: never; Returns: Json }
      add_announcement_comment: {
        Args: {
          p_announcement_id: string
          p_content: string
          p_parent_id?: number
        }
        Returns: Json
      }
      add_place_comment: {
        Args: {
          p_content: string
          p_images?: Json
          p_parent_id?: number
          p_place_id: string
          p_user_id: string
        }
        Returns: Json
      }
      add_place_photos: {
        Args: { p_images: Json; p_place_id: string; p_user_id: string }
        Returns: Json
      }
      add_submission_image: {
        Args: {
          p_image_url: string
          p_size?: string
          p_sort_order: number
          p_storage_path: string
          p_submission_id: string
        }
        Returns: string
      }
      add_tag_to_submission: {
        Args: { p_submission_id: string; p_tag_id: string }
        Returns: undefined
      }
      admin_create_company: {
        Args: {
          p_color: string
          p_description: string
          p_image_url: string
          p_name: string
        }
        Returns: Json
      }
      admin_delete_voyage: {
        Args: { p_admin_user_id: string; p_voyage_id: string }
        Returns: Json
      }
      answer_enigma: {
        Args: { p_answer: string; p_enigma_id: number; p_user_id: string }
        Returns: Json
      }
      answer_fragment_enigma: {
        Args: {
          p_answer: string
          p_enigma_id: number
          p_fragment_id: number
          p_user_id: string
        }
        Returns: Json
      }
      archive_passed_voyages: { Args: never; Returns: Json }
      award_crowns_manual: {
        Args: { p_amount: number; p_reason: string; p_user_id: string }
        Returns: Json
      }
      basculer_envie: { Args: { p_id: string }; Returns: boolean }
      broadcast_announcement_push: { Args: { p_id: string }; Returns: Json }
      cancel_voyage: {
        Args: { p_user_id: string; p_voyage_id: string }
        Returns: Json
      }
      carte_lieux: { Args: never; Returns: Json }
      cheat_refill: { Args: { p_user_id: string }; Returns: Json }
      cheat_refill_target: {
        Args: { p_caller_id: string; p_target_name: string }
        Returns: Json
      }
      check_enigma_answer: {
        Args: { p_answer: string; p_enigma_id: number }
        Returns: Json
      }
      check_title_condition: {
        Args: { p_condition: Json; p_rank_value: number; p_stat_value: number }
        Returns: boolean
      }
      chercher_explorateurs: {
        Args: { p_debut: string; p_limite?: number }
        Returns: Json
      }
      claim_daily_quest: { Args: { p_template_id: string }; Returns: Json }
      claim_defi: { Args: { p_defi_id: string }; Returns: Json }
      cleanup_old_chat_messages: { Args: never; Returns: undefined }
      clear_submission_image_shopify_product: {
        Args: { p_image_id: string }
        Returns: undefined
      }
      compagnons_possibles: { Args: { p_id: string }; Returns: Json }
      contribute_to_place: {
        Args: {
          p_content?: string
          p_era_id?: string
          p_image_url?: string
          p_place_id: string
          p_type: string
          p_user_id: string
          p_year_exact?: number
        }
        Returns: Json
      }
      conversation: {
        Args: { p_avec: string; p_limite?: number }
        Returns: Json
      }
      correspondant: { Args: { p_avec: string }; Returns: Json }
      create_announcement: {
        Args: { p_title: string; p_type: string }
        Returns: {
          audience: string
          body: string
          channels: Json
          cover_image: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          insta_caption: string | null
          published_at: string | null
          push_text: string | null
          shopify_article_id: string | null
          slug: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_challenger_expedition: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: Json
      }
      create_company: {
        Args: {
          p_color: string
          p_description: string
          p_image_url: string
          p_name: string
          p_user_id: string
        }
        Returns: Json
      }
      create_faction: {
        Args: {
          p_color: string
          p_description: string
          p_emblem_icon?: string
          p_emblem_mono?: string
          p_image_url: string
          p_invest?: number
          p_name: string
          p_tags?: string[]
          p_user_id: string
        }
        Returns: Json
      }
      create_gps_mark: {
        Args: {
          p_accuracy?: number
          p_images?: Json
          p_lat: number
          p_lng: number
          p_title?: string
          p_user_id: string
        }
        Returns: Json
      }
      create_photo_submission: {
        Args: {
          p_consent_account?: boolean
          p_consent_brand?: boolean
          p_departement?: string
          p_location_name?: string
          p_location_zip?: string
          p_message?: string
          p_model_height_cm?: number
          p_model_shoulder_width_cm?: number
          p_product_size?: string
          p_quest_ref?: string
          p_rating_experience?: number
          p_rating_products?: number
          p_submitter_email: string
          p_submitter_instagram: string
          p_submitter_name: string
          p_submitter_role?: string
          p_team_note?: string
          p_user_id: string
        }
        Returns: string
      }
      create_photo_tag: { Args: { p_name: string }; Returns: string }
      create_place: {
        Args: {
          p_address?: string
          p_carnet_title?: string
          p_era_id?: string
          p_images?: Json
          p_latitude: number
          p_longitude: number
          p_tag_id: string
          p_text?: string
          p_title: string
          p_user_id: string
          p_user_lat?: number
          p_user_lng?: number
          p_year_exact?: number
        }
        Returns: Json
      }
      create_user_from_submission: {
        Args: {
          p_email: string
          p_first_name: string
          p_id: string
          p_instagram: string
          p_location_name?: string
          p_location_zip?: string
        }
        Returns: string
      }
      create_voyage: {
        Args: {
          p_description: string
          p_name: string
          p_rdv_at: string
          p_rdv_label: string
          p_rdv_lat: number
          p_rdv_lng: number
          p_slots_max: number
          p_slots_open: boolean
          p_user_id: string
          p_validation_mode: string
        }
        Returns: Json
      }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      decouvrir_lieu: { Args: { p_id: string }; Returns: Json }
      delete_carnet: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: Json
      }
      delete_faction: {
        Args: { p_faction_id: string; p_user_id: string }
        Returns: Json
      }
      delete_gps_mark: {
        Args: { p_draft_id: string; p_user_id: string }
        Returns: Json
      }
      delete_photo_submission: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      delete_photo_tag: { Args: { p_tag_id: string }; Returns: undefined }
      delete_place: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: Json
      }
      delete_submission_image: {
        Args: { p_image_id: string }
        Returns: undefined
      }
      delete_voyage_media: {
        Args: { p_media_id: string; p_user_id: string }
        Returns: Json
      }
      discover_place: {
        Args: {
          p_free?: boolean
          p_glory_mult?: number
          p_method?: string
          p_place_id: string
          p_user_id: string
          p_user_lat?: number
          p_user_lng?: number
        }
        Returns: Json
      }
      dismiss_veteran_welcome: { Args: never; Returns: Json }
      distance_multiplier: { Args: { distance_km: number }; Returns: number }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      ecrire_au_registre: {
        Args: { p_canal: string; p_mentions?: string[]; p_texte: string }
        Returns: Json
      }
      edit_place_description: {
        Args: { p_content: string; p_place_id: string; p_user_id: string }
        Returns: Json
      }
      eject_voyage_participant: {
        Args: {
          p_chief_user_id: string
          p_target_user_id: string
          p_voyage_id: string
        }
        Returns: Json
      }
      explorateurs_du_lieu: { Args: { p_id: string }; Returns: Json }
      fiche_lieu: { Args: { p_id: string }; Returns: Json }
      find_nearby_places: {
        Args: { p_lat: number; p_lng: number; p_radius_m?: number }
        Returns: {
          distance_m: number
          has_veilleur: boolean
          place_id: string
          title: string
        }[]
      }
      flag_voyage: {
        Args: {
          p_comment?: string
          p_reason: string
          p_user_id: string
          p_voyage_id: string
        }
        Returns: Json
      }
      get_active_community_quest: { Args: { p_user_id: string }; Returns: Json }
      get_all_fragments: { Args: { p_user_id: string }; Returns: Json }
      get_all_player_titles: { Args: { p_user_id: string }; Returns: Json }
      get_announcement_by_slug: {
        Args: { p_slug: string }
        Returns: {
          audience: string
          body: string
          channels: Json
          cover_image: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          insta_caption: string | null
          published_at: string | null
          push_text: string | null
          shopify_article_id: string | null
          slug: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_announcement_comment_likers: {
        Args: { p_comment_id: number }
        Returns: Json
      }
      get_announcement_likers: {
        Args: { p_announcement_id: string }
        Returns: Json
      }
      get_announcement_social: {
        Args: { p_announcement_id: string; p_user_id?: string }
        Returns: Json
      }
      get_community_photos_by_product: {
        Args: { p_handle: string }
        Returns: {
          created_at: string
          image_sort_order: number
          image_url: string
          location_name: string
          location_zip: string
          message: string
          rating_experience: number
          rating_products: number
          submission_id: string
          submitter_instagram: string
          submitter_name: string
        }[]
      }
      get_company: { Args: { p_company_id: string }; Returns: Json }
      get_company_messages: {
        Args: { p_company_id: string; p_limit?: number }
        Returns: Json
      }
      get_contribution_likers: {
        Args: { p_contribution_id: number }
        Returns: Json
      }
      get_coupe_state: {
        Args: { p_season_id?: number; p_user_id: string }
        Returns: Json
      }
      get_court_invested_per_place: { Args: never; Returns: Json }
      get_daily_enigma: { Args: { p_user_id: string }; Returns: Json }
      get_defi_participants: {
        Args: { p_defi_id: string; p_limit?: number }
        Returns: Json
      }
      get_defis_board: { Args: { p_user_id: string }; Returns: Json }
      get_demo_enigmas: { Args: { p_count?: number }; Returns: Json }
      get_faction_detail: { Args: { p_faction_id: string }; Returns: Json }
      get_faction_members: { Args: { p_faction_id: string }; Returns: Json }
      get_faction_tag_reduction: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: number
      }
      get_factions_for_choice: {
        Args: never
        Returns: {
          bonus_energy: number
          bonus_regen_energy: number
          color: string
          description: string
          id: string
          image_url: string
          member_count: number
          pattern: string
          title: string
        }[]
      }
      get_fragment_audio_stats: {
        Args: never
        Returns: {
          completions: number
          derniere_ecoute: string
          ecoutes: number
          ecoutes_motif: number
          ecoutes_produit: number
          illustration_handle: string
          mesurables: number
          progression: number
          taux: number
        }[]
      }
      get_fragment_enigma: {
        Args: { p_fragment_id: number; p_user_id: string }
        Returns: Json
      }
      get_fragment_unlocks_by_tag: {
        Args: { p_tag: string }
        Returns: {
          titre: string
        }[]
      }
      get_glory_rules: { Args: never; Returns: Json }
      get_landing_activity: {
        Args: { limit_count?: number }
        Returns: {
          discovered_at: string
          place_title: string
        }[]
      }
      get_landing_stats: {
        Args: never
        Returns: {
          total_places: number
          total_users: number
        }[]
      }
      get_leaderboard: {
        Args: { p_limit?: number; p_type: string }
        Returns: Json
      }
      get_map_places: {
        Args: {
          p_latitude?: number
          p_latitude_delta?: number
          p_limit?: number
          p_longitude?: number
          p_longitude_delta?: number
          p_type?: string
          p_user_id?: string
        }
        Returns: Json
      }
      get_map_veilles: { Args: never; Returns: Json }
      get_member_grade_label: { Args: { p_user_id: string }; Returns: string }
      get_mission_participants: {
        Args: { p_limit?: number; p_slug: string }
        Returns: Json
      }
      get_mission_state: { Args: { p_slug: string }; Returns: Json }
      get_mission_submissions: { Args: { p_slug: string }; Returns: Json }
      get_muted_user_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      get_my_companies: { Args: { p_user_id: string }; Returns: Json }
      get_my_crowns_state: { Args: { p_user_id: string }; Returns: Json }
      get_my_factions: { Args: { p_user_id: string }; Returns: Json }
      get_my_fragment_status: { Args: { p_user_id: string }; Returns: Json }
      get_my_glory: { Args: { p_user_id: string }; Returns: Json }
      get_my_informations: { Args: { p_user_id: string }; Returns: Json }
      get_my_mission_submission_status: {
        Args: { p_slug: string }
        Returns: string
      }
      get_my_preferences: { Args: never; Returns: Json }
      get_my_recent_activity: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: Json
      }
      get_my_user_row: { Args: never; Returns: Json }
      get_nearby_places: {
        Args: { p_lat: number; p_limit?: number; p_lng: number }
        Returns: {
          author_id: string
          author_name: string
          created_at: string
          distance_km: number
          id: string
          image_url: string
          latitude: number
          longitude: number
          slug: string
          tag_color: string
          tag_icon: string
          title: string
        }[]
      }
      get_nearby_planters: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: Json
      }
      get_photo_submissions: {
        Args: { p_status?: string }
        Returns: {
          consent_account_creation: boolean
          consent_brand_usage: boolean
          created_at: string | null
          departement: string | null
          id: string
          location_name: string | null
          location_zip: string | null
          message: string | null
          model_height_cm: number | null
          model_shoulder_width_cm: number | null
          moderated_at: string | null
          moderated_by: string | null
          product_size: string | null
          product_worn: string | null
          quest_ref: string | null
          rating_experience: number | null
          rating_products: number | null
          reward_crowns: number | null
          rewarded_at: string | null
          status: string | null
          submitter_email: string
          submitter_instagram: string | null
          submitter_name: string
          submitter_role: string | null
          team_note: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "hub_photo_submissions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_photo_tags: {
        Args: never
        Returns: {
          created_at: string | null
          id: string
          name: string
        }[]
        SetofOptions: {
          from: "*"
          to: "hub_photo_tags"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_place_by_id: {
        Args: { p_id: string; p_user_id?: string }
        Returns: Json
      }
      get_place_court_state: {
        Args: { p_place_id: string; p_user_id?: string }
        Returns: Json
      }
      get_place_description_history: {
        Args: { p_place_id: string }
        Returns: Json
      }
      get_place_detail_v05: {
        Args: { p_place_id: string; p_user_id?: string }
        Returns: Json
      }
      get_place_guardian: { Args: { p_place_id: string }; Returns: string }
      get_place_veille: { Args: { p_place_id: string }; Returns: Json }
      get_player_profile: { Args: { p_user_id: string }; Returns: Json }
      get_profil_explorateur: { Args: { p_user_id: string }; Returns: Json }
      get_random_ad: { Args: never; Returns: Json }
      get_random_home_banner: { Args: never; Returns: Json }
      get_recent_activity: { Args: { p_limit?: number }; Returns: Json }
      get_recent_fragments: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          collection: string
          icon: string
          icon_url: string
          id: number
          image_url: string
          link_url: string
          name: string
          owned: boolean
        }[]
      }
      get_recent_places: {
        Args: { p_limit?: number }
        Returns: {
          author_id: string
          author_name: string
          created_at: string
          id: string
          image_url: string
          latitude: number
          longitude: number
          slug: string
          tag_color: string
          tag_icon: string
          title: string
        }[]
      }
      get_studio_config: { Args: never; Returns: Json }
      get_submission_images_batch: {
        Args: { p_submission_ids: string[] }
        Returns: {
          created_at: string | null
          id: string
          image_url: string
          product_worn: string | null
          shopify_media_id: string | null
          shopify_product_handle: string | null
          shopify_product_id: string | null
          shopify_product_title: string | null
          show_in_community: boolean
          show_on_wall: boolean
          size: string | null
          sort_order: number | null
          status: string
          storage_path: string
          submission_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "hub_submission_images"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_submission_tags_batch: {
        Args: { p_submission_ids: string[] }
        Returns: {
          submission_id: string
          tag_id: string
          tag_name: string
        }[]
      }
      get_territory_votes: {
        Args: {
          p_anchor_place_id: string
          p_blob_place_ids: string[]
          p_user_id: string
        }
        Returns: Json
      }
      get_today_quests_state: { Args: { p_user_id: string }; Returns: Json }
      get_ugc_reward_config: { Args: never; Returns: Json }
      get_underdog_faction_id: { Args: never; Returns: string }
      get_user_avatar: { Args: { p_user_id: string }; Returns: string }
      get_user_discoveries: { Args: { p_user_id: string }; Returns: Json }
      get_user_energy: { Args: { p_user_id: string }; Returns: Json }
      get_user_fragments: { Args: { p_user_id: string }; Returns: Json }
      get_user_quests_today: {
        Args: never
        Returns: {
          completed: boolean
          count: number
          display_order: number
          icon: string
          reward_couronnes: number
          reward_xp: number
          template_id: string
          threshold: number
          wording: string
        }[]
      }
      get_user_titles: { Args: { p_user_id: string }; Returns: Json }
      get_voyage: {
        Args: { p_user_id: string; p_voyage_id: string }
        Returns: Json
      }
      get_winning_territory_names: {
        Args: never
        Returns: {
          anchor_place_id: string
          winning_name: string
        }[]
      }
      harvest_crown: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: Json
      }
      has_v2_access: { Args: never; Returns: boolean }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      herald_grade_promotions: { Args: never; Returns: undefined }
      increment_community_quest: {
        Args: {
          p_amount?: number
          p_place_type: string
          p_tracker_kind: string
          p_user_id: string
        }
        Returns: undefined
      }
      increment_quest_progress: {
        Args: { p_amount?: number; p_tracker_kind: string; p_user_id: string }
        Returns: {
          completed_template_id: string
          reward_xp: number
        }[]
      }
      invest_crowns: {
        Args: {
          p_amount: number
          p_beneficiary_user_id?: string
          p_place_id: string
          p_target_expedition_id: string
          p_user_id: string
        }
        Returns: Json
      }
      is_allowed_emoji: { Args: { p_emoji: string }; Returns: boolean }
      join_challenger_expedition: {
        Args: { p_expedition_id: string; p_user_id: string }
        Returns: Json
      }
      join_company: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: Json
      }
      join_faction: {
        Args: { p_faction_id: string; p_user_id: string }
        Returns: Json
      }
      join_mission: { Args: { p_mission_slug: string }; Returns: Json }
      leave_company: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: Json
      }
      leave_faction: {
        Args: { p_faction_id: string; p_user_id: string }
        Returns: Json
      }
      lire_murmures: { Args: { p_avec: string }; Returns: number }
      list_announcements_admin: {
        Args: never
        Returns: {
          audience: string
          body: string
          channels: Json
          cover_image: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          insta_caption: string | null
          published_at: string | null
          push_text: string | null
          shopify_article_id: string | null
          slug: string
          status: string
          title: string
          type: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_companies: { Args: { p_search?: string }; Returns: Json }
      list_factions: { Args: { p_search?: string }; Returns: Json }
      list_my_voyages: { Args: { p_user_id: string }; Returns: Json }
      list_places_in_siege: {
        Args: never
        Returns: {
          challenger_count: number
          defender_effective_score: number
          is_at_risk: boolean
          max_challenger_score: number
          place_id: string
        }[]
      }
      list_published_announcements: {
        Args: { p_limit?: number }
        Returns: {
          cover_image: string
          id: string
          published_at: string
          slug: string
          title: string
          type: string
        }[]
      }
      list_voyages_archives: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      list_voyages_for_map: { Args: never; Returns: Json }
      list_voyages_upcoming: { Args: never; Returns: Json }
      log_fragment_audio_play: {
        Args: {
          p_completed: boolean
          p_duration_seconds?: number
          p_illustration_handle: string
          p_listened_seconds: number
          p_session_id: string
          p_source: string
        }
        Returns: undefined
      }
      mark_mission_messages_read: {
        Args: { p_mission_slug: string }
        Returns: Json
      }
      mark_notifications_read: { Args: { p_user_id: string }; Returns: Json }
      mark_tutorial_complete: { Args: { p_user_id: string }; Returns: Json }
      mark_voyage_messages_read: {
        Args: { p_user_id: string; p_voyage_id: string }
        Returns: Json
      }
      mes_murmures: { Args: never; Returns: Json }
      mes_noms_d_expedition: { Args: never; Returns: string[] }
      migrate_user_to_auth_id: {
        Args: { p_new_id: string; p_old_id: string }
        Returns: Json
      }
      mod_get_place: { Args: { p_place_id: string }; Returns: Json }
      mod_list_places: {
        Args: {
          p_filter?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_tag_id?: string
        }
        Returns: Json
      }
      mod_set_masked: {
        Args: { p_masked: boolean; p_place_id: string }
        Returns: Json
      }
      mod_set_place_tags: {
        Args: { p_place_id: string; p_tag_ids: string[] }
        Returns: Json
      }
      mod_set_verified: {
        Args: { p_place_id: string; p_verified: boolean }
        Returns: Json
      }
      mod_update_place: {
        Args: {
          p_place_id: string
          p_sensible: boolean
          p_text: string
          p_title: string
        }
        Returns: Json
      }
      moderate_submission: {
        Args: { p_crowns?: number; p_status: string; p_submission_id: string }
        Returns: undefined
      }
      mon_entree: { Args: never; Returns: Json }
      murmurer: { Args: { p_a: string; p_texte: string }; Returns: Json }
      mute_user: { Args: { p_target_user_id: string }; Returns: Json }
      nommer_explorateur: { Args: { p_nom: string }; Returns: string }
      notify: {
        Args: { p_data: Json; p_recipient: string; p_type: string }
        Returns: undefined
      }
      notify_exploration: {
        Args: {
          p_place_id: string
          p_recipient: string
          p_visitor_name: string
        }
        Returns: undefined
      }
      plant_flag: {
        Args: {
          p_expedition_name?: string
          p_partners_user_ids?: string[]
          p_place_id: string
          p_user_id: string
          p_user_lat: number
          p_user_lng: number
        }
        Returns: Json
      }
      preview_action_cost: {
        Args: {
          p_action: string
          p_place_id: string
          p_user_id: string
          p_user_lat?: number
          p_user_lng?: number
        }
        Returns: Json
      }
      propose_territory_name: {
        Args: {
          p_anchor_place_id: string
          p_blob_place_ids?: string[]
          p_name: string
          p_user_id: string
        }
        Returns: Json
      }
      publish_announcement: {
        Args: { p_id: string }
        Returns: {
          audience: string
          body: string
          channels: Json
          cover_image: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          insta_caption: string | null
          published_at: string | null
          push_text: string | null
          shopify_article_id: string | null
          slug: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_gps_mark: {
        Args: {
          p_address?: string
          p_draft_id: string
          p_era_id?: string
          p_images?: Json
          p_latitude: number
          p_longitude: number
          p_merge_into_place_id?: string
          p_secondary_tag_ids?: string[]
          p_tag_id: string
          p_text?: string
          p_title: string
          p_user_id: string
          p_year_exact?: number
        }
        Returns: Json
      }
      randomize_position_on_land: {
        Args: { p_lat: number; p_lng: number }
        Returns: Json
      }
      rate_place: {
        Args: { p_place_id: string; p_rating: number; p_user_id: string }
        Returns: Json
      }
      recalc_place_content_points: {
        Args: { p_place_id: string }
        Returns: undefined
      }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: Json
      }
      register_voyage_media: {
        Args: {
          p_duration_seconds: number
          p_kind: string
          p_size_bytes: number
          p_storage_path: string
          p_user_id: string
          p_voyage_id: string
        }
        Returns: Json
      }
      registre: {
        Args: { p_canaux?: string[]; p_limite?: number }
        Returns: Json
      }
      remove_company_member: {
        Args: {
          p_company_id: string
          p_target_user_id: string
          p_user_id: string
        }
        Returns: Json
      }
      remove_faction_member: {
        Args: {
          p_faction_id: string
          p_target_user_id: string
          p_user_id: string
        }
        Returns: Json
      }
      remove_tag_from_submission: {
        Args: { p_submission_id: string; p_tag_id: string }
        Returns: undefined
      }
      rename_expedition: {
        Args: { p_expedition_id: string; p_name: string; p_user_id: string }
        Returns: Json
      }
      rename_faction: {
        Args: { p_new_id: string; p_old_id: string }
        Returns: Json
      }
      rename_place: {
        Args: { p_place_id: string; p_title: string; p_user_id: string }
        Returns: Json
      }
      request_join_voyage: {
        Args: { p_message?: string; p_user_id: string; p_voyage_id: string }
        Returns: Json
      }
      respond_voyage_join_request: {
        Args: {
          p_chief_user_id: string
          p_decision: string
          p_target_user_id: string
          p_voyage_id: string
        }
        Returns: Json
      }
      restore_place_description_revision: {
        Args: { p_place_id: string; p_revision_id: number; p_user_id: string }
        Returns: Json
      }
      revendiquer_lieu: {
        Args: { p_compagnons: string[]; p_id: string; p_nom: string }
        Returns: Json
      }
      revisit_place_gps: {
        Args: {
          p_place_id: string
          p_user_id: string
          p_user_lat: number
          p_user_lng: number
        }
        Returns: Json
      }
      saluer: { Args: { p_evenement: string }; Returns: Json }
      send_company_message: {
        Args: { p_company_id: string; p_content: string; p_user_id: string }
        Returns: Json
      }
      send_mission_message: {
        Args: { p_content: string; p_mission_slug: string }
        Returns: Json
      }
      send_voyage_message: {
        Args: { p_content: string; p_user_id: string; p_voyage_id: string }
        Returns: Json
      }
      set_active_banner: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: Json
      }
      set_active_faction: {
        Args: { p_faction_id: string; p_user_id: string }
        Returns: Json
      }
      set_announcement_channel: {
        Args: {
          p_channel: string
          p_id: string
          p_shopify_article_id?: string
          p_state: string
        }
        Returns: {
          audience: string
          body: string
          channels: Json
          cover_image: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          insta_caption: string | null
          published_at: string | null
          push_text: string | null
          shopify_article_id: string | null
          slug: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_brouiller_pistes: { Args: { p_enabled: boolean }; Returns: Json }
      set_displayed_titles_v3: {
        Args: { p_title_ids: number[]; p_user_id: string }
        Returns: Json
      }
      set_faction_grade_labels: {
        Args: { p_faction_id: string; p_labels: Json }
        Returns: Json
      }
      set_faction_grades: {
        Args: { p_faction_id: string; p_govern_grades: number; p_grades: Json }
        Returns: Json
      }
      set_my_displayed_titles: {
        Args: { p_title_ids: number[] }
        Returns: undefined
      }
      set_my_preference: {
        Args: { p_cle: string; p_valeur: boolean }
        Returns: undefined
      }
      set_my_signe: { Args: { p_fragment_id: number }; Returns: undefined }
      set_place_tags: {
        Args: { p_place_id: string; p_tag_ids: string[] }
        Returns: Json
      }
      set_primary_faction: {
        Args: { p_faction_id: string; p_user_id: string }
        Returns: Json
      }
      set_submission_image_community: {
        Args: { p_image_id: string; p_show: boolean }
        Returns: undefined
      }
      set_submission_image_media: {
        Args: { p_image_id: string; p_media_id: string }
        Returns: undefined
      }
      set_submission_image_product: {
        Args: { p_image_id: string; p_product: string }
        Returns: undefined
      }
      set_submission_image_shopify_product: {
        Args: {
          p_handle: string
          p_image_id: string
          p_product_id: string
          p_title: string
        }
        Returns: undefined
      }
      set_submission_image_status: {
        Args: { p_image_id: string; p_status: string }
        Returns: undefined
      }
      set_submission_image_wall: {
        Args: { p_image_id: string; p_show: boolean }
        Returns: undefined
      }
      set_title_gender: { Args: { p_gender: string }; Returns: Json }
      set_user_faction: {
        Args: { p_faction_id: string; p_user_id: string }
        Returns: Json
      }
      set_v2_access: {
        Args: { p_enabled: boolean; p_user_id: string }
        Returns: undefined
      }
      set_voyage_cover_image: {
        Args: { p_storage_path: string; p_user_id: string; p_voyage_id: string }
        Returns: Json
      }
      signaler_presence: {
        Args: { p_lat: number; p_lng: number }
        Returns: undefined
      }
      signer_charte: { Args: never; Returns: undefined }
      soundex: { Args: { "": string }; Returns: string }
      sur_les_chemins: { Args: { p_limite?: number }; Returns: Json }
      territoire_en: { Args: { p_lat: number; p_lng: number }; Returns: Json }
      territory_radius_km: { Args: { p_score: number }; Returns: number }
      text_soundex: { Args: { "": string }; Returns: string }
      toggle_announcement_comment_like: {
        Args: { p_comment_id: number }
        Returns: Json
      }
      toggle_announcement_like: {
        Args: { p_announcement_id: string }
        Returns: Json
      }
      toggle_contribution_like: {
        Args: { p_contribution_id: number; p_user_id: string }
        Returns: Json
      }
      toggle_place_description_like: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: Json
      }
      toggle_wishlist: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: Json
      }
      touch_last_login: { Args: { p_user_id: string }; Returns: Json }
      unaccent: { Args: { "": string }; Returns: string }
      unaccent_fallback: { Args: { p: string }; Returns: string }
      unlike_contribution: {
        Args: { p_contribution_id: number; p_user_id: string }
        Returns: Json
      }
      unlock_pending_fragments: {
        Args: { p_email: string; p_user_id: string }
        Returns: number
      }
      unmute_user: { Args: { p_target_user_id: string }; Returns: Json }
      unregister_push_subscription: {
        Args: { p_endpoint: string }
        Returns: Json
      }
      update_announcement: {
        Args: {
          p_body: string
          p_cover_image: string
          p_cta_label: string
          p_cta_url: string
          p_id: string
          p_insta_caption: string
          p_push_text: string
          p_title: string
          p_type: string
        }
        Returns: {
          audience: string
          body: string
          channels: Json
          cover_image: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          insta_caption: string | null
          published_at: string | null
          push_text: string | null
          shopify_article_id: string | null
          slug: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_company_identity: {
        Args: {
          p_color: string
          p_company_id: string
          p_description: string
          p_image_url: string
          p_name: string
          p_user_id: string
        }
        Returns: Json
      }
      update_faction_identity: {
        Args: {
          p_color: string
          p_description: string
          p_emblem_icon?: string
          p_emblem_mono?: string
          p_faction_id: string
          p_image_url: string
          p_name: string
          p_tags?: string[]
          p_user_id: string
        }
        Returns: Json
      }
      update_my_profile: {
        Args: {
          p_avatar_url?: string
          p_bio?: string
          p_first_name?: string
          p_game_mode?: string
          p_instagram?: string
          p_user_id: string
        }
        Returns: Json
      }
      update_place_position: {
        Args: {
          p_address: string
          p_latitude: number
          p_longitude: number
          p_place_id: string
          p_user_id: string
        }
        Returns: Json
      }
      update_submission_message: {
        Args: { p_message: string; p_submission_id: string }
        Returns: undefined
      }
      update_submission_product_worn: {
        Args: { p_product_worn: string; p_submission_id: string }
        Returns: undefined
      }
      update_user_timezone: { Args: { p_timezone: string }; Returns: Json }
      update_voyage: {
        Args: {
          p_description: string
          p_name: string
          p_rdv_at: string
          p_rdv_label: string
          p_rdv_lat: number
          p_rdv_lng: number
          p_slots_max: number
          p_slots_open: boolean
          p_user_id: string
          p_voyage_id: string
        }
        Returns: Json
      }
      update_voyage_call: {
        Args: { p_call_text: string; p_user_id: string; p_voyage_id: string }
        Returns: Json
      }
      update_voyage_name: {
        Args: { p_name: string; p_user_id: string; p_voyage_id: string }
        Returns: Json
      }
      upsert_voyage_report: {
        Args: {
          p_cover_media_id: string
          p_is_public: boolean
          p_text_content: string
          p_user_id: string
          p_voyage_id: string
        }
        Returns: Json
      }
      user_public_name: {
        Args: {
          p_display_name: string
          p_first_name: string
          p_user_id: string
        }
        Returns: string
      }
      validate_emoji_throw: { Args: { p_emoji: string }; Returns: Json }
      visit_place_gps: {
        Args: {
          p_place_id: string
          p_user_id: string
          p_user_lat: number
          p_user_lng: number
        }
        Returns: Json
      }
      visiter_lieu: {
        Args: { p_id: string; p_lat: number; p_lng: number }
        Returns: Json
      }
      vote_contribution: {
        Args: { p_contribution_id: number; p_user_id: string; p_vote: number }
        Returns: Json
      }
      vote_territory_name: {
        Args: {
          p_anchor_place_id: string
          p_blob_place_ids: string[]
          p_proposal_id: string
          p_user_id: string
          p_value: number
        }
        Returns: Json
      }
      withdraw_from_voyage: {
        Args: { p_user_id: string; p_voyage_id: string }
        Returns: Json
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
