import { supabase } from './supabase';

export async function loadUserTokens(walletAddress) {
  try {
    const { data, error } = await supabase
      .from('meme_tokens')
      .select('id, token_name, currency_code, receiver_address, image_url')
      .eq('receiver_address', walletAddress)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error loading tokens:', error);
    return [];
  }
}

export async function loadAllTokens() {
  try {
    const { data, error } = await supabase
      .from('meme_tokens')
      .select('id, token_name, currency_code, receiver_address, image_url')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error loading tokens:', error);
    return [];
  }
}

export function formatTokenOption(token) {
  return {
    value: `${token.currency_code}|${token.receiver_address}`,
    label: `${token.token_name} (${token.currency_code})`,
    currency_code: token.currency_code,
    issuer_address: token.receiver_address,
    image_url: token.image_url,
    token_name: token.token_name
  };
}
