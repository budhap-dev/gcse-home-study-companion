import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Sign-in is on only when both keys are configured; otherwise the app runs device-only. */
export const AUTH_ENABLED = Boolean(url && key)

export const supabase: SupabaseClient | null = AUTH_ENABLED ? createClient(url!, key!) : null
