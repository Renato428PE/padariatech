import { createClient } from '@supabase/supabase-js';

// As variáveis com prefixo VITE_ são expostas pelo Vite em import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERRO CRÍTICO: Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY não foram definidas.');
}

// Criação do cliente oficial do Supabase utilizando apenas a chave pública (publishable / anon)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
