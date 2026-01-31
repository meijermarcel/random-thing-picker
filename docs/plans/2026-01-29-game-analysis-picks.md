# Game Analysis Picks Feature - Design Document

Add analysis-based picking functionality to the Sports tab, allowing users to get picks based on team statistics and performance data rather than pure randomness.

## Overview

**Goal:** Let users choose between random picks and analysis-based picks. Analysis picks consider team statistics, recent performance, and matchup factors to recommend picks with reasoning.

**Data Sources:**
- ESPN API - Team records, standings, recent games
- Calculated metrics - Win percentages, form, home/away splits

## User Experience

### Pick Mode Selection

Users will see a toggle/segmented control to switch between:
- **Random** - Current functionality (50/50 picks)
- **Analyzed** - Stats-based recommendations

### Analysis Display

When using analyzed picks, each pick will include:
- The recommended pick (team/side)
- Confidence indicator (Low/Medium/High)
- Brief reasoning summary (e.g., "Warriors 10-2 at home, Celtics 2-5 on road")

## Data Architecture

### Team Statistics

Statistics fetched per team:
```typescript
interface TeamStats {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  pointsFor: number;      // average or total
  pointsAgainst: number;
  streak: number;         // positive = wins, negative = losses
  last5: string;          // e.g., "W-W-L-W-W"
}
```

### Analysis Result

```typescript
interface PickAnalysis {
  pickType: PickType;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string[];    // Array of factors
  homeScore: number;      // Composite score 0-100
  awayScore: number;      // Composite score 0-100
}
```

## Analysis Algorithm

### Factors Considered

1. **Win Percentage (30% weight)**
   - Overall win rate
   - Higher win% = stronger team

2. **Home/Away Splits (25% weight)**
   - Home team's home record
   - Away team's road record
   - Home advantage matters

3. **Recent Form (25% weight)**
   - Last 5 games performance
   - Hot/cold streaks

4. **Scoring Margin (20% weight)**
   - Points for vs points against
   - Indicates dominance level

### Scoring System

Each team gets a composite score (0-100) based on weighted factors:

```
homeScore = (
  winPct * 30 +
  homeWinPct * 25 +
  recentFormScore * 25 +
  marginScore * 20
)

awayScore = (
  winPct * 30 +
  awayWinPct * 25 +
  recentFormScore * 25 +
  marginScore * 20
)
```

### Pick Selection

Based on score differential:
- Differential < 5 points → **Low confidence**
- Differential 5-15 points → **Medium confidence**
- Differential > 15 points → **High confidence**

Recommended pick = team with higher score

### Pick Type Logic

For moneyline (straight up winner):
- Pick the team with higher composite score

For spread/cover:
- Consider if favorite's margin warrants covering
- Underdogs with good recent form get bump

For over/under:
- Compare combined scoring averages
- High-scoring offenses + weak defenses = over

## ESPN API Endpoints

### Team Standings/Records
```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/standings
```

### Team Info
```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{teamId}
```

### Scoreboard (includes competitor records)
```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard
```

The scoreboard endpoint already returns some team stats in the competitor object:
- `records[0].summary` - Overall record like "10-5"
- Recent game results may be available

## Component Structure

### New Files

```
services/
  analysis.ts           — Analysis logic and calculations

components/
  PickModeSelector.tsx  — Random vs Analyzed toggle

types/
  sports.ts             — Add TeamStats, PickAnalysis types
```

### Modified Files

```
services/
  espn.ts               — Add fetchTeamStats function

app/(tabs)/
  sports.tsx            — Add mode selector, use analysis

app/
  betslip.tsx           — Show analysis reasoning

components/
  GameRow.tsx           — Optional: show mini stats
```

## State Management

Add to sports screen:
```typescript
const [pickMode, setPickMode] = useState<'random' | 'analyzed'>('random');
const [analyzing, setAnalyzing] = useState(false);
```

## UI Components

### PickModeSelector

Segmented control with two options:
```
┌─────────────────────────────────────┐
│ [ 🎲 Random ]  [ 📊 Analyzed ]      │
└─────────────────────────────────────┘
```

### Updated Betslip Card

When using analyzed picks:
```
┌─────────────────────────────────────┐
│ NBA                    [Lakers ML]  │
│ 🏠 Lakers                           │
│ ✈️ Celtics                          │
│─────────────────────────────────────│
│ 📊 Confidence: High                 │
│ • Lakers 8-2 at home                │
│ • Celtics 3-6 on road               │
│ • Lakers on 4-game win streak       │
└─────────────────────────────────────┘
```

## Implementation Tasks

1. **Update Types** - Add TeamStats, PickAnalysis, AnalyzedPick
2. **Update ESPN Service** - Parse team records from scoreboard data
3. **Create Analysis Service** - Implement scoring algorithm
4. **Add PickModeSelector** - Toggle component
5. **Update Sports Screen** - Wire up mode toggle
6. **Update Betslip** - Show analysis when applicable
7. **Testing** - Verify both modes work

## Edge Cases

### Missing Data
- If stats unavailable for a team, fall back to 50/50
- Show warning: "Limited data available"

### Equal Scores
- If teams have identical scores, pick home team (home advantage)
- Mark as "Low confidence - toss-up"

### Caching
- Cache team stats for duration of session
- Reduce API calls for multiple game analyses

## Future Enhancements

1. **Head-to-head history** - Past matchup results
2. **Injury reports** - Factor in missing players
3. **Weather** - For outdoor sports (NFL, MLB)
4. **Line movement** - Track betting line changes
5. **Custom weights** - Let users adjust factor importance
