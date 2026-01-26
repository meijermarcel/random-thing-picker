export interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  league: string;
  leagueAbbr: string;
}

export interface Pick {
  game: Game;
  pickedTeam: string;
  opponent: string;
}

export type SportFilter = 'all' | 'nfl' | 'nba' | 'mlb' | 'nhl' | 'soccer';
