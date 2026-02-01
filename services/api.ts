// API service for RTP backend
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://rtp-api.onrender.com';

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
  return date.toISOString().split('T')[0];
}

export async function fetchGames(date: Date, sport?: string): Promise<APIGameWithPick[]> {
  const params = new URLSearchParams({ date: formatDate(date) });
  if (sport) params.append('sport', sport);

  const response = await fetch(`${API_BASE}/picks?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch games: ${response.status}`);
  }
  return response.json();
}

export async function fetchParlays(date: Date, type?: string): Promise<APIParlay[]> {
  const params = new URLSearchParams({ date: formatDate(date) });
  if (type) params.append('type', type);

  const response = await fetch(`${API_BASE}/parlays?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch parlays: ${response.status}`);
  }
  return response.json();
}

export async function createCustomParlay(
  date: Date,
  legCount: number,
  sports?: string[],
): Promise<APIParlay | { error: string }> {
  const params = new URLSearchParams({ date: formatDate(date) });

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
