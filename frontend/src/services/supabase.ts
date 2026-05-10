import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) console.error('VITE_SUPABASE_URL not set');
if (!supabaseAnonKey) console.error('VITE_SUPABASE_ANON_KEY not set');

console.log('[Supabase] connecting to:', supabaseUrl.substring(0, 35) || 'NOT SET');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
