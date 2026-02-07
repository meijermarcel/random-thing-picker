import { Pick, ParlayRecommendation, RiskMode, StrategyBet, StrategyParlay, DailyStrategy } from '../types/sports';

const ALLOCATION_SPLITS: Record<RiskMode, { straight: number; parlays: number; underdogs: number }> = {
  conservative: { straight: 0.70, parlays: 0.20, underdogs: 0.10 },
  balanced:     { straight: 0.50, parlays: 0.35, underdogs: 0.15 },
  aggressive:   { straight: 0.25, parlays: 0.50, underdogs: 0.25 },
};

const PARLAY_CATEGORIES_BY_RISK: Record<RiskMode, string[]> = {
  conservative: ['lock'],
  balanced:     ['lock', 'value'],
  aggressive:   ['lock', 'value', 'longshot'],
};

const MIN_BET = 2;
const MAX_STRAIGHT_BETS = 6;

/** Calculate potential return from American odds and wager */
function calcReturn(odds: number, wager: number): number {
  if (odds > 0) return wager * (odds / 100);
  return wager * (100 / Math.abs(odds));
}

/** Decide whether a pick should be a spread or ML bet */
function decideBetType(pick: Pick): { type: 'straight_spread' | 'straight_ml'; label: string } {
  const analysis = pick.analysis;
  const odds = pick.game.odds;

  if (!analysis || !odds || odds.spread == null) {
    // No spread data, default to ML
    const mlOdds = pick.pickType === 'home' ? odds?.homeMoneyline : odds?.awayMoneyline;
    const oddsStr = mlOdds != null ? (mlOdds > 0 ? `+${mlOdds}` : `${mlOdds}`) : '';
    return { type: 'straight_ml', label: `ML ${oddsStr}`.trim() };
  }

  const projectedMargin = analysis.projection.projectedWinner === 'home'
    ? analysis.projection.projectedMargin
    : -analysis.projection.projectedMargin;

  // Spread from home perspective (negative = home favored)
  const spread = odds.spread;
  // Cover margin: how much the projected margin exceeds the spread
  const coverMargin = projectedMargin + spread;

  // If projected to cover by 2+ points, take the spread
  if (Math.abs(coverMargin) > 2 && analysis.spreadPick) {
    const spreadVal = analysis.spreadPick === 'home' ? spread : -spread;
    const spreadStr = spreadVal > 0 ? `+${spreadVal}` : `${spreadVal}`;
    return { type: 'straight_spread', label: `Spread ${spreadStr}` };
  }

  // Otherwise take ML
  const mlOdds = pick.pickType === 'home' ? odds.homeMoneyline : odds.awayMoneyline;
  const oddsStr = mlOdds != null ? (mlOdds > 0 ? `+${mlOdds}` : `${mlOdds}`) : '';
  return { type: 'straight_ml', label: `ML ${oddsStr}`.trim() };
}

/** Get the relevant ML odds for a pick */
function getPickOdds(pick: Pick): number {
  const odds = pick.game.odds;
  if (!odds) return -110; // fallback
  if (pick.pickType === 'home') return odds.homeMoneyline ?? -110;
  if (pick.pickType === 'away') return odds.awayMoneyline ?? -110;
  return -110;
}

/** Check if a pick qualifies as an underdog flyer */
function isUnderdogFlyer(pick: Pick): boolean {
  const odds = getPickOdds(pick);
  const confidence = pick.analysis?.confidence;
  return odds > 150 && (confidence === 'medium' || confidence === 'high');
}

/** Select and rank straight bets from picks */
function selectStraightBets(picks: Pick[], riskMode: RiskMode): Pick[] {
  const minConfidence = riskMode === 'aggressive' ? 'low' : 'medium';
  const confidenceOrder = { high: 3, medium: 2, low: 1 };

  return picks
    .filter(p => p.analysis && !isUnderdogFlyer(p))
    .filter(p => confidenceOrder[p.analysis!.confidence] >= confidenceOrder[minConfidence])
    .sort((a, b) => Math.abs(b.analysis!.differential) - Math.abs(a.analysis!.differential))
    .slice(0, MAX_STRAIGHT_BETS);
}

/** Select underdog flyers from picks */
function selectUnderdogFlyers(picks: Pick[]): Pick[] {
  return picks
    .filter(p => p.analysis && isUnderdogFlyer(p))
    .sort((a, b) => Math.abs(b.analysis!.differential) - Math.abs(a.analysis!.differential))
    .slice(0, 3);
}

/** Select parlays based on risk mode */
function selectParlays(parlays: ParlayRecommendation[], riskMode: RiskMode): ParlayRecommendation[] {
  const allowedCategories = PARLAY_CATEGORIES_BY_RISK[riskMode];
  return parlays.filter(p => allowedCategories.includes(p.category));
}

