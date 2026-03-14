import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const url = (import.meta as any).env.VITE_SUPABASE_URL || (process as any).env.VITE_SUPABASE_URL;
  const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || (process as any).env.VITE_SUPABASE_ANON_KEY;
  return { url, key };
};

let client: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop, receiver) {
    const knownProps = ['auth', 'from', 'rpc', 'storage', 'functions'];
    if (knownProps.includes(prop as string)) {
      if (!client) {
        const { url, key } = getSupabaseConfig();
        if (!url || !key || !url.startsWith('http')) {
          console.warn('Supabase configuration missing or invalid.');
          return null;
        }
        client = createClient(url, key);
      }
      const value = (client as any)[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    }
    
    if (client) {
      const value = (client as any)[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    }

    // Fallback for when client is not initialized
    return () => {
      throw new Error(
        'Supabase configuration missing or invalid. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.'
      );
    };
  }
});
