import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) console.error('VITE_SUPABASE_URL not set');
if (!supabaseAnonKey) console.error('VITE_SUPABASE_ANON_KEY not set');

// We use sessionStorage (not localStorage) as our session store.
// - sessionStorage is tab-scoped: opening a new tab = new session = must log in again ✓
// - sessionStorage survives page reloads in the SAME tab ✓
// - This means Stripe's redirect (same-tab reload) keeps the session ✓
// - Another user opening the URL in their own tab gets no session ✓
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: {
      // Use sessionStorage instead of localStorage
      getItem: (key: string) => sessionStorage.getItem(key),
      setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
      removeItem: (key: string) => sessionStorage.removeItem(key),
    },
  },
});

