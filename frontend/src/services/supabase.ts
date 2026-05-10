import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment');
}

// Supabase manages session storage, token refresh, and expiry automatically.
// No manual localStorage or token handling needed.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,   // refreshes access token before it expires
    persistSession: true,   // stores session in localStorage under its own keys
    detectSessionInUrl: true,   // handles magic link / OAuth redirects
  },
});
