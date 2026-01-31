export interface GameOdds {
  spread?: number;        // Positive = home underdog, Negative = home favorite
  spreadOdds?: number;    // Odds for the spread (e.g., -110)
  overUnder?: number;     // Total points line
  homeMoneyline?: number; // Home team ML odds
  awayMoneyline?: number; // Away team ML odds
  provider?: string;      // Odds provider name
}

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
  // Betting odds
  odds?: GameOdds;
}

export type PickType = 'home' | 'away' | 'home_cover' | 'away_cover' | 'over' | 'under';

export interface Pick {
  game: Game;
  pickType: PickType;
  label: string;
  analysis?: PickAnalysis;
}

export type SportFilter = 'all' | 'nfl' | 'nba' | 'ncaam' | 'mlb' | 'nhl' | 'soccer';

export type PickMode = 'random' | 'analyzed';

export type Confidence = 'low' | 'medium' | 'high';

export interface AdvancedStats {
  // Offensive
  pointsPerGame: number;
  fieldGoalPct: number;
  threePointPct: number;
  freeThrowPct: number;
  assistsPerGame: number;
  turnoversPerGame: number;
  assistToTurnoverRatio: number;
  offensiveReboundsPerGame: number;

  // Defensive
  blocksPerGame: number;
  stealsPerGame: number;
  defensiveReboundsPerGame: number;
}

export interface ScheduleGame {
  gameId: string;
  date: Date;
  opponentId: string;
  opponentName: string;
  isHome: boolean;
  teamScore?: number;
  opponentScore?: number;
  completed: boolean;
}

export interface ScheduleContext {
  lastGameDate: Date | null;
  daysSinceLastGame: number;
  isBackToBack: boolean;
  gamesInLast7Days: number;
}

export interface HeadToHead {
  recentMeetings: number;
  wins: number;
  losses: number;
  avgPointDiff: number;
}

export interface InjuredPlayer {
  name: string;
  position: string;
  status: 'out' | 'day-to-day';
}

export interface InjuryReport {
  playersOut: InjuredPlayer[];
  playersQuestionable: InjuredPlayer[];
  impactScore: number;
}

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
  // Enhanced data (optional)
  advanced?: AdvancedStats;
  schedule?: ScheduleContext;
  headToHead?: HeadToHead;
  injuries?: InjuryReport;
}

export interface GameProjection {
  homePoints: number;       // Projected points for home team
  awayPoints: number;       // Projected points for away team
  totalPoints: number;      // Projected total points
  projectedWinner: 'home' | 'away';
  projectedMargin: number;  // Positive = home wins by X, negative = away wins by X
  confidence: Confidence;
}

export interface PickAnalysis {
  pickType: PickType;
  confidence: Confidence;
  reasoning: string[];
  homeScore: number;        // Analysis composite score (0-100)
  awayScore: number;        // Analysis composite score (0-100)
  differential: number;
  projection: GameProjection; // Actual predicted scores
}
