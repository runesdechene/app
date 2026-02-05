export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      image_media: {
        Row: {
          id: string
          url: string
          alt?: string
          created_at: string
        }
        Insert: {
          id?: string
          url: string
          alt?: string
          created_at?: string
        }
        Update: {
          id?: string
          url?: string
          alt?: string
          created_at?: string
        }
      }
      member_codes: {
        Row: {
          id: string
          code: string
          used: boolean
          user_id?: string
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          used?: boolean
          user_id?: string
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          used?: boolean
          user_id?: string
          created_at?: string
        }
      }
      place_types: {
        Row: {
          id: string
          name: string
          icon?: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          icon?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          icon?: string
          created_at?: string
        }
      }
      places: {
        Row: {
          id: string
          name: string
          description?: string
          latitude: number
          longitude: number
          address?: string
          place_type_id?: string
          image_url?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          latitude: number
          longitude: number
          address?: string
          place_type_id?: string
          image_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          latitude?: number
          longitude?: number
          address?: string
          place_type_id?: string
          image_url?: string
          created_at?: string
          updated_at?: string
        }
      }
      places_bookmarked: {
        Row: {
          id: string
          user_id: string
          place_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          place_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          place_id?: string
          created_at?: string
        }
      }
      places_explored: {
        Row: {
          id: string
          user_id: string
          place_id: string
          explored_at: string
        }
        Insert: {
          id?: string
          user_id: string
          place_id: string
          explored_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          place_id?: string
          explored_at?: string
        }
      }
      places_liked: {
        Row: {
          id: string
          user_id: string
          place_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          place_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          place_id?: string
          created_at?: string
        }
      }
      places_viewed: {
        Row: {
          id: string
          user_id: string
          place_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          place_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          place_id?: string
          viewed_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          user_id: string
          place_id: string
          rating: number
          comment?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          place_id: string
          rating: number
          comment?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          place_id?: string
          rating?: number
          comment?: string
          created_at?: string
          updated_at?: string
        }
      }
      reviews_images: {
        Row: {
          id: string
          review_id: string
          image_url: string
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          image_url: string
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          image_url?: string
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          username?: string
          avatar_url?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          username?: string
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
      }
      password_resets: {
        Row: {
          id: string
          user_id: string
          token: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          expires_at?: string
          created_at?: string
        }
      }
      refresh_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          expires_at?: string
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      get_public_tables: {
        Args: Record<string, never>
        Returns: { tablename: string }[]
      }
    }
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row']

export type InsertDto<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert']

export type UpdateDto<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update']

export type Place = Tables<'places'>
export type User = Tables<'users'>
export type Review = Tables<'reviews'>
export type PlaceType = Tables<'place_types'>
