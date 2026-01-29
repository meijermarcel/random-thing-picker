export interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeLogo?: string;
  awayLogo?: string;
  startTime: Date;
  league: string;
  leagueAbbr: string;
  sport: string;
  // Team records from scoreboard
  homeRecord?: string;
  awayRecord?: string;
}

export type PickType = 'home' | 'away' | 'home_cover' | 'away_cover' | 'over' | 'under';

export interface Pick {
  game: Game;
  pickType: PickType;
  label: string;
  analysis?: PickAnalysis;
}

export type SportFilter = 'all' | 'nfl' | 'nba' | 'mlb' | 'nhl' | 'soccer';

export type PickMode = 'random' | 'analyzed';

export type Confidence = 'low' | 'medium' | 'high';

export interface TeamStats {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  winPct: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: number;
  streakType: 'W' | 'L';
}

export interface PickAnalysis {
  pickType: PickType;
  confidence: Confidence;
  reasoning: string[];
  homeScore: number;
  awayScore: number;
  differential: number;
}
