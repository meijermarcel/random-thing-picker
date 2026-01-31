# Enhanced Analysis Accuracy - Design Document

Improve analysis accuracy by incorporating advanced stats, rest/schedule factors, head-to-head history, and injury impact.

## Overview

**Goal:** Make picks smarter by using richer data beyond basic win/loss records.

**Data Sources (ESPN API):**

| Data Type | Endpoint | What We Get |
|-----------|----------|-------------|
| Advanced Stats | `/teams/{id}/statistics` | PPG, FG%, 3P%, assists, turnovers, blocks, steals, rebounds |
| Schedule | `/teams/{id}/schedule` | Past games with dates, scores, opponents |
| Injuries | `/injuries` (league-wide) | Player status (Out/Day-To-Day), body part, expected return |

## New Analysis Factors

1. **Offensive/Defensive Efficiency** - Points scored, shooting %, assist-to-turnover ratio
2. **Rest Advantage** - Days since last game, back-to-back detection
3. **Head-to-Head** - Recent matchup results between the two teams
4. **Injury Impact** - Key players out (starters, high-minute players)

## Revised Weight Distribution

| Factor | Current | Proposed |
|--------|---------|----------|
| Win % | 30% | 15% |
| Home/Away | 25% | 15% |
| Recent Form | 25% | 15% |
| Scoring Margin | 20% | 10% |
| **Advanced Stats** | - | 20% |
| **Rest/Schedule** | - | 10% |
| **Head-to-Head** | - | 10% |
| **Injuries** | - | 5% |

## Data Architecture

### New Types

```typescript
interface AdvancedStats {
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

interface ScheduleContext {
  lastGameDate: Date | null;
  daysSinceLastGame: number;
  isBackToBack: boolean;
  gamesInLast7Days: number;
}

interface HeadToHead {
  recentMeetings: number;      // games in last 2 seasons
  wins: number;
  losses: number;
  avgPointDiff: number;        // positive = team outscored opponent
}

interface InjuryReport {
  playersOut: InjuredPlayer[];
  playersQuestionable: InjuredPlayer[];
  impactScore: number;         // 0-100, higher = more impact
}

interface InjuredPlayer {
  name: string;
  position: string;
  status: 'out' | 'day-to-day';
  minutesPerGame?: number;     // to gauge importance
}
```

### Extended TeamStats

The existing `TeamStats` interface gets extended with optional fields:

```typescript
interface TeamStats {
  // ... existing fields ...

  // New optional fields
  advanced?: AdvancedStats;
  schedule?: ScheduleContext;
  headToHead?: HeadToHead;     // populated per-matchup
  injuries?: InjuryReport;
}
```

This keeps backward compatibility - analysis works with basic stats if advanced data fails to load.

## Scoring Algorithm

### Advanced Stats Score (0-100)

```typescript
function calculateAdvancedScore(stats: AdvancedStats, league: string): number {
  // Normalize each stat against league averages
  const offenseScore = (
    normalize(stats.pointsPerGame, LEAGUE_AVG[league].ppg) * 0.35 +
    normalize(stats.fieldGoalPct, 0.46) * 0.25 +
    normalize(stats.assistToTurnoverRatio, 1.5) * 0.20 +
    normalize(stats.threePointPct, 0.36) * 0.20
  );

  const defenseScore = (
    normalize(stats.blocksPerGame, 5) * 0.35 +
    normalize(stats.stealsPerGame, 7) * 0.35 +
    normalize(stats.defensiveReboundsPerGame, 35) * 0.30
  );

  return (offenseScore * 0.6 + defenseScore * 0.4) * 100;
}
```

### Rest Score (0-100)

| Days Rest | Score |
|-----------|-------|
| 0 (back-to-back) | 30 |
| 1 | 45 |
| 2 | 60 |
| 3 | 75 |
| 4+ | 85 |

Bonus/penalty: Compare against opponent's rest. +10 if 2+ more days rest, -10 if 2+ fewer.

### Head-to-Head Score (0-100)

```typescript
function calculateH2HScore(h2h: HeadToHead): number {
  if (h2h.recentMeetings < 2) return 50; // not enough data

  const winRate = h2h.wins / h2h.recentMeetings;
  const marginFactor = Math.min(10, Math.max(-10, h2h.avgPointDiff)) / 10;

  return 50 + (winRate - 0.5) * 60 + marginFactor * 20;
}
```

### Injury Score (0-100)

- Start at 100 (fully healthy)
- Subtract based on players out:
  - Starter out: -15
  - Key rotation player out: -8
  - Role player out: -3
- Compare both teams: relative advantage/disadvantage

## Data Fetching

### New ESPN Service Functions

```typescript
// Fetch advanced team statistics
async function fetchAdvancedStats(
  sport: string,
  league: string,
  teamId: string
): Promise<AdvancedStats | null>

// Fetch team schedule for rest/H2H calculation
async function fetchTeamSchedule(
  sport: string,
  league: string,
  teamId: string
): Promise<ScheduleGame[]>

// Fetch league-wide injuries (cached per session)
async function fetchLeagueInjuries(
  sport: string,
  league: string
): Promise<Map<string, InjuryReport>>
```

