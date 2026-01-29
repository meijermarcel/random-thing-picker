import { Game, TeamStats, PickAnalysis, PickType, Confidence } from '../types/sports';
import { fetchTeamStats, createBasicStats, ENDPOINTS } from './espn';

// Weights for different factors in the analysis
const WEIGHTS = {
  WIN_PCT: 0.30,
  HOME_AWAY_SPLIT: 0.25,
  RECENT_FORM: 0.25,
  SCORING_MARGIN: 0.20,
};

// Calculate win percentage score (0-100)
function calculateWinPctScore(stats: TeamStats): number {
  return stats.winPct * 100;
}

// Calculate home/away performance score (0-100)
function calculateHomeAwayScore(stats: TeamStats, isHome: boolean): number {
  if (isHome) {
    const homeGames = stats.homeWins + stats.homeLosses;
    if (homeGames === 0) return 50;
    return (stats.homeWins / homeGames) * 100;
  } else {
    const awayGames = stats.awayWins + stats.awayLosses;
    if (awayGames === 0) return 50;
    return (stats.awayWins / awayGames) * 100;
  }
}

// Calculate recent form score based on streak (0-100)
function calculateFormScore(stats: TeamStats): number {
  // Base score of 50, adjusted by streak
  // Winning streak adds points, losing streak subtracts
  const streakImpact = stats.streak * 5; // Each game in streak = 5 points
  const adjustment = stats.streakType === 'W' ? streakImpact : -streakImpact;
  return Math.max(0, Math.min(100, 50 + adjustment));
}

// Calculate scoring margin score (0-100)
function calculateMarginScore(stats: TeamStats): number {
  if (stats.pointsFor === 0 && stats.pointsAgainst === 0) {
    return 50; // No data available
  }
  
  const totalGames = stats.wins + stats.losses;
  if (totalGames === 0) return 50;
  
  const avgPointsFor = stats.pointsFor / totalGames;
  const avgPointsAgainst = stats.pointsAgainst / totalGames;
  
  // Normalize: +20 margin = 100, -20 margin = 0, 0 margin = 50
  const margin = avgPointsFor - avgPointsAgainst;
  const normalized = 50 + (margin * 2.5);
  return Math.max(0, Math.min(100, normalized));
}

// Calculate composite score for a team
function calculateCompositeScore(stats: TeamStats, isHome: boolean): number {
  const winPctScore = calculateWinPctScore(stats);
  const homeAwayScore = calculateHomeAwayScore(stats, isHome);
  const formScore = calculateFormScore(stats);
  const marginScore = calculateMarginScore(stats);
  
  return (
    winPctScore * WEIGHTS.WIN_PCT +
    homeAwayScore * WEIGHTS.HOME_AWAY_SPLIT +
    formScore * WEIGHTS.RECENT_FORM +
    marginScore * WEIGHTS.SCORING_MARGIN
  );
}

// Determine confidence level based on score differential
function getConfidence(differential: number): Confidence {
  if (differential < 5) return 'low';
  if (differential < 15) return 'medium';
  return 'high';
}

// Generate reasoning strings for the pick
function generateReasoning(
  homeStats: TeamStats,
  awayStats: TeamStats,
  homeScore: number,
  awayScore: number,
  pickHome: boolean
): string[] {
  const reasons: string[] = [];
  const pickedStats = pickHome ? homeStats : awayStats;
  const opponentStats = pickHome ? awayStats : homeStats;
  
  // Win percentage comparison
  if (pickedStats.winPct > opponentStats.winPct) {
    const totalGames = pickedStats.wins + pickedStats.losses;
    if (totalGames > 0) {
      reasons.push(`${pickedStats.teamName} ${pickedStats.wins}-${pickedStats.losses} overall`);
    }
  }
  
  // Home/away advantage
  if (pickHome) {
    const homeGames = homeStats.homeWins + homeStats.homeLosses;
    if (homeGames >= 3 && homeStats.homeWins > homeStats.homeLosses) {
      reasons.push(`${homeStats.teamName} ${homeStats.homeWins}-${homeStats.homeLosses} at home`);
    }
    const awayGames = awayStats.awayWins + awayStats.awayLosses;
    if (awayGames >= 3 && awayStats.awayLosses > awayStats.awayWins) {
      reasons.push(`${awayStats.teamName} ${awayStats.awayWins}-${awayStats.awayLosses} on road`);
    }
  } else {
    const awayGames = awayStats.awayWins + awayStats.awayLosses;
    if (awayGames >= 3 && awayStats.awayWins > awayStats.awayLosses) {
      reasons.push(`${awayStats.teamName} ${awayStats.awayWins}-${awayStats.awayLosses} on road`);
    }
  }
  
  // Streak
  if (pickedStats.streak >= 3) {
    reasons.push(`${pickedStats.teamName} on ${pickedStats.streak}-game ${pickedStats.streakType === 'W' ? 'win' : 'losing'} streak`);
  }
  if (opponentStats.streak >= 3 && opponentStats.streakType === 'L') {
    reasons.push(`${opponentStats.teamName} on ${opponentStats.streak}-game losing streak`);
  }
  
  // Scoring margin if data available
  if (pickedStats.pointsFor > 0 && pickedStats.pointsAgainst > 0) {
    const totalGames = pickedStats.wins + pickedStats.losses;
    if (totalGames > 0) {
      const margin = (pickedStats.pointsFor - pickedStats.pointsAgainst) / totalGames;
      if (margin > 5) {
        reasons.push(`${pickedStats.teamName} outscoring opponents by ${margin.toFixed(1)} per game`);
      }
    }
  }
  
  // If we don't have enough reasons, add a generic one
  if (reasons.length === 0) {
    const diff = Math.abs(homeScore - awayScore).toFixed(1);
    reasons.push(`Analysis score: ${pickHome ? homeStats.teamName : awayStats.teamName} +${diff}`);
  }
  
  return reasons.slice(0, 3); // Limit to 3 reasons
}

