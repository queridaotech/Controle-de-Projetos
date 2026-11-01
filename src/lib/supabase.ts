import { createClient } from '@supabase/supabase-js'

// Somente a chave pública (anon/publishable). Nunca use a Service Role Key no frontend.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = supabaseConfigured ? createClient(url!, anonKey!) : null
