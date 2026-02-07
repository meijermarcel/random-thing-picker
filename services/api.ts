// API service for RTP backend
// For local development:
// - iOS Simulator: use 'http://localhost:8000'
// - Android Emulator: use 'http://10.0.2.2:8000'
// - Physical device: use your machine's IP (e.g., 'http://192.168.1.x:8000')
const LOCAL_API = 'http://localhost:8000';
const PROD_API = 'https://rtp-api.onrender.com';

// Toggle this for local development
const USE_LOCAL_API = true;

const API_BASE = process.env.EXPO_PUBLIC_API_URL || (USE_LOCAL_API ? LOCAL_API : PROD_API);

export interface APIGame {
  id: string;
  espn_id: string;
  sport: string;
  home_team_id: string | null;
  away_team_id: string | null;
  scheduled_at: string;
  status: string;
  home_score_actual: number | null;
  away_score_actual: number | null;
  espn_data: {
    league: string;
    home_record: string | null;
    away_record: string | null;
    odds: {
      spread: number | null;
      over_under: number | null;
      home_moneyline: number | null;
      away_moneyline: number | null;
    } | null;
  } | null;
}

export interface APITeam {
  id: string;
  espn_id: string;
  name: string;
  abbreviation: string;
  sport: string;
  logo_url: string | null;
}

export interface APIPick {
  id: string;
  game_id: string;
  predicted_winner_id: string | null;
  home_score_predicted: number;
  away_score_predicted: number;
  confidence: 'low' | 'medium' | 'high';
  confidence_score: number;
  analysis_factors: {
    pick_type: string;
    reasoning: string[];
    home_score: number;
    away_score: number;
    differential?: number;
    projection?: {
      home_points: number;
      away_points: number;
      total_points: number;
      projected_winner: 'home' | 'away';
      projected_margin: number;
      confidence: 'low' | 'medium' | 'high';
    };
    spread_pick?: 'home' | 'away';
    spread_confidence?: 'low' | 'medium' | 'high';
  };
  algorithm_version: string;
  was_correct: boolean | null;
  score_diff_error: number | null;
}

export interface APIGameWithPick {
  game: APIGame;
  pick: APIPick | null;
  home_team: APITeam | null;
  away_team: APITeam | null;
}

export interface APIParlay {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  picks: APIGameWithPick[];
  icon: string;
}

export interface APISport {
  key: string;
  name: string;
  sport: string;
  league: string;
}

// Response cache + request deduplication
// Caches responses by URL so multiple tabs share the same data.
// In-flight requests are deduplicated (same URL = same promise).
const responseCache = new Map<string, { data: any; timestamp: number }>();
const inflightRequests = new Map<string, Promise<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  if (entry) responseCache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  responseCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.includes(prefix)) responseCache.delete(key);
  }
}

