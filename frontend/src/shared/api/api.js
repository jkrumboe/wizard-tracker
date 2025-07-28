import supabase from '@/shared/utils/supabase';
import { addOnlineChecksToAPI } from '@/shared/utils/onlineCheck';

async function handle(request) {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data;
}

// Authentication related API using Supabase auth
export const authAPI = {
  login: ({ email, password }) => handle(supabase.auth.signInWithPassword({ email, password })),
  register: ({ email, password, name }) => handle(
    supabase.auth.signUp({ email, password, options: { data: { name } } })
  ),
  logout: () => handle(supabase.auth.signOut()),
  refresh: () => handle(supabase.auth.getSession()),
  me: () => handle(supabase.auth.getUser()),
  profile: () => handle(supabase.auth.getUser())
};

export const adminAPI = {
  login: ({ email, password }) => handle(supabase.auth.signInWithPassword({ email, password })),
  logout: () => handle(supabase.auth.signOut()),
  setupAdmin: async () => {},
  getPlayers: () => handle(supabase.from('players').select('*')),
  addPlayer: (data) => handle(supabase.from('players').insert(data).select().single()),
  getGames: () => handle(supabase.from('games').select('*'))
};

const baseGameAPI = {
  getAll: () => handle(supabase.from('games').select('*')),
  getById: (id) => handle(supabase.from('games').select('*').eq('id', id).single()),
  getRecent: (limit = 5) => handle(
    supabase.from('games').select('*').order('created_at', { ascending: false }).limit(limit)
  ),
  getMultiplayer: (limit = 10, offset = 0) => handle(
    supabase.from('games').select('*').eq('game_mode', 'multiplayer').range(offset, offset + limit - 1)
  ),
  create: (data) => handle(supabase.from('games').insert(data).select().single()),
  update: (id, data) => handle(supabase.from('games').update(data).eq('id', id).select().single())
};

const basePlayerAPI = {
  getAll: () => handle(supabase.from('players').select('*')),
  getById: (id) => handle(supabase.from('players').select('*').eq('id', id).single()),
  getStats: (id) => handle(supabase.rpc('get_player_stats', { pid: id })),
  getGames: (id, limit = 20) => handle(
    supabase.from('game_participants').select('*, games(*)').eq('player_id', id).limit(limit)
  ),
  getTags: (id) => handle(
    supabase.from('player_tags').select('tags(*)').eq('player_id', id)
  ),
  getByTag: (tag) => handle(
    supabase.from('players').select('*').contains('tags', [tag])
  ),
  create: (data) => handle(supabase.from('players').insert(data).select().single()),
  update: (id, data) => handle(supabase.from('players').update(data).eq('id', id).select().single()),
  updateTags: (id, tags) => handle(
    supabase.from('player_tags').upsert(tags.map(t => ({ player_id: id, tag_id: t })))
  ),
  delete: (id) => handle(supabase.from('players').delete().eq('id', id))
};

const baseRoomAPI = {
  getActive: () => handle(supabase.from('game_rooms').select('*').eq('status', 'active')),
  getById: (id) => handle(supabase.from('game_rooms').select('*').eq('id', id).single()),
  create: (data) => handle(supabase.from('game_rooms').insert(data).select().single()),
  join: (roomId) => handle(supabase.rpc('join_room', { room_id: roomId })),
  leave: (roomId) => handle(supabase.rpc('leave_room', { room_id: roomId })),
  verifyPassword: (roomId, password) => handle(
    supabase.rpc('verify_room_password', { room_id: roomId, password })
  )
};

const offlineGameAPIs = ['getLocalGames', 'getLocalGameById', 'saveLocalGame', 'removeLocalGame'];
const offlinePlayerAPIs = ['getLocalPlayers', 'getLocalPlayerById'];
const offlineRoomAPIs = [];

export const gameAPI = addOnlineChecksToAPI(baseGameAPI, offlineGameAPIs);
export const playerAPI = addOnlineChecksToAPI(basePlayerAPI, offlinePlayerAPIs);
export const roomAPI = addOnlineChecksToAPI(baseRoomAPI, offlineRoomAPIs);

const baseTagsAPI = {
  getAll: () => handle(supabase.from('tags').select('*')),
  getById: (id) => handle(supabase.from('tags').select('*').eq('id', id).single()),
  create: (data) => handle(supabase.from('tags').insert(data).select().single()),
  update: (id, data) => handle(supabase.from('tags').update(data).eq('id', id).select().single()),
  delete: (id) => handle(supabase.from('tags').delete().eq('id', id))
};

export const tagsAPI = addOnlineChecksToAPI(baseTagsAPI, []);

const baseLeaderboardAPI = {
  get: (category = 'overall') => handle(supabase.rpc('get_leaderboard', { category })),
  getEloRanking: () => handle(supabase.rpc('get_leaderboard', { category: 'elo' })),
  getWinRateRanking: () => handle(supabase.rpc('get_leaderboard', { category: 'winrate' })),
  getByCategory: (category) => handle(supabase.rpc('get_leaderboard', { category }))
};

export const leaderboardAPI = addOnlineChecksToAPI(baseLeaderboardAPI, []);

export const statsAPI = {
  getOverall: () => handle(supabase.rpc('get_overall_stats'))
};

export const gameStatApi = gameAPI;
export { playerAPI as default };