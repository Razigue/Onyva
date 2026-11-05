
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "invite_attempts": {
                  Row: {
                    "attempts": number,"user_id": string,"window_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts": number,"user_id": string,"window_at": string
                  }
                  Update: {
                    "attempts"?: number,"user_id"?: string,"window_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"osm_venues": {
                  Row: {
                    "cuisines": NonNullable<Json>,"id": string,"import_id": string,"imported_at": string,"kind": string,"latitude": number,"longitude": number,"name": string,"open_intervals": NonNullable<Json>,"opening_hours": string | null,"position": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "cuisines"?: NonNullable<Json>,"id": string,"import_id": string,"imported_at"?: string,"kind": string,"latitude": number,"longitude": number,"name": string,"open_intervals"?: NonNullable<Json>,"opening_hours"?: string | null,"position"?: never
                  }
                  Update: {
                    "cuisines"?: NonNullable<Json>,"id"?: string,"import_id"?: string,"imported_at"?: string,"kind"?: string,"latitude"?: number,"longitude"?: number,"name"?: string,"open_intervals"?: NonNullable<Json>,"opening_hours"?: string | null,"position"?: never
                  }
                  Relationships: [
                    
                  ]
                },"outing_push_subscriptions": {
                  Row: {
                    "attempts": number,"available_at": string,"id": string,"outing_id": string,"state": string,"ticket_at": string | null,"ticket_id": string | null,"token": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"available_at"?: string,"id"?: string,"outing_id": string,"state"?: string,"ticket_at"?: string | null,"ticket_id"?: string | null,"token": string,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"available_at"?: string,"id"?: string,"outing_id"?: string,"state"?: string,"ticket_at"?: string | null,"ticket_id"?: string | null,"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outing_push_subscriptions_outing_id_outings_id_fk"
      columns: ["outing_id"]
isOneToOne: false
      referencedRelation: "outings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outing_push_subscriptions_outing_id_user_id_participants_outing"
      columns: ["outing_id","user_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["outing_id","user_id"]
    }
                  ]
                },"outings": {
                  Row: {
                    "activity": string,"confirmed_venue_id": string | null,"ends_at": string,"id": string,"invite_code": string,"owner_id": string,"recommendations": Json | null,"selected_venue": Json | null,"short_code": string,"starts_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity": string,"confirmed_venue_id"?: string | null,"ends_at": string,"id"?: string,"invite_code"?: string,"owner_id": string,"recommendations"?: Json | null,"selected_venue"?: Json | null,"short_code"?: string,"starts_at": string,"updated_at"?: string
                  }
                  Update: {
                    "activity"?: string,"confirmed_venue_id"?: string | null,"ends_at"?: string,"id"?: string,"invite_code"?: string,"owner_id"?: string,"recommendations"?: Json | null,"selected_venue"?: Json | null,"short_code"?: string,"starts_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"participants": {
                  Row: {
                    "departure_id": string,"id": string,"joined_at": string,"name": string,"outing_id": string,"return_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "departure_id": string,"id"?: string,"joined_at"?: string,"name": string,"outing_id": string,"return_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "departure_id"?: string,"id"?: string,"joined_at"?: string,"name"?: string,"outing_id"?: string,"return_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "participants_departure_id_stations_id_fk"
      columns: ["departure_id"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "participants_outing_id_outings_id_fk"
      columns: ["outing_id"]
isOneToOne: false
      referencedRelation: "outings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "participants_return_id_stations_id_fk"
      columns: ["return_id"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["id"]
    }
                  ]
                },"prim_cache": {
                  Row: {
                    "cache_key": string,"expires_at": string,"outing_id": string,"payload": Json | null,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cache_key": string,"expires_at": string,"outing_id": string,"payload"?: Json | null,"state": string
                  }
                  Update: {
                    "cache_key"?: string,"expires_at"?: string,"outing_id"?: string,"payload"?: Json | null,"state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prim_cache_outing_id_fkey"
      columns: ["outing_id"]
isOneToOne: false
      referencedRelation: "outings"
      referencedColumns: ["id"]
    }
                  ]
                },"prim_calculations": {
                  Row: {
                    "claim_id": string,"expires_at": string,"outing_id": string,"revision": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claim_id": string,"expires_at": string,"outing_id": string,"revision": string
                  }
                  Update: {
                    "claim_id"?: string,"expires_at"?: string,"outing_id"?: string,"revision"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prim_calculations_outing_id_fkey"
      columns: ["outing_id"]
isOneToOne: true
      referencedRelation: "outings"
      referencedColumns: ["id"]
    }
                  ]
                },"prim_usage": {
                  Row: {
                    "api": string,"calls": number,"usage_day": string
                  }
                  ComputedFields: never
                  Insert: {
                    "api": string,"calls"?: number,"usage_day": string
                  }
                  Update: {
                    "api"?: string,"calls"?: number,"usage_day"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stations": {
                  Row: {
                    "active": boolean,"id": string,"latitude": number,"lines": NonNullable<Json>,"longitude": number,"name": string,"position": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"id": string,"latitude": number,"lines": NonNullable<Json>,"longitude": number,"name": string,"position"?: never
                  }
                  Update: {
                    "active"?: boolean,"id"?: string,"latitude"?: number,"lines"?: NonNullable<Json>,"longitude"?: number,"name"?: string,"position"?: never
                  }
                  Relationships: [
                    
                  ]
                },"venue_imports": {
                  Row: {
                    "current_import": string | null,"imported_at": string | null,"singleton": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "current_import"?: string | null,"imported_at"?: string | null,"singleton"?: boolean
                  }
                  Update: {
                    "current_import"?: string | null,"imported_at"?: string | null,"singleton"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"venue_reactions": {
                  Row: {
                    "outing_id": string,"user_id": string,"venue_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "outing_id": string,"user_id": string,"venue_id": string
                  }
                  Update: {
                    "outing_id"?: string,"user_id"?: string,"venue_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "venue_reactions_outing_id_outings_id_fk"
      columns: ["outing_id"]
isOneToOne: false
      referencedRelation: "outings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venue_reactions_outing_id_user_id_participants_outing_id_user_i"
      columns: ["outing_id","user_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["outing_id","user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "activate_venue_import":
{ Args: { "batch_id": string,"expected_count": number }; Returns: undefined
                           },
"add_participant":
{ Args: { "departure_id": string,"outing_id": string,"person_name": string,"return_id": string }; Returns: Json
                           },
"claim_prim_cache":
{ Args: { "key": string,"target": string }; Returns: Json
                           },
"claim_prim_calculation":
{ Args: { "expected_revision": string,"target": string,"token": string }; Returns: boolean
                           },
"claim_push_jobs":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"configure_notification_schedule":
{ Args: { "endpoint": string,"secret": string }; Returns: undefined
                           },
"confirm_venue":
{ Args: { "outing_id": string,"venue_id": string }; Returns: Json
                           },
"create_outing":
{ Args: { "payload": Json }; Returns: Json
                           },
"dispatch_notification_tick":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"get_outing":
{ Args: { "outing_id": string }; Returns: Json
                           },
"get_recommendations":
{ Args: { "outing_id": string }; Returns: Json
                           },
"get_venue_reactions":
{ Args: { "outing_id": string }; Returns: Json
                           },
"is_member":
{ Args: { "target": string }; Returns: boolean
                           },
"join_outing":
{ Args: { "payload": Json }; Returns: Json
                           },
"list_outing_venues":
{ Args: { "station_id": string,"target": string }; Returns: Json
                           },
"nearby_venues":
{ Args: { "activity_kind": string,"ends_at_epoch": number,"starts_at_epoch": number,"station_ids": (string)[] }; Returns: Json
                           },
"new_short_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"preview_invitation":
{ Args: { "invite_code": string }; Returns: Json
                           },
"register_outing_push":
{ Args: { "outing_id": string,"push_token": string }; Returns: undefined
                           },
"remove_participant":
{ Args: { "outing_id": string,"participant_id": string }; Returns: Json
                           },
"reserve_prim_call":
{ Args: { "api_name": string,"daily_limit": number }; Returns: boolean
                           },
"resolve_invite_code":
{ Args: { "short_code": string }; Returns: string
                           },
"save_prim_progress":
{ Args: { "expected_revision": string,"result": Json,"target": string,"token": string }; Returns: boolean
                           },
"select_outing_venue":
{ Args: { "station_id": string,"target": string,"venue_id": string }; Returns: Json
                           },
"set_venue_reaction":
{ Args: { "liked": boolean,"outing_id": string,"venue_id": string }; Returns: Json
                           },
"unregister_push_token":
{ Args: { "push_token": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
