import { Game, Pick, PickAnalysis, ParlayRecommendation } from '../types/sports';
import { getAnalyzedPickLabel } from './analysis';

interface AnalyzedGame {
  game: Game;
  analysis: PickAnalysis;
}

// Generate all parlay recommendations from analyzed games
export function generateParlays(
  games: Game[],
  analyses: Map<string, PickAnalysis>
): ParlayRecommendation[] {
  // Build analyzed games list
  const analyzedGames: AnalyzedGame[] = games
    .filter(g => analyses.has(g.id))
    .map(g => ({ game: g, analysis: analyses.get(g.id)! }));

  if (analyzedGames.length < 2) {
    return [];
  }

  const parlays: ParlayRecommendation[] = [];

  // Lock of the Day - high confidence only
  const lockParlay = buildLockParlay(analyzedGames);
  if (lockParlay) parlays.push(lockParlay);

  // Best Value - biggest edge
  const valueParlay = buildValueParlay(analyzedGames);
  if (valueParlay) parlays.push(valueParlay);

  // Sport Specials - only if 15+ games
  if (analyzedGames.length >= 15) {
    const sportParlays = buildSportParlays(analyzedGames);
    parlays.push(...sportParlays);
  }

  // Longshot - only if 5+ games
  if (analyzedGames.length >= 5) {
    const longshotParlay = buildLongshotParlay(analyzedGames);
    if (longshotParlay) parlays.push(longshotParlay);
  }

  // Mega - only if 12+ games
  if (analyzedGames.length >= 12) {
    const megaParlay = buildMegaParlay(analyzedGames);
    if (megaParlay) parlays.push(megaParlay);
  }

  return parlays;
}

function buildLockParlay(games: AnalyzedGame[]): ParlayRecommendation | null {
  const highConfidence = games
    .filter(g => g.analysis.confidence === 'high')
    .sort((a, b) => b.analysis.differential - a.analysis.differential);

  if (highConfidence.length < 2) return null;

  const selected = highConfidence.slice(0, 3);
  const picks = selected.map(g => toPick(g));

  return {
    id: 'lock',
    category: 'lock',
    title: 'Lock of the Day',
    subtitle: `${picks.length} legs • High confidence`,
    picks,
    icon: '🔒',
  };
}

function buildValueParlay(games: AnalyzedGame[]): ParlayRecommendation | null {
  const qualified = games
    .filter(g => g.analysis.confidence !== 'low')
    .sort((a, b) => {
      // Sort by differential (edge) descending
      return b.analysis.differential - a.analysis.differential;
    });

  if (qualified.length < 3) return null;

  const selected = qualified.slice(0, 4);
  const picks = selected.map(g => toPick(g));

  return {
    id: 'value',
    category: 'value',
    title: 'Best Value',
    subtitle: `${picks.length} legs • Strong edge`,
    picks,
    icon: '💎',
  };
}

function buildSportParlays(games: AnalyzedGame[]): ParlayRecommendation[] {
  const parlays: ParlayRecommendation[] = [];

  // Group by sport
  const bySport = new Map<string, AnalyzedGame[]>();
  for (const g of games) {
    const sport = g.game.sport;
    if (!bySport.has(sport)) {
      bySport.set(sport, []);
    }
    bySport.get(sport)!.push(g);
  }

  // Sport name mapping
  const sportNames: Record<string, { name: string; icon: string }> = {
    'basketball': { name: 'NBA', icon: '🏀' },
    'football': { name: 'NFL', icon: '🏈' },
    'hockey': { name: 'NHL', icon: '🏒' },
    'baseball': { name: 'MLB', icon: '⚾' },
    'soccer': { name: 'Soccer', icon: '⚽' },
  };

  for (const [sport, sportGames] of bySport) {
    if (sportGames.length < 3) continue;

    const sorted = sportGames
      .filter(g => g.analysis.confidence !== 'low')
      .sort((a, b) => b.analysis.differential - a.analysis.differential);

    if (sorted.length < 3) continue;

    const selected = sorted.slice(0, 5);
    const picks = selected.map(g => toPick(g));
    const info = sportNames[sport] || { name: sport, icon: '🎯' };

    parlays.push({
      id: `sport-${sport}`,
      category: 'sport',
      title: `${info.name} Special`,
      subtitle: `${picks.length} legs • All ${info.name.toLowerCase()}`,
      picks,
      icon: info.icon,
    });
  }

  return parlays;
}

