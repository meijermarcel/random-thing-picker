import { Game, GameOdds, TeamStats, AdvancedStats, ScheduleContext, HeadToHead, InjuryReport, PickAnalysis, PickType, Confidence, GameProjection } from '../types/sports';
import { fetchTeamStats, fetchAdvancedStats, fetchTeamSchedule, fetchLeagueInjuries, calculateScheduleContext, calculateHeadToHead, createBasicStats, ENDPOINTS } from './espn';

// Weights for different factors in the analysis
const WEIGHTS = {
  WIN_PCT: 0.15,
  HOME_AWAY_SPLIT: 0.15,
  RECENT_FORM: 0.15,
  SCORING_MARGIN: 0.10,
  ADVANCED_STATS: 0.20,
  REST_SCHEDULE: 0.10,
  HEAD_TO_HEAD: 0.10,
  INJURIES: 0.05,
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

// League average stats for normalization
const LEAGUE_AVG_STATS: Record<string, { ppg: number; fgPct: number; astTov: number }> = {
  'basketball': { ppg: 115, fgPct: 0.47, astTov: 1.7 },
  'football': { ppg: 22, fgPct: 0.60, astTov: 1.5 },
  'hockey': { ppg: 3, fgPct: 0.10, astTov: 1.0 },
  'baseball': { ppg: 4.5, fgPct: 0.25, astTov: 1.0 },
  'soccer': { ppg: 1.5, fgPct: 0.35, astTov: 1.0 },
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

// Normalize a value against a baseline (returns 0-1 scale)
function normalize(value: number, baseline: number): number {
  if (baseline === 0) return 0.5;
  const ratio = value / baseline;
  // Clamp between 0.5 and 1.5, then normalize to 0-1
  const clamped = Math.max(0.5, Math.min(1.5, ratio));
  return (clamped - 0.5);
}

// Calculate advanced stats score (0-100)
function calculateAdvancedScore(advanced: AdvancedStats | undefined, sport: string): number {
  if (!advanced) return 50; // Neutral if no data

  const leagueAvg = LEAGUE_AVG_STATS[sport] || LEAGUE_AVG_STATS['basketball'];

  const offenseScore = (
    normalize(advanced.pointsPerGame, leagueAvg.ppg) * 0.35 +
    normalize(advanced.fieldGoalPct, leagueAvg.fgPct) * 0.25 +
    normalize(advanced.assistToTurnoverRatio, leagueAvg.astTov) * 0.20 +
    normalize(advanced.threePointPct, 0.36) * 0.20
  );

  const defenseScore = (
    normalize(advanced.blocksPerGame, 5) * 0.35 +
    normalize(advanced.stealsPerGame, 7) * 0.35 +
    normalize(advanced.defensiveReboundsPerGame, 35) * 0.30
  );

  return (offenseScore * 0.6 + defenseScore * 0.4) * 100;
}

// Calculate rest advantage score (0-100)
function calculateRestScore(
  teamSchedule: ScheduleContext | undefined,
  opponentSchedule: ScheduleContext | undefined
): number {
  if (!teamSchedule) return 50;

  // Base score from days of rest
  let baseScore: number;
  if (teamSchedule.isBackToBack) {
    baseScore = 30;
  } else if (teamSchedule.daysSinceLastGame === 1) {
    baseScore = 45;
  } else if (teamSchedule.daysSinceLastGame === 2) {
    baseScore = 60;
  } else if (teamSchedule.daysSinceLastGame === 3) {
    baseScore = 75;
  } else {
    baseScore = 85;
  }

  // Compare against opponent
  if (opponentSchedule) {
    const restDiff = teamSchedule.daysSinceLastGame - opponentSchedule.daysSinceLastGame;
    if (restDiff >= 2) baseScore += 10;
    else if (restDiff <= -2) baseScore -= 10;
  }

  return Math.max(0, Math.min(100, baseScore));
}

// Calculate head-to-head score (0-100)
function calculateH2HScore(h2h: HeadToHead | undefined): number {
  if (!h2h || h2h.recentMeetings < 2) return 50; // Not enough data

  const winRate = h2h.wins / h2h.recentMeetings;
  const marginFactor = Math.min(10, Math.max(-10, h2h.avgPointDiff)) / 10;

  return Math.max(0, Math.min(100, 50 + (winRate - 0.5) * 60 + marginFactor * 20));
}

// Calculate injury advantage score (0-100)
function calculateInjuryScore(
  teamInjuries: InjuryReport | undefined,
  opponentInjuries: InjuryReport | undefined
): number {
  const teamHealth = teamInjuries?.impactScore ?? 100;
  const opponentHealth = opponentInjuries?.impactScore ?? 100;

  // Score based on relative health advantage
  const healthDiff = teamHealth - opponentHealth;
  return Math.max(0, Math.min(100, 50 + healthDiff / 2));
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

// Generate enhanced reasoning with all factors
function generateEnhancedReasoning(
  homeStats: TeamStats,
  awayStats: TeamStats,
  homeAdvanced: AdvancedStats | null,
  awayAdvanced: AdvancedStats | null,
  homeSchedule: ScheduleContext,
  awaySchedule: ScheduleContext,
  h2h: HeadToHead | undefined,
  homeInjuries: InjuryReport | undefined,
  awayInjuries: InjuryReport | undefined,
  projection: GameProjection,
  game: Game
): string[] {
  const reasons: string[] = [];

  // Check if this is likely a draw prediction (soccer with very close margin)
  const isDrawPrediction = game.sport === 'soccer' && Math.abs(projection.projectedMargin) < 0.5;

  if (isDrawPrediction) {
    // Draw-specific reasoning
    reasons.push('Teams are evenly matched');

    // Similar records
    const homeWinPct = homeStats.winPct;
    const awayWinPct = awayStats.winPct;
    if (Math.abs(homeWinPct - awayWinPct) < 0.15) {
      reasons.push(`Similar form: ${homeStats.teamName} ${(homeWinPct * 100).toFixed(0)}% vs ${awayStats.teamName} ${(awayWinPct * 100).toFixed(0)}%`);
    }

    // H2H draws
    if (h2h && h2h.recentMeetings >= 2) {
      const draws = h2h.recentMeetings - h2h.wins - h2h.losses;
      if (draws > 0) {
        reasons.push(`${draws} draw(s) in last ${h2h.recentMeetings} meetings`);
      }
    }

    // Low scoring tendency
    if (projection.totalPoints <= 2.5) {
      reasons.push('Low-scoring matchup expected');
    }

    return reasons.slice(0, 5);
  }

  const winner = projection.projectedWinner === 'home' ? homeStats : awayStats;
  const loser = projection.projectedWinner === 'home' ? awayStats : homeStats;
  const winnerAdvanced = projection.projectedWinner === 'home' ? homeAdvanced : awayAdvanced;
  const loserAdvanced = projection.projectedWinner === 'home' ? awayAdvanced : homeAdvanced;
  const winnerSchedule = projection.projectedWinner === 'home' ? homeSchedule : awaySchedule;
  const loserSchedule = projection.projectedWinner === 'home' ? awaySchedule : homeSchedule;
  const loserInjuries = projection.projectedWinner === 'home' ? awayInjuries : homeInjuries;

  // Priority 1: Significant injuries
  if (loserInjuries && loserInjuries.playersOut.length > 0) {
    const topInjured = loserInjuries.playersOut[0];
    reasons.push(`${loser.teamName} missing ${topInjured.name} (${topInjured.position})`);
  }

  // Priority 2: Rest disparity
  const restDiff = winnerSchedule.daysSinceLastGame - loserSchedule.daysSinceLastGame;
  if (restDiff >= 2) {
    if (loserSchedule.isBackToBack) {
      reasons.push(`${loser.teamName} on back-to-back`);
    } else {
      reasons.push(`${winner.teamName} ${winnerSchedule.daysSinceLastGame} days rest vs ${loserSchedule.daysSinceLastGame}`);
    }
  }

  // Priority 3: H2H dominance
  if (h2h && h2h.recentMeetings >= 3) {
    const isWinnerHome = projection.projectedWinner === 'home';
    const h2hWins = isWinnerHome ? h2h.wins : h2h.losses;
    const h2hTotal = h2h.recentMeetings;
    if (h2hWins / h2hTotal >= 0.7) {
      reasons.push(`${winner.teamName} ${h2hWins}-${h2hTotal - h2hWins} vs ${loser.teamName} this season`);
    }
  }

  // Priority 4: Advanced stats edge
  if (winnerAdvanced && loserAdvanced) {
    const fgDiff = winnerAdvanced.fieldGoalPct - loserAdvanced.fieldGoalPct;
    if (fgDiff >= 0.03) {
      reasons.push(`${winner.teamName} shooting ${(winnerAdvanced.fieldGoalPct * 100).toFixed(1)}% vs ${(loserAdvanced.fieldGoalPct * 100).toFixed(1)}%`);
    }
  }

  // Priority 5: Records
  const winnerGames = winner.wins + winner.losses;
  if (winnerGames > 0) {
    reasons.push(`${winner.teamName} ${winner.wins}-${winner.losses} (${(winner.winPct * 100).toFixed(0)}%)`);
  }

  // Priority 6: Home/away record
  if (projection.projectedWinner === 'home') {
    const homeGames = homeStats.homeWins + homeStats.homeLosses;
    if (homeGames >= 5) {
      reasons.push(`${homeStats.teamName} ${homeStats.homeWins}-${homeStats.homeLosses} at home`);
    }
  } else {
    const awayGames = awayStats.awayWins + awayStats.awayLosses;
    if (awayGames >= 5) {
      reasons.push(`${awayStats.teamName} ${awayStats.awayWins}-${awayStats.awayLosses} on road`);
    }
  }

  // Priority 7: Streaks
  if (winner.streak >= 3 && winner.streakType === 'W') {
    reasons.push(`${winner.teamName} on ${winner.streak}-game win streak`);
  }
  if (loser.streak >= 3 && loser.streakType === 'L') {
    reasons.push(`${loser.teamName} on ${loser.streak}-game losing streak`);
  }

  return reasons.slice(0, 5); // Max 5 reasons
}

// Analyze a game and return pick recommendation with projections
export async function analyzeGame(game: Game): Promise<PickAnalysis> {
  const leagueKey = getLeagueKey(game.sport, game.leagueAbbr);

  // Fetch all data in parallel
  const [
    homeStatsResult,
    awayStatsResult,
    homeAdvanced,
    awayAdvanced,
    homeSchedule,
    awaySchedule,
    leagueInjuries,
  ] = await Promise.all([
    game.homeTeamId ? fetchTeamStats(game.sport, leagueKey, game.homeTeamId) : null,
    game.awayTeamId ? fetchTeamStats(game.sport, leagueKey, game.awayTeamId) : null,
    game.homeTeamId ? fetchAdvancedStats(game.sport, leagueKey, game.homeTeamId) : null,
    game.awayTeamId ? fetchAdvancedStats(game.sport, leagueKey, game.awayTeamId) : null,
    game.homeTeamId ? fetchTeamSchedule(game.sport, leagueKey, game.homeTeamId) : [],
    game.awayTeamId ? fetchTeamSchedule(game.sport, leagueKey, game.awayTeamId) : [],
    fetchLeagueInjuries(game.sport, leagueKey),
  ]);

  // Build team stats with fallbacks
  const homeStats = homeStatsResult || createBasicStats(game.homeTeam, game.homeTeamId || 'home', game.homeRecord);
  const awayStats = awayStatsResult || createBasicStats(game.awayTeam, game.awayTeamId || 'away', game.awayRecord);

  // Calculate derived data
  const homeScheduleCtx = calculateScheduleContext(homeSchedule, game.startTime);
  const awayScheduleCtx = calculateScheduleContext(awaySchedule, game.startTime);
  const h2h = game.awayTeamId ? calculateHeadToHead(homeSchedule, game.awayTeamId) : undefined;
  const homeInjuries = game.homeTeamId ? leagueInjuries.get(game.homeTeamId) : undefined;
  const awayInjuries = game.awayTeamId ? leagueInjuries.get(game.awayTeamId) : undefined;

  // Calculate all factor scores
  const homeWinPctScore = calculateWinPctScore(homeStats);
  const awayWinPctScore = calculateWinPctScore(awayStats);

  const homeHomeAwayScore = calculateHomeAwayScore(homeStats, true);
  const awayHomeAwayScore = calculateHomeAwayScore(awayStats, false);

  const homeFormScore = calculateFormScore(homeStats);
  const awayFormScore = calculateFormScore(awayStats);

  const homeMarginScore = calculateMarginScore(homeStats);
  const awayMarginScore = calculateMarginScore(awayStats);

  const homeAdvancedScore = calculateAdvancedScore(homeAdvanced ?? undefined, game.sport);
  const awayAdvancedScore = calculateAdvancedScore(awayAdvanced ?? undefined, game.sport);

  const homeRestScore = calculateRestScore(homeScheduleCtx, awayScheduleCtx);
  const awayRestScore = calculateRestScore(awayScheduleCtx, homeScheduleCtx);

  const homeH2HScore = calculateH2HScore(h2h);
  const awayH2HScore = h2h ? 100 - homeH2HScore : 50; // Inverse for away team

  const homeInjuryScore = calculateInjuryScore(homeInjuries, awayInjuries);
  const awayInjuryScore = calculateInjuryScore(awayInjuries, homeInjuries);

  // Calculate composite scores with new weights
  const homeScore = (
    homeWinPctScore * WEIGHTS.WIN_PCT +
    homeHomeAwayScore * WEIGHTS.HOME_AWAY_SPLIT +
    homeFormScore * WEIGHTS.RECENT_FORM +
    homeMarginScore * WEIGHTS.SCORING_MARGIN +
    homeAdvancedScore * WEIGHTS.ADVANCED_STATS +
    homeRestScore * WEIGHTS.REST_SCHEDULE +
    homeH2HScore * WEIGHTS.HEAD_TO_HEAD +
    homeInjuryScore * WEIGHTS.INJURIES
  );

  const awayScore = (
    awayWinPctScore * WEIGHTS.WIN_PCT +
    awayHomeAwayScore * WEIGHTS.HOME_AWAY_SPLIT +
    awayFormScore * WEIGHTS.RECENT_FORM +
    awayMarginScore * WEIGHTS.SCORING_MARGIN +
    awayAdvancedScore * WEIGHTS.ADVANCED_STATS +
    awayRestScore * WEIGHTS.REST_SCHEDULE +
    awayH2HScore * WEIGHTS.HEAD_TO_HEAD +
    awayInjuryScore * WEIGHTS.INJURIES
  );

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
  // For soccer, predict draw when projected margin is very small (< 0.5 goals)
  let pickType: PickType;
  if (game.sport === 'soccer' && Math.abs(projection.projectedMargin) < 0.5) {
    pickType = 'draw';
  } else {
    pickType = projection.projectedWinner === 'home' ? 'home' : 'away';
  }

  // Generate enhanced reasoning
  const reasoning = generateEnhancedReasoning(
    homeStats, awayStats,
    homeAdvanced, awayAdvanced,
    homeScheduleCtx, awayScheduleCtx,
    h2h,
    homeInjuries, awayInjuries,
    projection,
    game
  );

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
    if (analysis.pickType === 'draw') return 'Draw';
    return analysis.pickType === 'home' ? `${game.homeTeam} wins` : `${game.awayTeam} wins`;
  }

  // Handle draw prediction
  if (analysis.pickType === 'draw') {
    const p = analysis.projection;
    return `Draw (${p.awayPoints}-${p.homePoints})`;
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
