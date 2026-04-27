export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          avatar_url?: string | null
        }
        Relationships: []
      }
      exhibitions: {
        Row: {
          id: string
          organizer_id: string
          title: string
          description: string | null
          slug: string
          cover_image_path: string | null
          status: 'draft' | 'active' | 'closed'
          starts_at: string | null
          ends_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organizer_id: string
          title: string
          description?: string | null
          slug: string
          cover_image_path?: string | null
          status?: 'draft' | 'active' | 'closed'
          starts_at?: string | null
          ends_at?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          slug?: string
          cover_image_path?: string | null
          status?: 'draft' | 'active' | 'closed'
          starts_at?: string | null
          ends_at?: string | null
        }
        Relationships: []
      }
      uploads: {
        Row: {
          id: string
          exhibition_id: string
          uploader_id: string | null
          guest_name: string | null
          type: 'photo' | 'text'
          storage_path: string | null
          text_content: string | null
          caption: string | null
          created_at: string
        }
        Insert: {
          id?: string
          exhibition_id: string
          uploader_id?: string | null
          guest_name?: string | null
          type: 'photo' | 'text'
          storage_path?: string | null
          text_content?: string | null
          caption?: string | null
          created_at?: string
        }
        Update: {
          caption?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Exhibition = Database['public']['Tables']['exhibitions']['Row']
export type Upload = Database['public']['Tables']['uploads']['Row']