function buildLongshotParlay(games: AnalyzedGame[]): ParlayRecommendation | null {
  // Use medium+ confidence, variety of sports
  const qualified = games
    .filter(g => g.analysis.confidence !== 'low')
    .sort((a, b) => b.analysis.differential - a.analysis.differential);

  if (qualified.length < 5) return null;

  // Try to get variety - different sports
  const selected: AnalyzedGame[] = [];
  const usedSports = new Set<string>();

  // First pass: one per sport
  for (const g of qualified) {
    if (!usedSports.has(g.game.sport) && selected.length < 6) {
      selected.push(g);
      usedSports.add(g.game.sport);
    }
  }

  // Second pass: fill remaining spots
  for (const g of qualified) {
    if (selected.length >= 6) break;
    if (!selected.includes(g)) {
      selected.push(g);
    }
  }

  if (selected.length < 5) return null;

  const picks = selected.map(g => toPick(g));

  return {
    id: 'longshot',
    category: 'longshot',
    title: 'Longshot',
    subtitle: `${picks.length} legs • High risk/reward`,
    picks,
    icon: '🎰',
  };
}

function buildMegaParlay(games: AnalyzedGame[]): ParlayRecommendation | null {
  // Use all medium+ confidence games for maximum legs
  const qualified = games
    .filter(g => g.analysis.confidence !== 'low')
    .sort((a, b) => b.analysis.differential - a.analysis.differential);

  if (qualified.length < 12) return null;

  // Try to get variety - different sports first
  const selected: AnalyzedGame[] = [];
  const usedSports = new Set<string>();

  // First pass: cycle through sports
  for (const g of qualified) {
    if (!usedSports.has(g.game.sport) && selected.length < 12) {
      selected.push(g);
      usedSports.add(g.game.sport);
    }
  }

  // Second pass: fill remaining spots
  for (const g of qualified) {
    if (selected.length >= 12) break;
    if (!selected.includes(g)) {
      selected.push(g);
    }
  }

  if (selected.length < 12) return null;

  const picks = selected.map(g => toPick(g));

  return {
    id: 'mega',
    category: 'mega',
    title: 'Mega Parlay',
    subtitle: `${picks.length} legs • Jackpot mode`,
    picks,
    icon: '🚀',
  };
}

// Build a custom parlay with a specific number of legs and optional sport filter
export function buildCustomParlay(
  games: Game[],
  analyses: Map<string, PickAnalysis>,
  numLegs: number,
  sportFilter?: string // 'all' or specific sport like 'basketball', 'football', etc.
): ParlayRecommendation | null {
  // Filter by sport if specified
  const filteredGames = sportFilter && sportFilter !== 'all'
    ? games.filter(g => g.sport === sportFilter)
    : games;

  const analyzedGames: AnalyzedGame[] = filteredGames
    .filter(g => analyses.has(g.id))
    .map(g => ({ game: g, analysis: analyses.get(g.id)! }));

  // Sort by differential (best picks first)
  const sorted = analyzedGames
    .filter(g => g.analysis.confidence !== 'low')
    .sort((a, b) => b.analysis.differential - a.analysis.differential);

  if (sorted.length < numLegs) {
    // Not enough qualified games, include low confidence
    const allSorted = analyzedGames
      .sort((a, b) => b.analysis.differential - a.analysis.differential);

    if (allSorted.length < numLegs) return null;

    const picks = allSorted.slice(0, numLegs).map(g => toPick(g));
    return {
      id: `custom-${numLegs}`,
      category: 'custom',
      title: `Custom ${numLegs}-Leg`,
      subtitle: `${picks.length} legs • Your pick`,
      picks,
      icon: '✨',
    };
  }

  // Try to get variety - different sports
  const selected: AnalyzedGame[] = [];
  const usedSports = new Set<string>();

  // First pass: one per sport
  for (const g of sorted) {
    if (!usedSports.has(g.game.sport) && selected.length < numLegs) {
      selected.push(g);
      usedSports.add(g.game.sport);
    }
  }

  // Second pass: fill remaining spots
  for (const g of sorted) {
    if (selected.length >= numLegs) break;
    if (!selected.includes(g)) {
      selected.push(g);
    }
  }

  const picks = selected.map(g => toPick(g));

  return {
    id: `custom-${numLegs}`,
    category: 'custom',
    title: `Custom ${numLegs}-Leg`,
    subtitle: `${picks.length} legs • Your pick`,
    picks,
    icon: '✨',
  };
}

function toPick(ag: AnalyzedGame): Pick {
  return {
    game: ag.game,
    pickType: ag.analysis.pickType,
    label: getAnalyzedPickLabel(ag.game, ag.analysis),
    analysis: ag.analysis,
  };
}