/** Distribute a budget across items weighted by score, respecting MIN_BET */
function distributeBudget(count: number, budget: number, weights: number[]): number[] {
  if (count === 0) return [];

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) {
    // Equal distribution
    const perBet = Math.floor(budget / count);
    const amounts = Array(count).fill(perBet);
    amounts[0] += budget - perBet * count; // remainder to first
    return amounts;
  }

  // Weighted distribution
  let amounts = weights.map(w => Math.max(MIN_BET, Math.round((w / totalWeight) * budget)));
  const total = amounts.reduce((s, a) => s + a, 0);
  // Adjust remainder
  const diff = budget - total;
  amounts[0] += diff;

  // If first bet went below MIN_BET after adjustment, redistribute
  if (amounts[0] < MIN_BET) {
    amounts = Array(count).fill(Math.floor(budget / count));
    amounts[0] += budget - Math.floor(budget / count) * count;
  }

  return amounts;
}

export function generateStrategy(
  picks: Pick[],
  parlays: ParlayRecommendation[],
  bankroll: number,
  riskMode: RiskMode,
): DailyStrategy {
  const split = ALLOCATION_SPLITS[riskMode];

  // Select bets
  const straightPicks = selectStraightBets(picks, riskMode);
  const underdogPicks = selectUnderdogFlyers(picks);
  const selectedParlays = selectParlays(parlays, riskMode);

  // Calculate budgets
  let straightBudget = Math.round(bankroll * split.straight);
  let parlayBudget = Math.round(bankroll * split.parlays);
  let underdogBudget = Math.round(bankroll * split.underdogs);

  // Redistribute if categories are empty
  if (underdogPicks.length === 0) {
    straightBudget += underdogBudget;
    underdogBudget = 0;
  }
  if (selectedParlays.length === 0) {
    straightBudget += parlayBudget;
    parlayBudget = 0;
  }
  if (straightPicks.length === 0) {
    parlayBudget += straightBudget;
    straightBudget = 0;
  }

  // Ensure total equals bankroll after rounding
  const totalAllocated = straightBudget + parlayBudget + underdogBudget;
  straightBudget += bankroll - totalAllocated;

  // Distribute within categories
  const straightWeights = straightPicks.map(p => Math.abs(p.analysis!.differential));
  const straightAmounts = distributeBudget(straightPicks.length, straightBudget, straightWeights);

  const parlayAmounts = distributeBudget(
    selectedParlays.length,
    parlayBudget,
    selectedParlays.map(() => 1), // equal weight for parlays
  );

  const underdogWeights = underdogPicks.map(p => Math.abs(p.analysis!.differential));
  const underdogAmounts = distributeBudget(underdogPicks.length, underdogBudget, underdogWeights);

  // Build straight bets
  const straightBets: StrategyBet[] = straightPicks.map((pick, i) => {
    const { type, label } = decideBetType(pick);
    const odds = getPickOdds(pick);
    return {
      type,
      wager: straightAmounts[i],
      pick,
      betLabel: label,
      reason: pick.analysis!.reasoning[0] || '',
      potentialReturn: calcReturn(odds, straightAmounts[i]),
    };
  });

  // Build parlay entries
  const strategyParlays: StrategyParlay[] = selectedParlays.map((parlay, i) => ({
    parlay,
    wager: parlayAmounts[i],
  }));

  // Build underdog flyers
  const underdogFlyers: StrategyBet[] = underdogPicks.map((pick, i) => {
    const odds = getPickOdds(pick);
    const oddsStr = odds > 0 ? `+${odds}` : `${odds}`;
    return {
      type: 'underdog_flyer' as const,
      wager: underdogAmounts[i],
      pick,
      betLabel: `ML ${oddsStr}`,
      reason: pick.analysis!.reasoning[0] || '',
      potentialReturn: calcReturn(odds, underdogAmounts[i]),
    };
  });

  // Calculate return ranges
  const allStraightReturns = straightBets.reduce((s, b) => s + b.potentialReturn, 0);
  const allUnderdogReturns = underdogFlyers.reduce((s, b) => s + b.potentialReturn, 0);
  // Rough parlay return estimate: assume ~3:1 for lock, ~6:1 for value, ~15:1 for longshot
  const parlayMultipliers: Record<string, number> = { lock: 3, value: 6, longshot: 15 };
  const allParlayReturns = strategyParlays.reduce(
    (s, p) => s + p.wager * (parlayMultipliers[p.parlay.category] ?? 3), 0,
  );

  // Expected: assume ~55% win rate on straights, ~20% on parlays, ~25% on underdogs
  const expectedStraight = allStraightReturns * 0.55;
  const expectedParlay = allParlayReturns * 0.20;
  const expectedUnderdog = allUnderdogReturns * 0.25;

  return {
    bankroll,
    riskMode,
    straightBets,
    parlays: strategyParlays,
    underdogFlyers,
    totalWagered: bankroll,
    potentialReturnRange: {
      low: Math.round(expectedStraight * 0.5),
      expected: Math.round(expectedStraight + expectedParlay + expectedUnderdog),
      high: Math.round(allStraightReturns + allParlayReturns + allUnderdogReturns),
    },
  };
}
