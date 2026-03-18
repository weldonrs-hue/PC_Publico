import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Ensure URL is a valid HTTP/HTTPS string
  const isValidUrl = (u: string | undefined) => u && (u.startsWith('http://') || u.startsWith('https://'));
  
  const isConfigured = isValidUrl(url) && !!key;
  
  const finalUrl = isConfigured ? url! : 'https://placeholder.supabase.co';
  const finalKey = key || 'placeholder-key';
  const finalServiceKey = serviceKey || finalKey;

  return { url: finalUrl, key: finalServiceKey, isConfigured };
};

const config = getSupabaseConfig();
export const supabase = createClient(config.url, config.key);
export const isSupabaseConfigured = config.isConfigured;