### Derived Calculations

```typescript
// Calculate rest context from schedule
function calculateScheduleContext(
  schedule: ScheduleGame[],
  gameDate: Date
): ScheduleContext

// Extract H2H from both teams' schedules
function calculateHeadToHead(
  homeSchedule: ScheduleGame[],
  awaySchedule: ScheduleGame[],
  homeTeamId: string,
  awayTeamId: string
): HeadToHead

// Filter injuries for a specific team
function getTeamInjuries(
  allInjuries: Map<string, InjuryReport>,
  teamId: string
): InjuryReport
```

### Caching Strategy

| Data | Cache Duration | Reason |
|------|----------------|--------|
| Advanced stats | 6 hours | Changes slowly |
| Schedule | 1 hour | New games complete |
| Injuries | 30 minutes | Can change quickly |

All caches are in-memory for the session. No persistence needed.

## Integration

### Modified Files

```
services/
  espn.ts              + fetchAdvancedStats()
                       + fetchTeamSchedule()
                       + fetchLeagueInjuries()
                       + cache utilities

  analysis.ts          + calculateAdvancedScore()
                       + calculateRestScore()
                       + calculateH2HScore()
                       + calculateInjuryScore()
                       ~ analyzeGame() - use new factors
                       ~ WEIGHTS - updated distribution

types/
  sports.ts            + AdvancedStats
                       + ScheduleContext
                       + HeadToHead
                       + InjuryReport
                       + InjuredPlayer
                       ~ TeamStats - add optional fields
```

### Analysis Flow

```
analyzeGame(game)
  │
  ├─► Fetch in parallel:
  │     ├─ fetchTeamStats (existing)
  │     ├─ fetchAdvancedStats (home)
  │     ├─ fetchAdvancedStats (away)
  │     ├─ fetchTeamSchedule (home)
  │     ├─ fetchTeamSchedule (away)
  │     └─ fetchLeagueInjuries (cached)
  │
  ├─► Calculate derived data:
  │     ├─ scheduleContext (both teams)
  │     ├─ headToHead (from schedules)
  │     └─ injuries (filter by team)
  │
  ├─► Score each factor (0-100)
  │
  ├─► Apply weights, sum to composite
  │
  └─► Return PickAnalysis with richer reasoning
```

### Graceful Degradation

If any fetch fails, that factor uses neutral score (50) and is excluded from reasoning. The analysis still works with whatever data is available.

## Enhanced Reasoning Display

**New reasoning will include:**

```
┌─────────────────────────────────────────┐
│ NBA                      [Lakers by 6]  │
│ 🏠 Lakers vs ✈️ Celtics                 │
│─────────────────────────────────────────│
│ 📊 Confidence: High                     │
│                                         │
│ • Lakers shooting 48.5% vs 44.2%        │  ← Advanced
│ • Lakers 3 days rest, Celtics B2B       │  ← Rest
│ • Lakers 3-1 vs Celtics this season     │  ← H2H
│ • Celtics missing J. Tatum (knee)       │  ← Injury
│ • Lakers 8-2 at home                    │  ← Existing
└─────────────────────────────────────────┘
```

### Reasoning Priority

Show most impactful factors first (max 4-5 reasons):

1. Significant injury (starter out)
2. Large rest disparity (2+ days)
3. Strong H2H record (3+ games, 70%+ win rate)
4. Notable advanced stat edge (5%+ FG difference)
5. Existing factors (record, home/away, streak)

### Confidence Boost

When multiple new factors align, bump confidence:
- 3+ factors favor same team → +1 confidence level
- Major injury to opponent's star → +1 confidence level

## Edge Cases

| Situation | Handling |
|-----------|----------|
| Season start (no H2H yet) | Skip H2H factor, redistribute weight |
| Team with no injuries data | Assume healthy, neutral score |
| Back-to-back vs 4+ days rest | Cap rest advantage at +20 score |
| Star player "day-to-day" | Count as 50% impact (might play) |
| Sport without advanced stats | Fall back to existing algorithm |
| API rate limiting | Batch requests, respect cache |

## Sport-Specific Adjustments

- **NBA/NHL:** Rest matters most (82 games, frequent B2Bs)
- **NFL:** Rest matters less (weekly), injuries matter more
- **MLB:** Pitching matchup would be ideal (future enhancement)
- **Soccer:** Rest + injuries weighted higher

## Implementation Tasks

1. Add new types to `types/sports.ts`
2. Add cache utilities to `services/espn.ts`
3. Add `fetchAdvancedStats()`
4. Add `fetchTeamSchedule()`
5. Add `fetchLeagueInjuries()`
6. Add derived calculators (rest, H2H)
7. Add scoring functions to `analysis.ts`
8. Update `analyzeGame()` to use new factors
9. Update reasoning generation
10. Test with real games
