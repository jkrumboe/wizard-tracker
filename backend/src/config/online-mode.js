import supabase from './supabase-client.js';

const CONFIG_TABLE = 'config';
const DEFAULT_STATUS = {
  online: false,
  lastUpdated: new Date().toISOString(),
  reason: 'Offline by default'
};

export async function getOnlineStatus() {
  try {
    const { data, error } = await supabase
      .from(CONFIG_TABLE)
      .select('value, updated_at, reason')
      .eq('key', 'online')
      .single();

    if (error || !data) {
      return DEFAULT_STATUS;
    }

    return {
      online: Boolean(data.value),
      lastUpdated: data.updated_at || new Date().toISOString(),
      reason: data.reason || ''
    };
  } catch (err) {
    console.error('Failed to fetch online status from Supabase:', err);
    return DEFAULT_STATUS;
  }
}

export async function setOnlineStatus(online, reason = 'Manual update') {
  try {
    const { data, error } = await supabase
      .from(CONFIG_TABLE)
      .upsert({ key: 'online', value: online, reason }, { onConflict: 'key', returning: 'representation' })
      .single();

    if (error) throw error;

    return {
      online: Boolean(data.value),
      lastUpdated: data.updated_at,
      reason: data.reason
    };
  } catch (err) {
    console.error('Failed to update online status in Supabase:', err);
    throw err;
  }
}

export async function isOnline() {
  const status = await getOnlineStatus();
  return status.online;
}
