# Enhanced Analysis Accuracy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve pick accuracy by adding advanced stats, rest/schedule, head-to-head, and injury data to game analysis.

**Architecture:** Extend ESPN service with new fetch functions for advanced stats, schedules, and injuries. Add in-memory caching. Update analysis scoring with new weighted factors. Enhance reasoning display.

**Tech Stack:** TypeScript, React Native/Expo, ESPN public API

---

## Task 1: Add New Types

**Files:**
- Modify: `types/sports.ts`

**Step 1: Add AdvancedStats interface**

Add after `TeamStats` interface (line 58):

```typescript
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
```

**Step 2: Add ScheduleContext interface**

Add after `AdvancedStats`:

```typescript
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
```

**Step 3: Add HeadToHead interface**

Add after `ScheduleContext`:

```typescript
export interface HeadToHead {
  recentMeetings: number;
  wins: number;
  losses: number;
  avgPointDiff: number;
}
```

**Step 4: Add Injury interfaces**

Add after `HeadToHead`:

```typescript
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
```

**Step 5: Extend TeamStats with optional fields**

Modify `TeamStats` interface to add optional fields at the end:

```typescript
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
```

**Step 6: Commit**

```bash
git add types/sports.ts
git commit -m "feat: add types for advanced stats, schedule, H2H, injuries"
```

---

## Task 2: Add Cache Utilities

**Files:**
- Modify: `services/espn.ts`

**Step 1: Add cache infrastructure at top of file**

Add after imports (line 2):

```typescript
// Simple in-memory cache with TTL
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

// Cache TTLs
const CACHE_TTL = {
  ADVANCED_STATS: 6 * 60 * 60 * 1000,  // 6 hours
  SCHEDULE: 60 * 60 * 1000,             // 1 hour
  INJURIES: 30 * 60 * 1000,             // 30 minutes
};
```

**Step 2: Commit**

```bash
git add services/espn.ts
git commit -m "feat: add in-memory cache utilities for ESPN data"
```

---

## Task 3: Add fetchAdvancedStats Function

**Files:**
- Modify: `services/espn.ts`
- Modify: `types/sports.ts` (import)

**Step 1: Update imports in espn.ts**

Change line 1 from:
```typescript
import { Game, GameOdds, SportFilter, TeamStats } from '../types/sports';
```
to:
```typescript
import { Game, GameOdds, SportFilter, TeamStats, AdvancedStats, ScheduleGame, InjuredPlayer, InjuryReport } from '../types/sports';
```

**Step 2: Add fetchAdvancedStats function**

Add after `fetchTeamStats` function (after line 207):

