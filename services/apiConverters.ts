// Converters between API response types and frontend types
import { APIGameWithPick, APIParlay, APIPick } from './api';
import { Game, Pick, PickAnalysis, ParlayRecommendation, PickType, Confidence, ParlayCategory } from '../types/sports';

export function convertAPIGameToGame(apiGame: APIGameWithPick): Game {
  const { game, home_team, away_team } = apiGame;

  return {
    id: game.id,
    homeTeam: home_team?.name || 'Home Team',
    awayTeam: away_team?.name || 'Away Team',
    homeTeamId: game.home_team_id || undefined,
    awayTeamId: game.away_team_id || undefined,
    homeLogo: home_team?.logo_url || undefined,
    awayLogo: away_team?.logo_url || undefined,
    startTime: new Date(game.scheduled_at),
    league: game.espn_data?.league || game.sport,
    leagueAbbr: game.espn_data?.league || game.sport.toUpperCase(),
    sport: game.sport,
    homeRecord: game.espn_data?.home_record || undefined,
    awayRecord: game.espn_data?.away_record || undefined,
    odds: game.espn_data?.odds ? {
      spread: game.espn_data.odds.spread || undefined,
      overUnder: game.espn_data.odds.over_under || undefined,
      homeMoneyline: game.espn_data.odds.home_moneyline || undefined,
      awayMoneyline: game.espn_data.odds.away_moneyline || undefined,
      drawMoneyline: game.espn_data.odds.draw_moneyline || undefined,
    } : undefined,
  };
}

export function convertAPIPickToAnalysis(apiPick: APIPick): PickAnalysis {
  const pickTypeMap: Record<string, PickType> = {
    'home': 'home',
    'away': 'away',
    'draw': 'draw',
    'home_cover': 'home_cover',
    'away_cover': 'away_cover',
    'over': 'over',
    'under': 'under',
  };

  const pickType = pickTypeMap[apiPick.analysis_factors.pick_type] || 'home';

  // Use pre-calculated values from API's projection if available, otherwise calculate
  // (rounding to 1 decimal to avoid floating point precision errors)
  const apiProjection = apiPick.analysis_factors.projection;
  const homePoints = Math.round(apiPick.home_score_predicted * 10) / 10;
  const awayPoints = Math.round(apiPick.away_score_predicted * 10) / 10;

  return {
    pickType,
    confidence: apiPick.confidence,
    reasoning: apiPick.analysis_factors.reasoning,
    homeScore: apiPick.analysis_factors.home_score,
    awayScore: apiPick.analysis_factors.away_score,
    differential: apiPick.analysis_factors.differential || (apiPick.analysis_factors.home_score - apiPick.analysis_factors.away_score),
    projection: {
      homePoints,
      awayPoints,
      totalPoints: apiProjection?.total_points ?? Math.round((homePoints + awayPoints) * 10) / 10,
      projectedWinner: apiProjection?.projected_winner ?? (homePoints > awayPoints ? 'home' : 'away'),
      projectedMargin: apiProjection?.projected_margin ?? Math.round(Math.abs(homePoints - awayPoints) * 10) / 10,
      confidence: apiPick.confidence,
    },
    // Optimized spread pick from backend (may differ from ML pick)
    spreadPick: apiPick.analysis_factors.spread_pick || undefined,
    spreadConfidence: apiPick.analysis_factors.spread_confidence || undefined,
  };
}

export function convertAPIGameWithPickToPick(apiGame: APIGameWithPick): Pick | null {
  if (!apiGame.pick) return null;

  const game = convertAPIGameToGame(apiGame);
  const analysis = convertAPIPickToAnalysis(apiGame.pick);

  // Generate label based on pick type
  let label: string;
  switch (analysis.pickType) {
    case 'home':
      label = `${game.homeTeam} ML`;
      break;
    case 'away':
      label = `${game.awayTeam} ML`;
      break;
    case 'draw':
      label = 'Draw';
      break;
    case 'home_cover':
      label = `${game.homeTeam} to cover`;
      break;
    case 'away_cover':
      label = `${game.awayTeam} to cover`;
      break;
    case 'over':
      label = 'Over';
      break;
    case 'under':
      label = 'Under';
      break;
    default:
      label = `${game.homeTeam} ML`;
  }

  return {
    game,
    pickType: analysis.pickType,
    label,
    analysis,
  };
}

export function convertAPIParlayToRecommendation(apiParlay: APIParlay): ParlayRecommendation {
  const categoryMap: Record<string, ParlayCategory> = {
    'lock': 'lock',
    'value': 'value',
    'sport': 'sport',
    'longshot': 'longshot',
    'mega': 'mega',
    'custom': 'custom',
  };

  const picks: Pick[] = apiParlay.picks
    .map(convertAPIGameWithPickToPick)
    .filter((p): p is Pick => p !== null);

  return {
    id: apiParlay.id,
    category: categoryMap[apiParlay.category] || 'custom',
    title: apiParlay.title,
    subtitle: apiParlay.subtitle,
    picks,
    icon: apiParlay.icon,
  };
}
