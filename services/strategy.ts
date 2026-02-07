import { Pick, RiskMode, StrategyBet, StrategyParlay, StrategyParlayLeg, DailyStrategy } from '../types/sports';

const ALLOCATION_SPLITS: Record<RiskMode, { straight: number; parlays: number; underdogs: number }> = {
  conservative: { straight: 0.85, parlays: 0.10, underdogs: 0.05 },
  balanced:     { straight: 0.65, parlays: 0.25, underdogs: 0.10 },
  aggressive:   { straight: 0.45, parlays: 0.35, underdogs: 0.20 },
};

const DAILY_BUDGET_PCT: Record<RiskMode, number> = {
  conservative: 0.15,
  balanced: 0.25,
  aggressive: 0.40,
};

const WIN_RATES: Record<string, number> = {
  high: 0.60,
  medium: 0.52,
  low: 0.45,
};

// ML odds threshold: anything more juiced than this uses spread instead (parlay legs only)
const ML_JUICE_THRESHOLD = -150;

/** Calculate potential return from American odds and wager */
function calcReturn(odds: number, wager: number): number {
  if (odds > 0) return wager * (odds / 100);
  return wager * (100 / Math.abs(odds));
}

/** Convert American odds to decimal */
function toDecimal(odds: number): number {
  if (odds > 0) return 1 + odds / 100;
  return 1 + 100 / Math.abs(odds);
}

/** Check if a pick is for a soccer match */
function isSoccer(pick: Pick): boolean {
  return pick.game.sport === 'soccer';
}

/** Get the relevant ML odds for a pick */
function getPickOdds(pick: Pick): number {
  const odds = pick.game.odds;
  if (!odds) return -110;
  if (pick.pickType === 'draw') return odds.drawMoneyline ?? 250;
  if (pick.pickType === 'home') return odds.homeMoneyline ?? -110;
  if (pick.pickType === 'away') return odds.awayMoneyline ?? -110;
  return -110;
}