```typescript
// Fetch advanced team statistics
export async function fetchAdvancedStats(
  sport: string,
  league: string,
  teamId: string
): Promise<AdvancedStats | null> {
  const cacheKey = `advanced-${sport}-${league}-${teamId}`;
  const cached = getCached<AdvancedStats>(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/statistics`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const stats = data.results?.stats || data.splits?.categories || [];

    // Helper to find stat by name
    const findStat = (name: string): number => {
      for (const category of stats) {
        const statList = category.stats || [];
        const stat = statList.find((s: any) =>
          s.name?.toLowerCase() === name.toLowerCase() ||
          s.displayName?.toLowerCase().includes(name.toLowerCase())
        );
        if (stat?.value !== undefined) return parseFloat(stat.value) || 0;
      }
      return 0;
    };

    const advanced: AdvancedStats = {
      pointsPerGame: findStat('avgPoints') || findStat('pointsPerGame'),
      fieldGoalPct: findStat('fieldGoalPct') || findStat('fgPct'),
      threePointPct: findStat('threePointFieldGoalPct') || findStat('3ptPct'),
      freeThrowPct: findStat('freeThrowPct') || findStat('ftPct'),
      assistsPerGame: findStat('avgAssists') || findStat('assistsPerGame'),
      turnoversPerGame: findStat('avgTurnovers') || findStat('turnoversPerGame'),
      assistToTurnoverRatio: findStat('assistTurnoverRatio'),
      offensiveReboundsPerGame: findStat('avgOffensiveRebounds'),
      blocksPerGame: findStat('avgBlocks') || findStat('blocksPerGame'),
      stealsPerGame: findStat('avgSteals') || findStat('stealsPerGame'),
      defensiveReboundsPerGame: findStat('avgDefensiveRebounds'),
    };

    // Only cache if we got meaningful data
    if (advanced.pointsPerGame > 0) {
      setCache(cacheKey, advanced, CACHE_TTL.ADVANCED_STATS);
    }

    return advanced;
  } catch {
    return null;
  }
}
```

**Step 3: Commit**

```bash
git add services/espn.ts
git commit -m "feat: add fetchAdvancedStats for team efficiency data"
```

---

## Task 4: Add fetchTeamSchedule Function

**Files:**
- Modify: `services/espn.ts`

**Step 1: Add fetchTeamSchedule function**

Add after `fetchAdvancedStats`:

```typescript
// Fetch team schedule for rest days and H2H calculation
export async function fetchTeamSchedule(
  sport: string,
  league: string,
  teamId: string
): Promise<ScheduleGame[]> {
  const cacheKey = `schedule-${sport}-${league}-${teamId}`;
  const cached = getCached<ScheduleGame[]>(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/schedule`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const events = data.events || [];

    const schedule: ScheduleGame[] = events.map((event: any) => {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors || [];
      const team = competitors.find((c: any) => c.id === teamId);
      const opponent = competitors.find((c: any) => c.id !== teamId);

      return {
        gameId: event.id,
        date: new Date(event.date),
        opponentId: opponent?.id || '',
        opponentName: opponent?.team?.displayName || 'Unknown',
        isHome: team?.homeAway === 'home',
        teamScore: team?.score ? parseInt(team.score, 10) : undefined,
        opponentScore: opponent?.score ? parseInt(opponent.score, 10) : undefined,
        completed: competition?.status?.type?.completed || false,
      };
    });

    setCache(cacheKey, schedule, CACHE_TTL.SCHEDULE);
    return schedule;
  } catch {
    return [];
  }
}
```

**Step 2: Commit**

```bash
git add services/espn.ts
git commit -m "feat: add fetchTeamSchedule for rest and H2H data"
```

---

## Task 5: Add fetchLeagueInjuries Function

**Files:**
- Modify: `services/espn.ts`

**Step 1: Add fetchLeagueInjuries function**

Add after `fetchTeamSchedule`:

```typescript
// Fetch league-wide injuries (cached)
export async function fetchLeagueInjuries(
  sport: string,
  league: string
): Promise<Map<string, InjuryReport>> {
  const cacheKey = `injuries-${sport}-${league}`;
  const cached = getCached<Map<string, InjuryReport>>(cacheKey);
  if (cached) return cached;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/injuries`;

  try {
    const response = await fetch(url);
    if (!response.ok) return new Map();

    const data = await response.json();
    const teams = data.teams || [];
    const injuryMap = new Map<string, InjuryReport>();

    for (const teamData of teams) {
      const teamId = teamData.team?.id;
      if (!teamId) continue;

      const injuries = teamData.injuries || [];
      const playersOut: InjuredPlayer[] = [];
      const playersQuestionable: InjuredPlayer[] = [];

      for (const injury of injuries) {
        const player: InjuredPlayer = {
          name: injury.athlete?.displayName || 'Unknown',
          position: injury.athlete?.position?.abbreviation || '',
          status: injury.status === 'Out' ? 'out' : 'day-to-day',
        };

        if (injury.status === 'Out') {
          playersOut.push(player);
        } else {
          playersQuestionable.push(player);
        }
      }

      // Calculate impact score based on number of injuries
      // Starters assumed to be first 5 listed (rough heuristic)
      const starterOut = playersOut.slice(0, 5).length;
      const rolePlayerOut = playersOut.slice(5).length;
      const impactScore = 100 - (starterOut * 15) - (rolePlayerOut * 5) - (playersQuestionable.length * 3);

      injuryMap.set(teamId, {
        playersOut,
        playersQuestionable,
        impactScore: Math.max(0, impactScore),
      });
    }

    setCache(cacheKey, injuryMap, CACHE_TTL.INJURIES);
    return injuryMap;
  } catch {
    return new Map();
  }
}
```

**Step 2: Commit**

```bash
git add services/espn.ts
git commit -m "feat: add fetchLeagueInjuries for injury reports"
```

---

## Task 6: Add Derived Calculators

**Files:**
- Modify: `services/espn.ts`

**Step 1: Add calculateScheduleContext function**

Add after `fetchLeagueInjuries`:

```typescript
import { ScheduleContext, HeadToHead } from '../types/sports';

// Calculate rest context from schedule
export function calculateScheduleContext(
  schedule: ScheduleGame[],
  gameDate: Date
): ScheduleContext {
  const completedGames = schedule
    .filter(g => g.completed && g.date < gameDate)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const lastGame = completedGames[0];
  const lastGameDate = lastGame?.date || null;

  let daysSinceLastGame = 7; // Default to well-rested
  if (lastGameDate) {
    const diffMs = gameDate.getTime() - lastGameDate.getTime();
    daysSinceLastGame = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  const sevenDaysAgo = new Date(gameDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const gamesInLast7Days = completedGames.filter(g => g.date >= sevenDaysAgo).length;

  return {
    lastGameDate,
    daysSinceLastGame,
    isBackToBack: daysSinceLastGame <= 1,
    gamesInLast7Days,
  };
}

// Calculate head-to-head record from schedules
export function calculateHeadToHead(
  teamSchedule: ScheduleGame[],
  opponentId: string
): HeadToHead {
  const meetings = teamSchedule.filter(
    g => g.completed && g.opponentId === opponentId
  );

  if (meetings.length === 0) {
    return { recentMeetings: 0, wins: 0, losses: 0, avgPointDiff: 0 };
  }

  let wins = 0;
  let losses = 0;
  let totalPointDiff = 0;

  for (const game of meetings) {
    if (game.teamScore !== undefined && game.opponentScore !== undefined) {
      const diff = game.teamScore - game.opponentScore;
      totalPointDiff += diff;
      if (diff > 0) wins++;
      else if (diff < 0) losses++;
    }
  }

  return {
    recentMeetings: meetings.length,
    wins,
    losses,
    avgPointDiff: meetings.length > 0 ? totalPointDiff / meetings.length : 0,
  };
}
```

**Step 2: Fix imports**

Update the import at line 1 to include the new types:

```typescript
import { Game, GameOdds, SportFilter, TeamStats, AdvancedStats, ScheduleGame, ScheduleContext, HeadToHead, InjuredPlayer, InjuryReport } from '../types/sports';
```

**Step 3: Commit**

```bash
git add services/espn.ts
git commit -m "feat: add schedule context and H2H calculators"
```

---

## Task 7: Add New Scoring Functions to Analysis

**Files:**
- Modify: `services/analysis.ts`

**Step 1: Update imports**

Change line 1 to:

```typescript
import { Game, GameOdds, TeamStats, AdvancedStats, ScheduleContext, HeadToHead, InjuryReport, PickAnalysis, PickType, Confidence, GameProjection } from '../types/sports';
```

**Step 2: Update WEIGHTS constant**

Replace the WEIGHTS constant (lines 4-9):

```typescript
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
```

**Step 3: Add league averages for normalization**

Add after HOME_ADVANTAGE (around line 28):

```typescript
// League average stats for normalization
const LEAGUE_AVG_STATS: Record<string, { ppg: number; fgPct: number; astTov: number }> = {
  'basketball': { ppg: 115, fgPct: 0.47, astTov: 1.7 },
  'football': { ppg: 22, fgPct: 0.60, astTov: 1.5 },
  'hockey': { ppg: 3, fgPct: 0.10, astTov: 1.0 },
  'baseball': { ppg: 4.5, fgPct: 0.25, astTov: 1.0 },
  'soccer': { ppg: 1.5, fgPct: 0.35, astTov: 1.0 },
};
```

**Step 4: Add calculateAdvancedScore function**

Add after `calculateMarginScore` function:

```typescript
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
```

**Step 5: Add calculateRestScore function**

Add after `calculateAdvancedScore`:

```typescript
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
```

**Step 6: Add calculateH2HScore function**

Add after `calculateRestScore`:

```typescript
// Calculate head-to-head score (0-100)
function calculateH2HScore(h2h: HeadToHead | undefined): number {
  if (!h2h || h2h.recentMeetings < 2) return 50; // Not enough data

  const winRate = h2h.wins / h2h.recentMeetings;
  const marginFactor = Math.min(10, Math.max(-10, h2h.avgPointDiff)) / 10;

  return Math.max(0, Math.min(100, 50 + (winRate - 0.5) * 60 + marginFactor * 20));
}
```

**Step 7: Add calculateInjuryScore function**

Add after `calculateH2HScore`:

```typescript
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
```

**Step 8: Commit**

```bash
git add services/analysis.ts
git commit -m "feat: add scoring functions for advanced stats, rest, H2H, injuries"
```

---

## Task 8: Update analyzeGame to Use New Factors

**Files:**
- Modify: `services/analysis.ts`

**Step 1: Update imports from espn.ts**

Update the import from espn.ts (line 2):

```typescript
import { fetchTeamStats, fetchAdvancedStats, fetchTeamSchedule, fetchLeagueInjuries, calculateScheduleContext, calculateHeadToHead, createBasicStats, ENDPOINTS } from './espn';
```

**Step 2: Replace the analyzeGame function**

Replace the entire `analyzeGame` function (around line 370-420):

```typescript
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

  const homeAdvancedScore = calculateAdvancedScore(homeAdvanced, game.sport);
  const awayAdvancedScore = calculateAdvancedScore(awayAdvanced, game.sport);

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
  const pickType: PickType = projection.projectedWinner === 'home' ? 'home' : 'away';

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
```

**Step 3: Commit**

```bash
git add services/analysis.ts
git commit -m "feat: update analyzeGame to use all new data factors"
```

---

## Task 9: Add Enhanced Reasoning Generation

**Files:**
- Modify: `services/analysis.ts`

**Step 1: Add generateEnhancedReasoning function**

Add before the `analyzeGame` function:

```typescript
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
```

**Step 2: Commit**

```bash
git add services/analysis.ts
git commit -m "feat: add enhanced reasoning with all analysis factors"
```

---

## Task 10: Manual Testing

**Step 1: Start the app**

```bash
cd /Users/marcelmeijer/Documents/rtp && npx expo start
```

**Step 2: Test checklist**

- [ ] Open Sports tab - should load games
- [ ] Select "Analyzed" mode (should be default now)
- [ ] Select a few games
- [ ] Tap "Analyze Games" button
- [ ] Verify betslip shows:
  - Projected scores
  - Confidence level
  - Enhanced reasoning (should include new factors like rest, injuries if applicable)

**Step 3: Verify no errors in console**

Check Expo logs for any fetch errors or TypeScript issues.

**Step 4: Final commit if all works**

```bash
git add -A
git commit -m "feat: complete enhanced analysis with advanced stats, rest, H2H, injuries"
```
