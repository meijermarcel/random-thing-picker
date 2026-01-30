import { Game, GameOdds, TeamStats, PickAnalysis, PickType, Confidence, GameProjection } from '../types/sports';
import { fetchTeamStats, createBasicStats, ENDPOINTS } from './espn';

// Weights for different factors in the analysis
const WEIGHTS = {
  WIN_PCT: 0.30,
  HOME_AWAY_SPLIT: 0.25,
  RECENT_FORM: 0.25,
  SCORING_MARGIN: 0.20,
};

// Sport-specific average scores (used when no data available)
const LEAGUE_AVERAGES: Record<string, number> = {
  'basketball': 110,  // NBA average ~110 ppg
  'football': 22,     // NFL average ~22 ppg
  'hockey': 3,        // NHL average ~3 gpg
  'baseball': 4.5,    // MLB average ~4.5 rpg
  'soccer': 1.3,      // Soccer average ~1.3 gpg
};

// Home advantage bonus (in points)
const HOME_ADVANTAGE: Record<string, number> = {
  'basketball': 3,
  'football': 2.5,
  'hockey': 0.2,
  'baseball': 0.3,
  'soccer': 0.3,
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

// Generate reasoning for spread/cover picks
function generateReasoningForCover(
  homeStats: TeamStats,
  awayStats: TeamStats,
  underdogIsHome: boolean,
  odds: GameOdds | undefined
): string[] {
  const reasons: string[] = [];
  const underdogStats = underdogIsHome ? homeStats : awayStats;
  const favoriteStats = underdogIsHome ? awayStats : homeStats;
  
  // Underdog record
  const totalGames = underdogStats.wins + underdogStats.losses;
  if (totalGames > 0) {
    reasons.push(`${underdogStats.teamName} ${underdogStats.wins}-${underdogStats.losses} overall`);
  }
  
  // Home/away edge for underdog
  if (underdogIsHome) {
    const homeGames = underdogStats.homeWins + underdogStats.homeLosses;
    if (homeGames >= 3) {
      reasons.push(`${underdogStats.teamName} ${underdogStats.homeWins}-${underdogStats.homeLosses} at home`);
    }
  } else {
    const awayGames = underdogStats.awayWins + underdogStats.awayLosses;
    if (awayGames >= 3 && underdogStats.awayWins > 0) {
      reasons.push(`${underdogStats.teamName} ${underdogStats.awayWins}-${underdogStats.awayLosses} on road`);
    }
  }
  
  // Favorite struggles
  if (!underdogIsHome) {
    const favAwayGames = favoriteStats.awayWins + favoriteStats.awayLosses;
    if (favAwayGames >= 3 && favoriteStats.awayLosses > favoriteStats.awayWins * 0.5) {
      reasons.push(`${favoriteStats.teamName} ${favoriteStats.awayWins}-${favoriteStats.awayLosses} on road`);
    }
  }
  
  // Streak info
  if (underdogStats.streak >= 2 && underdogStats.streakType === 'W') {
    reasons.push(`${underdogStats.teamName} on ${underdogStats.streak}-game win streak`);
  }
  if (favoriteStats.streak >= 2 && favoriteStats.streakType === 'L') {
    reasons.push(`${favoriteStats.teamName} on ${favoriteStats.streak}-game skid`);
  }
  
  if (reasons.length === 0) {
    reasons.push('Value on the points');
  }
  
  return reasons.slice(0, 3);
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

// Calculate projected points for a team in a specific matchup
function calculateProjectedPoints(
  teamStats: TeamStats,
  opponentStats: TeamStats,
  isHome: boolean,
  sport: string
): number {
  const leagueAvg = LEAGUE_AVERAGES[sport] || 100;
  const homeBonus = HOME_ADVANTAGE[sport] || 2;
  
  const teamGames = teamStats.wins + teamStats.losses;
  const oppGames = opponentStats.wins + opponentStats.losses;
  
  // If we have scoring data, use it
  if (teamStats.pointsFor > 0 && teamGames > 0 && opponentStats.pointsAgainst > 0 && oppGames > 0) {
    const teamAvgFor = teamStats.pointsFor / teamGames;
    const oppAvgAgainst = opponentStats.pointsAgainst / oppGames;
    
    // Blend team's offense with opponent's defense
    // Formula: (Team's avg scoring + opponent's avg allowed) / 2
    let projected = (teamAvgFor + oppAvgAgainst) / 2;
    
    // Apply home/away adjustment
    if (isHome) {
      projected += homeBonus;
    } else {
      projected -= homeBonus * 0.5; // Away penalty is less than home bonus
    }
    
    // Apply form adjustment (hot teams score more, cold teams score less)
    const formAdjust = teamStats.streakType === 'W' 
      ? teamStats.streak * 0.5 
      : -teamStats.streak * 0.5;
    projected += formAdjust;
    
    // Apply win percentage factor (better teams score more)
    const winPctAdjust = (teamStats.winPct - 0.5) * leagueAvg * 0.1;
    projected += winPctAdjust;
    
    return Math.max(0, Math.round(projected * 10) / 10);
  }
  
  // Fallback: use win percentage to estimate
  // Better teams assumed to score above average
  const winPctFactor = teamStats.winPct;
  let baseScore = leagueAvg * (0.85 + winPctFactor * 0.3);
  
  if (isHome) {
    baseScore += homeBonus;
  }
  
  return Math.round(baseScore * 10) / 10;
}

// Calculate game projection with scores and totals
function calculateGameProjection(
  homeStats: TeamStats,
  awayStats: TeamStats,
  compositeHomeScore: number,
  compositeAwayScore: number,
  sport: string
): GameProjection {
  // Calculate projected points for each team
  const homePoints = calculateProjectedPoints(homeStats, awayStats, true, sport);
  const awayPoints = calculateProjectedPoints(awayStats, homeStats, false, sport);
  
  const totalPoints = Math.round((homePoints + awayPoints) * 10) / 10;
  const projectedMargin = Math.round((homePoints - awayPoints) * 10) / 10;
  const projectedWinner = homePoints >= awayPoints ? 'home' : 'away';
  
  // Confidence based on composite score differential
  const differential = Math.abs(compositeHomeScore - compositeAwayScore);
  let confidence: Confidence;
  if (differential < 5) {
    confidence = 'low';
  } else if (differential < 15) {
    confidence = 'medium';
  } else {
    confidence = 'high';
  }
  
  return {
    homePoints,
    awayPoints,
    totalPoints,
    projectedWinner,
    projectedMargin,
    confidence,
  };
}

// Generate reasoning based on projections
function generateProjectionReasoning(
  homeStats: TeamStats,
  awayStats: TeamStats,
  projection: GameProjection,
  game: Game
): string[] {
  const reasons: string[] = [];
  const winner = projection.projectedWinner === 'home' ? homeStats : awayStats;
  const loser = projection.projectedWinner === 'home' ? awayStats : homeStats;
  
  // Records
  const winnerGames = winner.wins + winner.losses;
  const loserGames = loser.wins + loser.losses;
  
  if (winnerGames > 0) {
    reasons.push(`${winner.teamName} ${winner.wins}-${winner.losses} (${(winner.winPct * 100).toFixed(0)}%)`);
  }
  if (loserGames > 0) {
    reasons.push(`${loser.teamName} ${loser.wins}-${loser.losses} (${(loser.winPct * 100).toFixed(0)}%)`);
  }
  
  // Home/away records
  if (projection.projectedWinner === 'home') {
    const homeGames = homeStats.homeWins + homeStats.homeLosses;
    if (homeGames >= 3) {
      reasons.push(`${homeStats.teamName} ${homeStats.homeWins}-${homeStats.homeLosses} at home`);
    }
  } else {
    const awayGames = awayStats.awayWins + awayStats.awayLosses;
    if (awayGames >= 3) {
      reasons.push(`${awayStats.teamName} ${awayStats.awayWins}-${awayStats.awayLosses} on road`);
    }
  }
  
  // Streaks
  if (winner.streak >= 2 && winner.streakType === 'W') {
    reasons.push(`${winner.teamName} on ${winner.streak}-game win streak`);
  }
  if (loser.streak >= 2 && loser.streakType === 'L') {
    reasons.push(`${loser.teamName} on ${loser.streak}-game losing streak`);
  }
  
  // Scoring info if available
  const winnerGamesPlayed = winner.wins + winner.losses;
  if (winner.pointsFor > 0 && winnerGamesPlayed > 0) {
    const avgFor = winner.pointsFor / winnerGamesPlayed;
    reasons.push(`${winner.teamName} averaging ${avgFor.toFixed(1)} PPG`);
  }
  
  return reasons.slice(0, 4);
}

// Analyze a game and return pick recommendation with projections
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
  
  // Calculate composite scores (for confidence/analysis)
  const homeScore = calculateCompositeScore(homeStats, true);
  const awayScore = calculateCompositeScore(awayStats, false);
  const differential = Math.abs(homeScore - awayScore);
  
  // Calculate actual score projections
  const projection = calculateGameProjection(
    homeStats,
    awayStats,
    homeScore,
    awayScore,
    game.sport
  );
  
  // Determine pick type based on projection
  const pickType: PickType = projection.projectedWinner === 'home' ? 'home' : 'away';
  
  // Generate reasoning based on projections
  const reasoning = generateProjectionReasoning(homeStats, awayStats, projection, game);
  
  return {
    pickType,
    confidence: projection.confidence,
    reasoning,
    homeScore,
    awayScore,
    differential,
    projection,
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

// Generate a pick label based on analysis - shows projected winner
export function getAnalyzedPickLabel(game: Game, analysis: PickAnalysis): string {
  if (!analysis.projection) {
    // Fallback for old format
    return analysis.pickType === 'home' ? `${game.homeTeam} wins` : `${game.awayTeam} wins`;
  }
  
  const p = analysis.projection;
  const winner = p.projectedWinner === 'home' ? game.homeTeam : game.awayTeam;
  const margin = Math.abs(p.projectedMargin);
  
  return `${winner} by ${margin}`;
}

// Format projection as a score string
export function formatProjectedScore(game: Game, analysis: PickAnalysis): string {
  if (!analysis.projection) {
    return '';
  }
  
  const p = analysis.projection;
  return `${game.awayTeam} ${p.awayPoints} - ${game.homeTeam} ${p.homePoints}`;
}
