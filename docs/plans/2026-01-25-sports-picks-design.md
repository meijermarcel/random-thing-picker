# Sports Picks Feature - Design Document

Add a sports picks tab that pulls upcoming games and randomly picks sides for selected games.

## Overview

**Goal:** Let users select upcoming sports games and have the app randomly pick a team for each game (parlay-style picks).

**Sports Covered:** NFL, NBA, MLB, NHL, Premier League, Champions League

**Data Source:** ESPN unofficial API (free, no key required)

## Navigation Structure

Bottom tab navigation with two tabs:
- **Random Picker** (dice icon) - Existing functionality
- **Sports Picks** (football icon) - New sports feature

Uses `expo-router` tabs layout.

## Sports Picks Screen Layout

Top to bottom:
1. **Sport filter chips** - Horizontal scroll: All, NFL, NBA, MLB, NHL, Soccer
2. **Games list** - Scrollable list with checkboxes
3. **Pick Sides button** - Fixed at bottom, shows count

### Game Row

Each row displays:
- Team A vs Team B
- Date/time (local timezone)
- League badge
- Checkbox for selection

## API Integration

### ESPN Endpoints

| Sport | Endpoint |
|-------|----------|
| NFL | `football/nfl` |
| NBA | `basketball/nba` |
| MLB | `baseball/mlb` |
| NHL | `hockey/nhl` |
| Premier League | `soccer/eng.1` |
| Champions League | `soccer/uefa.champions` |

Base URL: `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`

### Data Fetching

- Fetch on mount and sport filter change
- No caching (always current)
- Combine results when "All" selected

## Selection & Results Flow

### Selection
- Tap game row to toggle checkbox
- Selected games get highlight
- Button shows count: "Pick Sides (3 games)"
- Button disabled when none selected

### Random Pick
1. For each selected game, randomly pick home or away (50/50)
2. Build picks array
3. Open results modal

### Results Modal

Same style as existing ResultModal:
- Header: "Your Picks"
- List of picks showing:
  - Team name (bold) - picked side
  - "vs" opponent (lighter)
  - League/time (small, gray)
- "Done" button to close

## Component Structure

### New Files

```
app/(tabs)/
  _layout.tsx         — Tab navigator setup
  index.tsx           — Random Picker (moved)
  sports.tsx          — Sports Picks screen

components/
  SportFilter.tsx     — Horizontal chip selector
  GameList.tsx        — List with checkboxes
  GameRow.tsx         — Single game row
  SportsPicksModal.tsx — Results modal
```

### Reused

- `PickButton.tsx` style for "Pick Sides"
- `ResultModal.tsx` pattern for results

### Dependencies

- No new packages (expo-router tabs already available)
- `@expo/vector-icons` for tab icons (included with Expo)

## State Management

All in sports screen component:
- `games: Game[]` — fetched games
- `selectedGameIds: Set<string>` — user selections
- `picks: Pick[] | null` — results (null = modal closed)
- `selectedSport: string` — current filter

## Edge Cases

### Loading
- Spinner while fetching
- Pull-to-refresh

### Errors
- "Couldn't load games" with retry button
- Graceful partial failure (show available sports)

### Empty States
- No games selected: button disabled
- No games for sport: "No upcoming {sport} games"

### Timezone
- API returns UTC
- Display in local timezone
- Show "Today", "Tomorrow", or date
