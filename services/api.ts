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
      projected_winner: string;
      projected_margin: number;
      confidence: string;
    };
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

export async function fetchGames(date: Date, sport?: string): Promise<APIGameWithPick[]> {
  const params = new URLSearchParams({
    date: formatDate(date),
    tz: getTimezone(),
  });
  if (sport) params.append('sport', sport);

  const url = `${API_BASE}/picks?${params}`;
  console.log(`[API] fetchGames: ${url}`);
  const start = Date.now();

  const response = await fetch(url);
  console.log(`[API] fetchGames response: ${response.status} in ${Date.now() - start}ms`);

  if (!response.ok) {
    throw new Error(`Failed to fetch games: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[API] fetchGames parsed: ${data.length} games in ${Date.now() - start}ms total`);
  return data;
}

export async function fetchParlays(date: Date, type?: string): Promise<APIParlay[]> {
  const params = new URLSearchParams({
    date: formatDate(date),
    tz: getTimezone(),
  });
  if (type) params.append('type', type);

  const url = `${API_BASE}/parlays?${params}`;
  console.log(`[API] fetchParlays: ${url}`);
  const start = Date.now();

  const response = await fetch(url);
  console.log(`[API] fetchParlays response: ${response.status} in ${Date.now() - start}ms`);

  if (!response.ok) {
    throw new Error(`Failed to fetch parlays: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[API] fetchParlays parsed: ${data.length} parlays in ${Date.now() - start}ms total`);
  return data;
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
  async getPerformance(startDate: string, endDate: string): Promise<any> {
    const response = await fetch(
      `${API_BASE}/performance?start_date=${startDate}&end_date=${endDate}`
    );
    if (!response.ok) throw new Error('Failed to fetch performance');
    return response.json();
  },
};