/** Convert American odds to implied probability */
function impliedProb(odds: number): number {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

/** Decide whether a pick should be a spread or ML bet for straights.
 *  Uses the backend's optimized spread_pick when available.
 *  Soccer always uses 3-way ML (no spreads). */
function decideBetType(pick: Pick): { type: 'straight_spread' | 'straight_ml'; label: string } {
  const analysis = pick.analysis;
  const odds = pick.game.odds;

  // Soccer: always use 3-way ML (home/draw/away), never spread
  if (isSoccer(pick)) {
    const mlOdds = getPickOdds(pick);
    const oddsStr = mlOdds > 0 ? `+${mlOdds}` : `${mlOdds}`;
    if (pick.pickType === 'draw') {
      return { type: 'straight_ml', label: `Draw ${oddsStr}` };
    }
    const team = pick.pickType === 'home' ? pick.game.homeTeam : pick.game.awayTeam;
    return { type: 'straight_ml', label: `${team} ${oddsStr}` };
  }

  if (analysis?.spreadPick && odds?.spread != null) {
    const spreadVal = analysis.spreadPick === 'home' ? odds.spread : -odds.spread;
    const spreadStr = spreadVal > 0 ? `+${spreadVal}` : `${spreadVal}`;
    return { type: 'straight_spread', label: `Spread ${spreadStr}` };
  }

  const mlOdds = pick.pickType === 'home' ? odds?.homeMoneyline : odds?.awayMoneyline;
  const oddsStr = mlOdds != null ? (mlOdds > 0 ? `+${mlOdds}` : `${mlOdds}`) : '';
  return { type: 'straight_ml', label: `ML ${oddsStr}`.trim() };
}

/** Decide the best bet type for a parlay leg.
 *  Heavy ML favorites (> threshold) get converted to spreads for better value.
 *  Soccer always uses 3-way ML. */
function decideParlayLeg(pick: Pick): StrategyParlayLeg {
  const mlOdds = getPickOdds(pick);
  const odds = pick.game.odds;

  // Soccer: always 3-way ML
  if (isSoccer(pick)) {
    const label = pick.pickType === 'draw'
      ? `Draw ${mlOdds > 0 ? `+${mlOdds}` : mlOdds}`
      : `${pick.pickType === 'home' ? pick.game.homeTeam : pick.game.awayTeam} ${mlOdds > 0 ? `+${mlOdds}` : mlOdds}`;
    return { pick, betType: 'ml', odds: mlOdds, label };
  }

  const team = pick.pickType === 'home' ? pick.game.homeTeam : pick.game.awayTeam;

  // If ML odds are too juiced, use spread instead
  if (mlOdds < ML_JUICE_THRESHOLD && odds?.spread != null) {
    const spreadSide = pick.analysis?.spreadPick ?? pick.pickType;
    const spreadVal = spreadSide === 'home' ? odds.spread : -odds.spread;
    const spreadStr = spreadVal > 0 ? `+${spreadVal}` : `${spreadVal}`;
    return {
      pick,
      betType: 'spread',
      odds: -110,
      label: `${team} ${spreadStr}`,
    };
  }

  // ML odds are reasonable, use ML
  const oddsStr = mlOdds > 0 ? `+${mlOdds}` : `${mlOdds}`;
  return {
    pick,
    betType: 'ml',
    odds: mlOdds,
    label: `${team} ${oddsStr}`,
  };
}

/** Calculate combined parlay return from legs */
function calcParlayReturn(legs: StrategyParlayLeg[], wager: number): number {
  let combined = 1;
  for (const leg of legs) {
    combined *= toDecimal(leg.odds);
  }
  return wager * (combined - 1);
}

/** Check if a pick qualifies as a true underdog flyer (low confidence, big plus-money) */
function isUnderdogFlyer(pick: Pick): boolean {
  const odds = getPickOdds(pick);
  const confidence = pick.analysis?.confidence;
  return odds > 200 && confidence === 'low';
}

/** Check if a pick is a plus-money value play (medium/high confidence at plus odds) */
function isValueUnderdog(pick: Pick): boolean {
  const odds = getPickOdds(pick);
  const confidence = pick.analysis?.confidence;
  return odds > 150 && (confidence === 'medium' || confidence === 'high');
}

/** Select and rank straight bets from picks — includes value underdogs with higher weighting */
function selectStraightBets(picks: Pick[], riskMode: RiskMode, maxBets: number): Pick[] {
  const minConfidence = riskMode === 'aggressive' ? 'low' : 'medium';
  const confidenceOrder = { high: 3, medium: 2, low: 1 };

  const standard = picks
    .filter(p => p.analysis && !isUnderdogFlyer(p))
    .filter(p => confidenceOrder[p.analysis!.confidence] >= confidenceOrder[minConfidence]);

  return standard
    .sort((a, b) => {
      // Value underdogs (medium/high confidence at plus-money) get a boost
      const aBoost = isValueUnderdog(a) ? 1.5 : 1;
      const bBoost = isValueUnderdog(b) ? 1.5 : 1;
      return (Math.abs(b.analysis!.differential) * bBoost) - (Math.abs(a.analysis!.differential) * aBoost);
    })
    .slice(0, maxBets);
}

/** Select underdog flyers from picks (low confidence, odds > +200 only) */
function selectUnderdogFlyers(picks: Pick[]): Pick[] {
  return picks
    .filter(p => p.analysis && isUnderdogFlyer(p))
    .sort((a, b) => Math.abs(b.analysis!.differential) - Math.abs(a.analysis!.differential))
    .slice(0, 3);
}

/** Build smart parlays from individual picks, using spread for heavy favorites.
 *  Ensures no game appears in more than one parlay. Caps all parlays at 4 legs. */
function buildParlays(picks: Pick[], riskMode: RiskMode): { title: string; icon: string; legs: StrategyParlayLeg[] }[] {
  const confidenceOrder = { high: 3, medium: 2, low: 1 };

  const eligible = picks
    .filter(p => p.analysis)
    .sort((a, b) => {
      const confDiff = confidenceOrder[b.analysis!.confidence] - confidenceOrder[a.analysis!.confidence];
      if (confDiff !== 0) return confDiff;
      return Math.abs(b.analysis!.differential) - Math.abs(a.analysis!.differential);
    });

  if (eligible.length < 2) return [];

  const parlays: { title: string; icon: string; legs: StrategyParlayLeg[] }[] = [];
  const usedGameIds = new Set<string>();

  // "Lock" parlay: top 3-4 high/medium confidence picks
  const lockCandidates = eligible.filter(p => p.analysis!.confidence !== 'low' && !usedGameIds.has(p.game.id));
  const lockPicks = lockCandidates.slice(0, 3);
  if (lockPicks.length >= 2) {
    lockPicks.forEach(p => usedGameIds.add(p.game.id));
    parlays.push({
      title: 'Lock of the Day',
      icon: '\uD83D\uDD12',
      legs: lockPicks.map(decideParlayLeg),
    });
  }

  // "Best Value" parlay: up to 4 picks with decent confidence, no overlap
  if (riskMode !== 'conservative') {
    const valueCandidates = eligible.filter(p => p.analysis!.confidence !== 'low' && !usedGameIds.has(p.game.id));
    const valuePicks = valueCandidates.slice(0, 4);
    if (valuePicks.length >= 3) {
      valuePicks.forEach(p => usedGameIds.add(p.game.id));
      parlays.push({
        title: 'Best Value',
        icon: '\uD83D\uDC8E',
        legs: valuePicks.map(decideParlayLeg),
      });
    }
  }

  // "Longshot" parlay: up to 4 picks including lower confidence, no overlap
  if (riskMode === 'aggressive') {
    const longshotCandidates = eligible.filter(p => !usedGameIds.has(p.game.id));
    const longshotPicks = longshotCandidates.slice(0, 4);
    if (longshotPicks.length >= 2) {
      longshotPicks.forEach(p => usedGameIds.add(p.game.id));
      parlays.push({
        title: 'Longshot',
        icon: '\uD83C\uDFAF',
        legs: longshotPicks.map(decideParlayLeg),
      });
    }
  }

  return parlays;
}

/** Calculate expected value for a single bet */
function calcEV(winProb: number, potentialProfit: number, wager: number): number {
  return (winProb * potentialProfit) - ((1 - winProb) * wager);
}

/** Calculate parlay EV from legs */
function calcParlayEV(legs: StrategyParlayLeg[], wager: number): number {
  let combinedWinProb = 1;
  for (const leg of legs) {
    const confidence = leg.pick.analysis?.confidence ?? 'medium';
    combinedWinProb *= WIN_RATES[confidence];
  }
  const payout = calcParlayReturn(legs, wager);
  return (combinedWinProb * payout) - ((1 - combinedWinProb) * wager);
}

/** Distribute a budget across items weighted by score, respecting minBet */
function distributeBudget(count: number, budget: number, weights: number[], minBet: number): number[] {
  if (count === 0 || budget <= 0) return [];

  // If budget can't cover minBet for all items, reduce count
  const affordableCount = Math.min(count, Math.floor(budget / minBet));
  if (affordableCount === 0) {
    // Budget is too small even for one minBet — give everything to first item
    return [budget];
  }

  const n = affordableCount;
  const totalWeight = weights.slice(0, n).reduce((sum, w) => sum + w, 0);

  if (totalWeight === 0) {
    const perBet = Math.floor(budget / n);
    const amounts = Array(n).fill(perBet);
    amounts[0] += budget - perBet * n;
    return amounts;
  }

  const slicedWeights = weights.slice(0, n);
  let amounts = slicedWeights.map(w => Math.max(minBet, Math.round((w / totalWeight) * budget)));
  const total = amounts.reduce((s, a) => s + a, 0);
  const diff = budget - total;
  // Spread remainder across largest bet first
  amounts[0] += diff;

  // Safety: if first element went negative, fall back to equal distribution
  if (amounts[0] < minBet) {
    const perBet = Math.floor(budget / n);
    amounts = Array(n).fill(perBet);
    amounts[0] += budget - perBet * n;
  }

  return amounts;
}

export function generateStrategy(
  picks: Pick[],
  _parlays: unknown[], // no longer used — we build our own
  bankroll: number,
  riskMode: RiskMode,
): DailyStrategy {
  const split = ALLOCATION_SPLITS[riskMode];

  // Daily budget: only risk a portion of bankroll
  const dailyBudget = Math.round(bankroll * DAILY_BUDGET_PCT[riskMode]);

  // Dynamic MIN_BET and MAX_STRAIGHT_BETS based on daily budget
  const minBet = Math.max(2, Math.floor(dailyBudget * 0.05));
  const maxStraightBets = Math.min(8, Math.max(3, Math.floor(dailyBudget / minBet)));

  // Select bets
  let straightPicks = selectStraightBets(picks, riskMode, maxStraightBets);
  let underdogPicks = selectUnderdogFlyers(picks);
  const builtParlays = buildParlays(picks, riskMode);

  // Calculate budgets from daily budget (not full bankroll)
  let straightBudget = Math.round(dailyBudget * split.straight);
  let parlayBudget = Math.round(dailyBudget * split.parlays);
  let underdogBudget = Math.round(dailyBudget * split.underdogs);

  // Redistribute if categories are empty
  if (underdogPicks.length === 0) {
    straightBudget += underdogBudget;
    underdogBudget = 0;
  }
  if (builtParlays.length === 0) {
    straightBudget += parlayBudget;
    parlayBudget = 0;
  }
  if (straightPicks.length === 0) {
    parlayBudget += straightBudget;
    straightBudget = 0;
  }
  // Clear underdogs if budget ended up at 0 after redistribution
  if (underdogBudget === 0) {
    underdogPicks = [];
  }

  const totalAllocated = straightBudget + parlayBudget + underdogBudget;
  straightBudget += dailyBudget - totalAllocated;

  // Cap bet counts so each bet gets at least minBet
  const maxStraight = Math.max(1, Math.floor(straightBudget / minBet));
  if (straightPicks.length > maxStraight) straightPicks = straightPicks.slice(0, maxStraight);
  const maxUnderdog = Math.max(1, Math.floor(underdogBudget / minBet));
  if (underdogPicks.length > maxUnderdog) underdogPicks = underdogPicks.slice(0, maxUnderdog);

  // Distribute within categories — then truncate picks to match amounts length
  const straightWeights = straightPicks.map(p => Math.abs(p.analysis!.differential));
  const straightAmounts = distributeBudget(straightPicks.length, straightBudget, straightWeights, minBet);
  straightPicks = straightPicks.slice(0, straightAmounts.length);

  const parlayAmounts = distributeBudget(
    builtParlays.length,
    parlayBudget,
    builtParlays.map(() => 1),
    minBet,
  );
  const finalParlays = builtParlays.slice(0, parlayAmounts.length);

  const underdogWeights = underdogPicks.map(p => Math.abs(p.analysis!.differential));
  const underdogAmounts = distributeBudget(underdogPicks.length, underdogBudget, underdogWeights, minBet);
  underdogPicks = underdogPicks.slice(0, underdogAmounts.length);

  // Build straight bets
  const straightBets: StrategyBet[] = straightPicks.map((pick, i) => {
    const { type, label } = decideBetType(pick);
    const odds = type === 'straight_spread' ? -110 : getPickOdds(pick);
    return {
      type,
      wager: straightAmounts[i],
      pick,
      betLabel: label,
      reason: pick.analysis!.reasoning[0] || '',
      potentialReturn: calcReturn(odds, straightAmounts[i]),
    };
  });

  // Build parlay entries with calculated returns
  const strategyParlays: StrategyParlay[] = finalParlays.map((p, i) => ({
    title: p.title,
    icon: p.icon,
    legs: p.legs,
    wager: parlayAmounts[i],
    potentialReturn: calcParlayReturn(p.legs, parlayAmounts[i]),
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

  // Calculate proper expected values
  let expectedTotal = 0;

  for (const bet of straightBets) {
    const confidence = bet.pick.analysis?.confidence ?? 'medium';
    const winProb = WIN_RATES[confidence];
    expectedTotal += calcEV(winProb, bet.potentialReturn, bet.wager);
  }

  for (const parlay of strategyParlays) {
    expectedTotal += calcParlayEV(parlay.legs, parlay.wager);
  }

  for (const bet of underdogFlyers) {
    const confidence = bet.pick.analysis?.confidence ?? 'low';
    const winProb = WIN_RATES[confidence];
    expectedTotal += calcEV(winProb, bet.potentialReturn, bet.wager);
  }

  const allReturns = straightBets.reduce((s, b) => s + b.potentialReturn, 0)
    + strategyParlays.reduce((s, p) => s + p.potentialReturn, 0)
    + underdogFlyers.reduce((s, b) => s + b.potentialReturn, 0);

  return {
    bankroll,
    dailyBudget,
    riskMode,
    straightBets,
    parlays: strategyParlays,
    underdogFlyers,
    totalWagered: straightBets.reduce((s, b) => s + b.wager, 0)
      + strategyParlays.reduce((s, p) => s + p.wager, 0)
      + underdogFlyers.reduce((s, b) => s + b.wager, 0),
    potentialReturnRange: {
      low: Math.max(0, expectedTotal * 0.5),
      expected: expectedTotal,
      high: allReturns,
    },
  };
}
