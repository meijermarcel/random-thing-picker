export interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  league: string;
  leagueAbbr: string;
}

export type PickType = 'home' | 'away' | 'home_cover' | 'away_cover' | 'over' | 'under';

export interface Pick {
  game: Game;
  pickType: PickType;
  label: string;
}

export type SportFilter = 'all' | 'nfl' | 'nba' | 'mlb' | 'nhl' | 'soccer';
