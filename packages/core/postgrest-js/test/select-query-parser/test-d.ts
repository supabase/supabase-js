import { PostgrestClient } from '../../src/index'
import { expectType } from 'tsd'
import { TypeEqual } from 'ts-expect'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
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
  pgbouncer: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_auth: {
        Args: {
          p_usename: string
        }
        Returns: {
          username: string
          password: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      drop_item: {
        Row: {
          drop_item_data_id: number | null
          id: number
          item_id: number
          item_name: string
          rate: number | null
          stack: number
        }
        Insert: {
          drop_item_data_id?: number | null
          id?: number
          item_id: number
          item_name?: string
          rate?: number | null
          stack?: number
        }
        Update: {
          drop_item_data_id?: number | null
          id?: number
          item_id?: number
          item_name?: string
          rate?: number | null
          stack?: number
        }
        Relationships: [
          {
            foreignKeyName: 'drop_item_drop_item_data_id_fkey'
            columns: ['drop_item_data_id']
            referencedRelation: 'drop_item_data'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'drop_item_item_id_fkey'
            columns: ['item_id']
            referencedRelation: 'item'
            referencedColumns: ['id']
          }
        ]
      }
      drop_item_data: {
        Row: {
          avg_gold: number | null
          blue_rate: number | null
          drop_gold_rate: number | null
          green_rate: number | null
          id: number
          level: number | null
          monster_id: number
          name: string
          not_drop_rate: number | null
          orange_rate: number | null
          rand_gold: number | null
          rand_times: number
          unknown_string: string | null
          unknown1: number | null
          yellow_rate: number | null
        }
        Insert: {
          avg_gold?: number | null
          blue_rate?: number | null
          drop_gold_rate?: number | null
          green_rate?: number | null
          id?: number
          level?: number | null
          monster_id: number
          name: string
          not_drop_rate?: number | null
          orange_rate?: number | null
          rand_gold?: number | null
          rand_times?: number
          unknown_string?: string | null
          unknown1?: number | null
          yellow_rate?: number | null
        }
        Update: {
          avg_gold?: number | null
          blue_rate?: number | null
          drop_gold_rate?: number | null
          green_rate?: number | null
          id?: number
          level?: number | null
          monster_id?: number
          name?: string
          not_drop_rate?: number | null
          orange_rate?: number | null
          rand_gold?: number | null
          rand_times?: number
          unknown_string?: string | null
          unknown1?: number | null
          yellow_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'drop_item_data_monster_id_fkey'
            columns: ['monster_id']
            referencedRelation: 'monster'
            referencedColumns: ['id']
          }
        ]
      }
      item: {
        Row: {
          agi: number | null
          attack: number | null
          attack_range: number | null
          attack_speed: number | null
          attribute: number | null
          attribute_damage: number | null
          attribute_rate: number | null
          attribute_resist: number | null
          auction_type: number | null
          avg_physical_damage: number | null
          backpack_size: number | null
          block_rate: number | null
          casting_time: number | null
          cooldown_group: number | null
          cooldown_time: number | null
          dodge_rate: number | null
          drop_index: number | null
          drop_rate: number | null
          due_date_time: number | null
          elf_skill_id: number | null
          enchant_duration: number | null
          enchant_id: number | null
          enchant_time_type: number | null
          enchant_type: number | null
          enhance_effect_id: number | null
          equip_type: number | null
          expert_enchant_id: number | null
          expert_level: number | null
          extra_data1: number | null
          extra_data2: number | null
          extra_data3: number | null
          fly_effect_id: number | null
          hit_rate: number | null
          icon_filename: string | null
          id: number
          int: number | null
          item_group: string | null
          item_quality: string | null
          item_type: number | null
          limit_type: number | null
          log_level: number | null
          magic_critical_damage: number | null
          magic_critical_rate: number | null
          magic_damage: number | null
          magic_defence: number | null
          magic_penetration: number | null
          magic_penetration_defence: number | null
          max_durability: number | null
          max_hp: number | null
          max_mp: number | null
          max_socket: number | null
          max_stack: number | null
          model_filename: string | null
          model_id: string | null
          name: string | null
          name_translation_id: string
          op_flags: number | null
          op_flags_plus: number | null
          physical_critical_damage: number | null
          physical_critical_rate: number | null
          physical_defence: number | null
          physical_penetration: number | null
          physical_penetration_defence: number | null
          rand_physical_damage: number | null
          range_attack: number | null
          rebirth_count: number | null
          rebirth_max_score: number | null
          rebirth_score: number | null
          restrict_align: number | null
          restrict_class: string | null
          restrict_event_pos_id: string | null
          restrict_gender: number | null
          restrict_level: number
          restrict_max_level: number | null
          restrict_prestige: number | null
          shop_price_type: number | null
          socket_rate: number | null
          special_damage: number | null
          special_rate: number | null
          special_type: number | null
          str: number | null
          sys_price: number | null
          target: number | null
          tip: string | null
          tip_translation_id: string
          treasure_buffs1: number | null
          treasure_buffs2: number | null
          treasure_buffs3: number | null
          treasure_buffs4: number | null
          unknown_string: string | null
          used_effect_id: number | null
          used_sound_name: string | null
          vit: number | null
          weapon_effect_id: number | null
          will: number | null
        }
        Insert: {
          agi?: number | null
          attack?: number | null
          attack_range?: number | null
          attack_speed?: number | null
          attribute?: number | null
          attribute_damage?: number | null
          attribute_rate?: number | null
          attribute_resist?: number | null
          auction_type?: number | null
          avg_physical_damage?: number | null
          backpack_size?: number | null
          block_rate?: number | null
          casting_time?: number | null
          cooldown_group?: number | null
          cooldown_time?: number | null
          dodge_rate?: number | null
          drop_index?: number | null
          drop_rate?: number | null
          due_date_time?: number | null
          elf_skill_id?: number | null
          enchant_duration?: number | null
          enchant_id?: number | null
          enchant_time_type?: number | null
          enchant_type?: number | null
          enhance_effect_id?: number | null
          equip_type?: number | null
          expert_enchant_id?: number | null
          expert_level?: number | null
          extra_data1?: number | null
          extra_data2?: number | null
          extra_data3?: number | null
          fly_effect_id?: number | null
          hit_rate?: number | null
          icon_filename?: string | null
          id: number
          int?: number | null
          item_group?: string | null
          item_quality?: string | null
          item_type?: number | null
          limit_type?: number | null
          log_level?: number | null
          magic_critical_damage?: number | null
          magic_critical_rate?: number | null
          magic_damage?: number | null
          magic_defence?: number | null
          magic_penetration?: number | null
          magic_penetration_defence?: number | null
          max_durability?: number | null
          max_hp?: number | null
          max_mp?: number | null
          max_socket?: number | null
          max_stack?: number | null
          model_filename?: string | null
          model_id?: string | null
          name?: string | null
          name_translation_id: string
          op_flags?: number | null
          op_flags_plus?: number | null
          physical_critical_damage?: number | null
          physical_critical_rate?: number | null
          physical_defence?: number | null
          physical_penetration?: number | null
          physical_penetration_defence?: number | null
          rand_physical_damage?: number | null
          range_attack?: number | null
          rebirth_count?: number | null
          rebirth_max_score?: number | null
          rebirth_score?: number | null
          restrict_align?: number | null
          restrict_class?: string | null
          restrict_event_pos_id?: string | null
          restrict_gender?: number | null
          restrict_level?: number
          restrict_max_level?: number | null
          restrict_prestige?: number | null
          shop_price_type?: number | null
          socket_rate?: number | null
          special_damage?: number | null
          special_rate?: number | null
          special_type?: number | null
          str?: number | null
          sys_price?: number | null
          target?: number | null
          tip?: string | null
          tip_translation_id: string
          treasure_buffs1?: number | null
          treasure_buffs2?: number | null
          treasure_buffs3?: number | null
          treasure_buffs4?: number | null
          unknown_string?: string | null
          used_effect_id?: number | null
          used_sound_name?: string | null
          vit?: number | null
          weapon_effect_id?: number | null
          will?: number | null
        }
        Update: {
          agi?: number | null
          attack?: number | null
          attack_range?: number | null
          attack_speed?: number | null
          attribute?: number | null
          attribute_damage?: number | null
          attribute_rate?: number | null
          attribute_resist?: number | null
          auction_type?: number | null
          avg_physical_damage?: number | null
          backpack_size?: number | null
          block_rate?: number | null
          casting_time?: number | null
          cooldown_group?: number | null
          cooldown_time?: number | null
          dodge_rate?: number | null
          drop_index?: number | null
          drop_rate?: number | null
          due_date_time?: number | null
          elf_skill_id?: number | null
          enchant_duration?: number | null
          enchant_id?: number | null
          enchant_time_type?: number | null
          enchant_type?: number | null
          enhance_effect_id?: number | null
          equip_type?: number | null
          expert_enchant_id?: number | null
          expert_level?: number | null
          extra_data1?: number | null
          extra_data2?: number | null
          extra_data3?: number | null
          fly_effect_id?: number | null
          hit_rate?: number | null
          icon_filename?: string | null
          id?: number
          int?: number | null
          item_group?: string | null
          item_quality?: string | null
          item_type?: number | null
          limit_type?: number | null
          log_level?: number | null
          magic_critical_damage?: number | null
          magic_critical_rate?: number | null
          magic_damage?: number | null
          magic_defence?: number | null
          magic_penetration?: number | null
          magic_penetration_defence?: number | null
          max_durability?: number | null
          max_hp?: number | null
          max_mp?: number | null
          max_socket?: number | null
          max_stack?: number | null
          model_filename?: string | null
          model_id?: string | null
          name?: string | null
          name_translation_id?: string
          op_flags?: number | null
          op_flags_plus?: number | null
          physical_critical_damage?: number | null
          physical_critical_rate?: number | null
          physical_defence?: number | null
          physical_penetration?: number | null
          physical_penetration_defence?: number | null
          rand_physical_damage?: number | null
          range_attack?: number | null
          rebirth_count?: number | null
          rebirth_max_score?: number | null
          rebirth_score?: number | null
          restrict_align?: number | null
          restrict_class?: string | null
          restrict_event_pos_id?: string | null
          restrict_gender?: number | null
          restrict_level?: number
          restrict_max_level?: number | null
          restrict_prestige?: number | null
          shop_price_type?: number | null
          socket_rate?: number | null
          special_damage?: number | null
          special_rate?: number | null
          special_type?: number | null
          str?: number | null
          sys_price?: number | null
          target?: number | null
          tip?: string | null
          tip_translation_id?: string
          treasure_buffs1?: number | null
          treasure_buffs2?: number | null
          treasure_buffs3?: number | null
          treasure_buffs4?: number | null
          unknown_string?: string | null
          used_effect_id?: number | null
          used_sound_name?: string | null
          vit?: number | null
          weapon_effect_id?: number | null
          will?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'item_name_translation_id_fkey'
            columns: ['name_translation_id']
            referencedRelation: 'translation'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'item_tip_translation_id_fkey'
            columns: ['tip_translation_id']
            referencedRelation: 'translation'
            referencedColumns: ['id']
          }
        ]
      }
      monster: {
        Row: {
          achievement_map: string | null
          ai_id: number | null
          attack: number | null
          attack_range: number | null
          attack_speed: number | null
          attribute: number | null
          attribute_damage: number | null
          attribute_rate: number | null
          attribute_resist: number | null
          auto_spell_during: boolean | null
          auto_spell_id: number | null
          avg_physical_damage: number | null
          battle_spells: string | null
          casting_effect_id: number | null
          detect_range: number | null
          dodge_rate: number | null
          exp: number | null
          fear_type: number | null
          hit_rate: number | null
          id: number
          idle_spell_id: number | null
          innate_buffs: string | null
          level: number
          locate_limit: number | null
          lower_limit: number | null
          magic_critical_damage: number | null
          magic_critical_rate: number | null
          magic_damage: number | null
          magic_defence: number | null
          magical_penetration: number | null
          magical_penetration_defence: number | null
          max_call_help: number | null
          max_hp: number | null
          max_mp: number | null
          model_ids: string | null
          model_scales: number | null
          monster_alignment: number | null
          move_range: number | null
          name: string | null
          name_translation_id: string
          part_breaking_action: number | null
          part_hp: number | null
          physical_critical_damage: number | null
          physical_critical_rate: number | null
          physical_defence: number | null
          physical_penetration: number | null
          physical_penetration_defence: number | null
          pursuit_speed: number | null
          rand_buff_num: number | null
          rand_physical_damage: number | null
          random_buffs: string | null
          rank: number | null
          restore_spell_id: number | null
          roam_speed: number | null
          shout: string | null
          shout_for_man: string | null
          shout_for_woman: string | null
          special_flag: number | null
          spell_shout_cmds: string | null
          summon_effect_id: number | null
          summon_max: number | null
          summon_monster_id: number | null
          summon_rate: number | null
          summon_type: number | null
          type: number | null
          zone_icon: string | null
        }
        Insert: {
          achievement_map?: string | null
          ai_id?: number | null
          attack?: number | null
          attack_range?: number | null
          attack_speed?: number | null
          attribute?: number | null
          attribute_damage?: number | null
          attribute_rate?: number | null
          attribute_resist?: number | null
          auto_spell_during?: boolean | null
          auto_spell_id?: number | null
          avg_physical_damage?: number | null
          battle_spells?: string | null
          casting_effect_id?: number | null
          detect_range?: number | null
          dodge_rate?: number | null
          exp?: number | null
          fear_type?: number | null
          hit_rate?: number | null
          id?: number
          idle_spell_id?: number | null
          innate_buffs?: string | null
          level?: number
          locate_limit?: number | null
          lower_limit?: number | null
          magic_critical_damage?: number | null
          magic_critical_rate?: number | null
          magic_damage?: number | null
          magic_defence?: number | null
          magical_penetration?: number | null
          magical_penetration_defence?: number | null
          max_call_help?: number | null
          max_hp?: number | null
          max_mp?: number | null
          model_ids?: string | null
          model_scales?: number | null
          monster_alignment?: number | null
          move_range?: number | null
          name?: string | null
          name_translation_id: string
          part_breaking_action?: number | null
          part_hp?: number | null
          physical_critical_damage?: number | null
          physical_critical_rate?: number | null
          physical_defence?: number | null
          physical_penetration?: number | null
          physical_penetration_defence?: number | null
          pursuit_speed?: number | null
          rand_buff_num?: number | null
          rand_physical_damage?: number | null
          random_buffs?: string | null
          rank?: number | null
          restore_spell_id?: number | null
          roam_speed?: number | null
          shout?: string | null
          shout_for_man?: string | null
          shout_for_woman?: string | null
          special_flag?: number | null
          spell_shout_cmds?: string | null
          summon_effect_id?: number | null
          summon_max?: number | null
          summon_monster_id?: number | null
          summon_rate?: number | null
          summon_type?: number | null
          type?: number | null
          zone_icon?: string | null
        }
        Update: {
          achievement_map?: string | null
          ai_id?: number | null
          attack?: number | null
          attack_range?: number | null
          attack_speed?: number | null
          attribute?: number | null
          attribute_damage?: number | null
          attribute_rate?: number | null
          attribute_resist?: number | null
          auto_spell_during?: boolean | null
          auto_spell_id?: number | null
          avg_physical_damage?: number | null
          battle_spells?: string | null
          casting_effect_id?: number | null
          detect_range?: number | null
          dodge_rate?: number | null
          exp?: number | null
          fear_type?: number | null
          hit_rate?: number | null
          id?: number
          idle_spell_id?: number | null
          innate_buffs?: string | null
          level?: number
          locate_limit?: number | null
          lower_limit?: number | null
          magic_critical_damage?: number | null
          magic_critical_rate?: number | null
          magic_damage?: number | null
          magic_defence?: number | null
          magical_penetration?: number | null
          magical_penetration_defence?: number | null
          max_call_help?: number | null
          max_hp?: number | null
          max_mp?: number | null
          model_ids?: string | null
          model_scales?: number | null
          monster_alignment?: number | null
          move_range?: number | null
          name?: string | null
          name_translation_id?: string
          part_breaking_action?: number | null
          part_hp?: number | null
          physical_critical_damage?: number | null
          physical_critical_rate?: number | null
          physical_defence?: number | null
          physical_penetration?: number | null
          physical_penetration_defence?: number | null
          pursuit_speed?: number | null
          rand_buff_num?: number | null
          rand_physical_damage?: number | null
          random_buffs?: string | null
          rank?: number | null
          restore_spell_id?: number | null
          roam_speed?: number | null
          shout?: string | null
          shout_for_man?: string | null
          shout_for_woman?: string | null
          special_flag?: number | null
          spell_shout_cmds?: string | null
          summon_effect_id?: number | null
          summon_max?: number | null
          summon_monster_id?: number | null
          summon_rate?: number | null
          summon_type?: number | null
          type?: number | null
          zone_icon?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'monster_name_translation_id_fkey'
            columns: ['name_translation_id']
            referencedRelation: 'translation'
            referencedColumns: ['id']
          }
        ]
      }
      translation: {
        Row: {
          en: string
          es: string
          fr: string
          id: string
          pt: string
        }
        Insert: {
          en?: string
          es?: string
          fr?: string
          id: string
          pt?: string
        }
        Update: {
          en?: string
          es?: string
          fr?: string
          id?: string
          pt?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_bitwise_and_hex: {
        Args: {
          restrict_class_hex: string
          bitmask: number
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'objects_bucketId_fkey'
            columns: ['bucket_id']
            referencedRelation: 'buckets'
            referencedColumns: ['id']
          }
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_bucket_id_fkey'
            columns: ['bucket_id']
            referencedRelation: 'buckets'
            referencedColumns: ['id']
          }
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_parts_bucket_id_fkey'
            columns: ['bucket_id']
            referencedRelation: 'buckets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 's3_multipart_uploads_parts_upload_id_fkey'
            columns: ['upload_id']
            referencedRelation: 's3_multipart_uploads'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_object: {
        Args: {
          bucketid: string
          name: string
          owner: string
          metadata: Json
        }
        Returns: undefined
      }
      extension: {
        Args: {
          name: string
        }
        Returns: string
      }
      filename: {
        Args: {
          name: string
        }
        Returns: string
      }
      foldername: {
        Args: {
          name: string
        }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          size: number
          bucket_id: string
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
        }
        Returns: {
          key: string
          id: string
          created_at: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          start_after?: string
          next_token?: string
        }
        Returns: {
          name: string
          id: string
          metadata: Json
          updated_at: string
        }[]
      }
      search: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
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

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
  ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
  ? PublicSchema['Enums'][PublicEnumNameOrOptions]
  : never

const REST_URL = 'http://localhost:3000'
export const postgrest = new PostgrestClient<Database>(REST_URL)

// nested query with selective fields
{
  const { data } = await postgrest
    .from('item')
    .select(
      `drops:drop_item(...drop_item_data(rand_times, monster!inner(id, level, name:translation(*))))`
    )
    .limit(1)
    .single()
  let result: Exclude<typeof data, null>
  let expected: {
    name: {
      en: string
      es: string
      fr: string
      id: string
      pt: string
    }
    id: number
    level: number
  } | null
  type drops = (typeof result.drops)[0]
  type monster = drops['monster']
  expectType<TypeEqual<monster, typeof expected>>(true)
}
