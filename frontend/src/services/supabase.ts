import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) console.error('VITE_SUPABASE_URL not set');
if (!supabaseAnonKey) console.error('VITE_SUPABASE_ANON_KEY not set');

// NO persistSession — every tab/page refresh requires a fresh login.
// This is intentional: prevents an admin session leaking to another user
// who opens the same URL in a different tab or device.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
