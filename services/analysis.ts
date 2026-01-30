import { Game, GameOdds, TeamStats, PickAnalysis, PickType, Confidence } from '../types/sports';
import { fetchTeamStats, createBasicStats, ENDPOINTS } from './espn';

// Weights for different factors in the analysis
const WEIGHTS = {
  WIN_PCT: 0.30,
  HOME_AWAY_SPLIT: 0.25,
  RECENT_FORM: 0.25,
  SCORING_MARGIN: 0.20,
};

// Thresholds for pick type decisions
const THRESHOLDS = {
  HEAVY_FAVORITE_SPREAD: 7,      // Spread >= 7 points = heavy favorite
  LARGE_SPREAD: 4,               // Spread >= 4 points = consider underdog cover
  HIGH_SCORING_THRESHOLD: 1.1,   // Combined avg > 110% of O/U = lean over
  LOW_SCORING_THRESHOLD: 0.9,    // Combined avg < 90% of O/U = lean under
  MONEYLINE_THRESHOLD: -250,     // Heavy favorite ML, consider spread instead
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

// Determine the best pick type based on analysis and odds
function determineBestPick(
  homeScore: number,
  awayScore: number,
  homeStats: TeamStats,
  awayStats: TeamStats,
  odds: GameOdds | undefined,
  game: Game
): { pickType: PickType; additionalReasoning: string[] } {
  const differential = Math.abs(homeScore - awayScore);
  const favoriteIsHome = homeScore >= awayScore;
  const additionalReasoning: string[] = [];
  
  // If we have odds data, use it to make smarter decisions
  if (odds) {
    const spread = odds.spread;
    const overUnder = odds.overUnder;
    const homeML = odds.homeMoneyline;
    const awayML = odds.awayMoneyline;
    
    // Check if favorite is a heavy favorite on moneyline
    const favoriteML = favoriteIsHome ? homeML : awayML;
    const underdogML = favoriteIsHome ? awayML : homeML;
    
    // Heavy favorite detection via moneyline or spread
    const isHeavyFavorite = (
      (favoriteML !== undefined && favoriteML <= THRESHOLDS.MONEYLINE_THRESHOLD) ||
      (spread !== undefined && Math.abs(spread) >= THRESHOLDS.HEAVY_FAVORITE_SPREAD)
    );
    
    // If favorite is heavy, consider underdog to cover
    if (isHeavyFavorite && spread !== undefined) {
      // Pick underdog to cover the spread
      const underdogIsHome = !favoriteIsHome;
      additionalReasoning.push(`Spread: ${spread > 0 ? '+' : ''}${spread} points`);
      
      // Check if underdog has good recent form (covers more often when hot)
      const underdogStats = underdogIsHome ? homeStats : awayStats;
      if (underdogStats.streakType === 'W' && underdogStats.streak >= 2) {
        additionalReasoning.push(`${underdogStats.teamName} on ${underdogStats.streak}-game streak`);
        return {
          pickType: underdogIsHome ? 'home_cover' : 'away_cover',
          additionalReasoning,
        };
      }
      
      // Heavy favorites often fail to cover large spreads
      if (Math.abs(spread) >= THRESHOLDS.HEAVY_FAVORITE_SPREAD) {
        additionalReasoning.push('Large spreads favor underdogs');
        return {
          pickType: underdogIsHome ? 'home_cover' : 'away_cover',
          additionalReasoning,
        };
      }
    }
    
    // Medium spread - consider the spread pick
    if (spread !== undefined && Math.abs(spread) >= THRESHOLDS.LARGE_SPREAD) {
      // Check underdog's away/home performance
      const underdogIsHome = !favoriteIsHome;
      const underdogStats = underdogIsHome ? homeStats : awayStats;
      
      // Good underdog + points = attractive pick
      if (underdogStats.winPct >= 0.4) {
        additionalReasoning.push(`${underdogStats.teamName} getting ${Math.abs(spread)} points`);
        return {
          pickType: underdogIsHome ? 'home_cover' : 'away_cover',
          additionalReasoning,
        };
      }
    }
    
    // Over/Under analysis
    if (overUnder !== undefined && homeStats.pointsFor > 0 && awayStats.pointsFor > 0) {
      const homeGames = homeStats.wins + homeStats.losses;
      const awayGames = awayStats.wins + awayStats.losses;
      
      if (homeGames > 0 && awayGames > 0) {
        const homeAvgFor = homeStats.pointsFor / homeGames;
        const homeAvgAgainst = homeStats.pointsAgainst / homeGames;
        const awayAvgFor = awayStats.pointsFor / awayGames;
        const awayAvgAgainst = awayStats.pointsAgainst / awayGames;
        
        // Estimate total points: (Team A scores vs Team B defense + Team B scores vs Team A defense) / 2
        const projectedTotal = (homeAvgFor + awayAvgFor + homeAvgAgainst + awayAvgAgainst) / 2;
        const ratio = projectedTotal / overUnder;
        
        // Strong over lean
        if (ratio >= THRESHOLDS.HIGH_SCORING_THRESHOLD) {
          additionalReasoning.push(`Projected total ${projectedTotal.toFixed(0)} vs O/U ${overUnder}`);
          additionalReasoning.push('Both teams trending high-scoring');
          return { pickType: 'over', additionalReasoning };
        }
        
        // Strong under lean
        if (ratio <= THRESHOLDS.LOW_SCORING_THRESHOLD) {
          additionalReasoning.push(`Projected total ${projectedTotal.toFixed(0)} vs O/U ${overUnder}`);
          additionalReasoning.push('Defensive matchup favors under');
          return { pickType: 'under', additionalReasoning };
        }
      }
    }
  }
  
  // Default: pick the favorite on moneyline only if differential is small
  // Otherwise lean toward spread picks for value
  if (differential < 10) {
    return {
      pickType: favoriteIsHome ? 'home' : 'away',
      additionalReasoning,
    };
  }
  
  // Large differential but no spread data - still ML but note the edge
  additionalReasoning.push(`Strong edge: +${differential.toFixed(1)} analysis score`);
  return {
    pickType: favoriteIsHome ? 'home' : 'away',
    additionalReasoning,
  };
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
  const differential = Math.abs(homeScore - awayScore);
  const favoriteIsHome = homeScore >= awayScore;
  
  // Determine best pick type using odds and analysis
  const { pickType, additionalReasoning } = determineBestPick(
    homeScore,
    awayScore,
    homeStats,
    awayStats,
    game.odds,
    game
  );
  
  const confidence = getConfidence(differential);
  
  // Generate reasoning based on pick type
  let reasoning: string[];
  if (pickType === 'over' || pickType === 'under') {
    reasoning = additionalReasoning;
  } else if (pickType === 'home_cover' || pickType === 'away_cover') {
    const underdogIsHome = pickType === 'home_cover';
    reasoning = generateReasoningForCover(homeStats, awayStats, underdogIsHome, game.odds);
    reasoning = [...additionalReasoning, ...reasoning].slice(0, 4);
  } else {
    reasoning = generateReasoning(homeStats, awayStats, homeScore, awayScore, favoriteIsHome);
    reasoning = [...additionalReasoning, ...reasoning].slice(0, 4);
  }
  
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
  const odds = game.odds;
  
  switch (analysis.pickType) {
    case 'home':
      return `${game.homeTeam} ML`;
    case 'away':
      return `${game.awayTeam} ML`;
    case 'home_cover': {
      // Home is underdog, show positive spread
      const spread = odds?.spread;
      if (spread !== undefined && spread > 0) {
        return `${game.homeTeam} +${spread}`;
      }
      return `${game.homeTeam} +pts`;
    }
    case 'away_cover': {
      // Away is underdog, show positive spread
      const spread = odds?.spread;
      if (spread !== undefined && spread < 0) {
        return `${game.awayTeam} +${Math.abs(spread)}`;
      }
      return `${game.awayTeam} +pts`;
    }
    case 'over': {
      const total = odds?.overUnder;
      if (total !== undefined) {
        return `Over ${total}`;
      }
      return 'Over';
    }
    case 'under': {
      const total = odds?.overUnder;
      if (total !== undefined) {
        return `Under ${total}`;
      }
      return 'Under';
    }
    default:
      return `${game.homeTeam} ML`;
  }
}
