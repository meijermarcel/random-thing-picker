# Parlays Tab - Design Document

A new tab that automatically analyzes all games and generates recommended parlays across different strategies and sizes.

## Overview

**Problem:** The current Sports tab requires manually selecting games before analyzing. Sometimes users want the app to recommend which games to combine into parlays.

**Solution:** A dedicated Parlays tab that:
1. Fetches all games for a selected date
2. Analyzes them automatically
3. Generates parlay recommendations across different strategies
4. Lets users view and share the ones they like

## Parlay Categories

| Category | Description | Size | Selection Criteria |
|----------|-------------|------|-------------------|
| **Lock of the Day** | Safest bets | 2-3 legs | Highest confidence picks only |
| **Best Value** | Biggest edge | 3-4 legs | Largest gap vs. betting lines |
| **Sport Specials** | Themed by sport | 3-5 legs | Top picks from one sport |
| **Longshot** | High risk/reward | 5-7 legs | Medium confidence, variety |

## UI Structure

```
┌─────────────────────────────────────┐
│ [Date Selector - reuse existing]    │
├─────────────────────────────────────┤
│ 🔄 Analyzing 24 games...            │
├─────────────────────────────────────┤
│                                     │
│ 🔒 LOCK OF THE DAY                  │
│ ┌─────────────────────────────────┐ │
│ │ 2 legs • High confidence        │ │
│ │ Lakers ML, Celtics ML           │ │
│ │                          [View] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 💎 BEST VALUE                       │
│ ┌─────────────────────────────────┐ │
│ │ 3 legs • Strong edge            │ │
│ │ Heat ML, Knicks +4, Over 218    │ │
│ │                          [View] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 🏀 NBA SPECIAL                      │
│ ┌─────────────────────────────────┐ │
│ │ 4 legs • All basketball         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 🎰 LONGSHOT                         │
│ ┌─────────────────────────────────┐ │
│ │ 6 legs • High risk/reward       │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

Tapping "View" opens the existing betslip with that parlay pre-loaded.

## Parlay Generation Logic

### Lock of the Day
- Filter: Only `high` confidence picks
- Sort by: Highest analysis differential
- Select: Top 2-3 picks
- Skip if: Fewer than 2 high-confidence games

### Best Value
- Filter: `medium` or `high` confidence
- Sort by: Largest gap between projected margin and betting line
- Select: Top 3-4 picks
- Fallback: Use differential if no odds data

### Sport Specials
- Group games by sport (NBA, NFL, NCAAM, Soccer, etc.)
- For each sport with 3+ games: create parlay with top 3-5 picks
- Only show sports with enough games

### Longshot
- Filter: `medium` confidence (avoid low confidence)
- Select: 5-7 picks for higher payout potential
- Prioritize variety: mix of sports, pick types
- Skip if: Fewer than 5 medium+ confidence games

### Scaling Rules
- < 5 games: Show only Lock of the Day (if possible)
- 5-15 games: Show Lock + Best Value + Longshot
- 15+ games: Show all categories including Sport Specials

## Data Types

```typescript
interface ParlayRecommendation {
  id: string;
  category: 'lock' | 'value' | 'sport' | 'longshot';
  title: string;           // "Lock of the Day", "NBA Special"
  subtitle: string;        // "2 legs • High confidence"
  picks: Pick[];           // Reuse existing Pick type
  icon: string;            // Emoji for display
}
```

## File Structure

### New Files
```
app/(tabs)/parlays.tsx         — New tab screen
services/parlayBuilder.ts      — Parlay generation logic
components/ParlayCard.tsx      — Card component for recommendations
```

### Modified Files
```
app/(tabs)/_layout.tsx         — Add Parlays tab to navigation
```

### Reused (no changes)
- `services/espn.ts` — Fetch games
- `services/analysis.ts` — Analyze games
- `components/DateSelector.tsx` — Date picker
- `app/betslip.tsx` — View parlay details + share

## User Flow

1. User opens Parlays tab
2. Date selector shows (defaults to today)
3. App fetches all games for date
4. Loading state: "Analyzing X games..."
5. App runs analysis on all games
6. App generates parlay recommendations
7. User scrolls through recommendations
8. User taps "View" on one they like
9. Betslip opens with picks pre-loaded
10. User taps "Share" to copy to sportsbook