function formatDate(date: Date): string {
  // Use local timezone instead of UTC to avoid date shifting
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTimezone(): string {
  // Get the device's IANA timezone name (e.g., 'America/New_York')
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export async function fetchGames(date: Date, sport?: string, forceRefresh = false): Promise<APIGameWithPick[]> {
  // Always fetch ALL games for the date (no sport filter) so the cache is shared.
  // Sport filtering happens client-side from the full cached result.
  const dateStr = formatDate(date);
  const cacheKey = `picks:${dateStr}`;

  if (!forceRefresh) {
    const cached = getCached<APIGameWithPick[]>(cacheKey);
    if (cached) {
      console.log(`[API] fetchGames: cache hit (${cached.length} games)`);
      return sport ? cached.filter(g => g.game.sport === sport) : cached;
    }
  }

  // Deduplicate in-flight requests
  if (!forceRefresh && inflightRequests.has(cacheKey)) {
    console.log(`[API] fetchGames: deduplicating request`);
    const allGames = await inflightRequests.get(cacheKey)!;
    return sport ? allGames.filter((g: APIGameWithPick) => g.game.sport === sport) : allGames;
  }

  const params = new URLSearchParams({ date: dateStr, tz: getTimezone() });
  const url = `${API_BASE}/picks?${params}`;
  console.log(`[API] fetchGames: ${url}`);
  const start = Date.now();

  const request = (async () => {
    const response = await fetch(url);
    console.log(`[API] fetchGames response: ${response.status} in ${Date.now() - start}ms`);
    if (!response.ok) throw new Error(`Failed to fetch games: ${response.status}`);
    const data = await response.json();
    console.log(`[API] fetchGames parsed: ${data.length} games in ${Date.now() - start}ms total`);
    setCache(cacheKey, data);
    inflightRequests.delete(cacheKey);
    return data;
  })();

  inflightRequests.set(cacheKey, request);

  const allGames = await request;
  return sport ? allGames.filter((g: APIGameWithPick) => g.game.sport === sport) : allGames;
}

export async function fetchParlays(date: Date, type?: string, forceRefresh = false): Promise<APIParlay[]> {
  const dateStr = formatDate(date);
  const cacheKey = `parlays:${dateStr}`;

  if (!forceRefresh) {
    const cached = getCached<APIParlay[]>(cacheKey);
    if (cached) {
      console.log(`[API] fetchParlays: cache hit (${cached.length} parlays)`);
      return type ? cached.filter(p => p.category === type) : cached;
    }
  }

  if (!forceRefresh && inflightRequests.has(cacheKey)) {
    console.log(`[API] fetchParlays: deduplicating request`);
    const allParlays = await inflightRequests.get(cacheKey)!;
    return type ? allParlays.filter((p: APIParlay) => p.category === type) : allParlays;
  }

  const params = new URLSearchParams({ date: dateStr, tz: getTimezone() });
  const url = `${API_BASE}/parlays?${params}`;
  console.log(`[API] fetchParlays: ${url}`);
  const start = Date.now();

  const request = (async () => {
    const response = await fetch(url);
    console.log(`[API] fetchParlays response: ${response.status} in ${Date.now() - start}ms`);
    if (!response.ok) throw new Error(`Failed to fetch parlays: ${response.status}`);
    const data = await response.json();
    console.log(`[API] fetchParlays parsed: ${data.length} parlays in ${Date.now() - start}ms total`);
    setCache(cacheKey, data);
    inflightRequests.delete(cacheKey);
    return data;
  })();

  inflightRequests.set(cacheKey, request);

  const allParlays = await request;
  return type ? allParlays.filter((p: APIParlay) => p.category === type) : allParlays;
}

export async function createCustomParlay(
  date: Date,
  legCount: number,
  sports?: string[],
): Promise<APIParlay | { error: string }> {
  const params = new URLSearchParams({
    date: formatDate(date),
    tz: getTimezone(),
  });

  const response = await fetch(`${API_BASE}/parlays/custom?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leg_count: legCount,
      sports: sports || null,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create custom parlay: ${response.status}`);
  }
  return response.json();
}

export async function fetchSports(): Promise<APISport[]> {
  const response = await fetch(`${API_BASE}/games/sports`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sports: ${response.status}`);
  }
  return response.json();
}

export async function checkHealth(): Promise<{ status: string; version: string; database: string }> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`API health check failed: ${response.status}`);
  }
  return response.json();
}

// API service object for class-style access
export const apiService = {
  async getPerformance(startDate: string, endDate: string, league?: string, pickType?: string): Promise<any> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      tz: getTimezone(),
    });
    if (league && league !== 'all') {
      params.append('league', league);
    }
    if (pickType) {
      params.append('pick_type', pickType);
    }
    const response = await fetch(`${API_BASE}/performance?${params}`);
    if (!response.ok) throw new Error('Failed to fetch performance');
    return response.json();
  },

  async triggerUpdateResults(): Promise<{ status: string; job: string }> {
    const response = await fetch(`${API_BASE}/admin/update-results`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to trigger update results');
    return response.json();
  },

  async refreshFinalScores(): Promise<{ status: string; updated_games: number }> {
    const response = await fetch(`${API_BASE}/admin/refresh-final-scores`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to refresh final scores');
    return response.json();
  },

  async fixOrphanedPicks(): Promise<{ status: string; fixed_picks: number }> {
    const response = await fetch(`${API_BASE}/admin/fix-orphaned-picks`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to fix orphaned picks');
    return response.json();
  },

  async regeneratePick(pickId: string): Promise<APIPick> {
    const response = await fetch(`${API_BASE}/picks/${pickId}/regenerate`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to regenerate pick' }));
      throw new Error(error.detail || 'Failed to regenerate pick');
    }
    const data = await response.json();
    return data.pick;
  },

  async regeneratePicksForDate(date: Date): Promise<{ regenerated: number }> {
    const params = new URLSearchParams({
      date: formatDate(date),
      tz: getTimezone(),
    });
    const response = await fetch(`${API_BASE}/admin/regenerate-picks?${params}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to regenerate picks');
    return response.json();
  },
};
