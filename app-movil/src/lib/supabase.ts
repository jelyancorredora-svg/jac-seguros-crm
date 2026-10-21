import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { almacenSeguro } from './secureStore';

export const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: almacenSeguro,
    storageKey: 'sesion',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: { headers: { 'x-client-info': 'jac-seguros-app/1.0' } },
});