// Get league key from sport name
function getLeagueKey(sport: string, league: string): string {
  for (const [key, config] of Object.entries(ENDPOINTS)) {
    if (config.sport === sport) {
      return config.league;
    }
  }
  return league.toLowerCase();
}

// Analyze a game and return pick recommendation
export async function analyzeGame(game: Game): Promise<PickAnalysis> {
  const leagueKey = getLeagueKey(game.sport, game.leagueAbbr);
  
  // Try to fetch detailed stats, fall back to basic stats from record
  let homeStats: TeamStats;
  let awayStats: TeamStats;
  
  if (game.homeTeamId && game.awayTeamId) {
    const [homeResult, awayResult] = await Promise.all([
      fetchTeamStats(game.sport, leagueKey, game.homeTeamId),
      fetchTeamStats(game.sport, leagueKey, game.awayTeamId),
    ]);
    
    homeStats = homeResult || createBasicStats(game.homeTeam, game.homeTeamId, game.homeRecord);
    awayStats = awayResult || createBasicStats(game.awayTeam, game.awayTeamId, game.awayRecord);
  } else {
    // No team IDs, use basic stats from records
    homeStats = createBasicStats(game.homeTeam, game.homeTeamId || 'home', game.homeRecord);
    awayStats = createBasicStats(game.awayTeam, game.awayTeamId || 'away', game.awayRecord);
  }
  
  // Calculate composite scores
  const homeScore = calculateCompositeScore(homeStats, true);
  const awayScore = calculateCompositeScore(awayStats, false);
  
  // Determine the pick
  const differential = Math.abs(homeScore - awayScore);
  const pickHome = homeScore >= awayScore; // Tie goes to home team
  
  // For moneyline, pick the favored team
  const pickType: PickType = pickHome ? 'home' : 'away';
  
  const confidence = getConfidence(differential);
  const reasoning = generateReasoning(homeStats, awayStats, homeScore, awayScore, pickHome);
  
  return {
    pickType,
    confidence,
    reasoning,
    homeScore,
    awayScore,
    differential,
  };
}

// Analyze multiple games
export async function analyzeGames(games: Game[]): Promise<Map<string, PickAnalysis>> {
  const results = new Map<string, PickAnalysis>();
  
  // Process games in batches to avoid too many concurrent requests
  const batchSize = 3;
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    const analyses = await Promise.all(batch.map(game => analyzeGame(game)));
    
    batch.forEach((game, index) => {
      results.set(game.id, analyses[index]);
    });
  }
  
  return results;
}

// Generate a pick label based on analysis
export function getAnalyzedPickLabel(game: Game, analysis: PickAnalysis): string {
  switch (analysis.pickType) {
    case 'home':
      return `${game.homeTeam} ML`;
    case 'away':
      return `${game.awayTeam} ML`;
    case 'home_cover':
      return `${game.homeTeam} to cover`;
    case 'away_cover':
      return `${game.awayTeam} to cover`;
    case 'over':
      return 'Over';
    case 'under':
      return 'Under';
    default:
      return `${game.homeTeam} ML`;
  }
}
