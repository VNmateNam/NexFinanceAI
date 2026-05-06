import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

// Service role client — bypasses RLS for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Verify Supabase connection
supabase.from('price_cache').select('count').single().then(() => {
  console.log('✅ Supabase connected');
}).catch((err: Error) => {
  console.error('❌ Supabase connection failed:', err.message);
});
