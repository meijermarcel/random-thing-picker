# RTP API Backend Design

## Overview

Move from a client-only architecture to a client-server model where a Python API handles all data fetching, analysis, and persistence. This enables tracking pick performance over time and iterating on the analysis algorithm based on real results.

## Goals

1. **Track performance** - Record all picks with predicted vs actual outcomes
2. **Improve the algorithm** - Use historical data to tune confidence levels, weights, and sport-specific adjustments
3. **Centralize logic** - Algorithm changes deploy once, all users get updates immediately

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   RTP Mobile    │────▶│   Python API    │────▶│    Supabase     │
│   (Expo App)    │◀────│   (FastAPI)     │◀────│   (PostgreSQL)  │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    ESPN API     │
                        │  (Data Source)  │
                        └─────────────────┘
```

### Components

1. **RTP Mobile App** - UI layer only. Fetches data from the API, displays games/picks/parlays, sends user selections to API.

2. **Python API (FastAPI)** - The brain. Hosted on Railway.
   - Fetches game data from ESPN
   - Runs analysis algorithm (ported from current TypeScript)
   - Generates picks and parlays
   - Stores everything in Supabase
   - Background job polls ESPN for final scores
   - Exposes endpoints for the app + future dashboard

3. **Supabase** - PostgreSQL database for persistence.
   - Games, teams, picks, results, performance metrics
   - Auth when ready for multi-user

4. **ESPN API** - External data source (unchanged from today, just called from API instead of app)

## Data Model

### Core Tables

```sql
-- Teams (cached from ESPN)
teams (
  id uuid PRIMARY KEY,
  espn_id text UNIQUE NOT NULL,
  name text NOT NULL,
  abbreviation text NOT NULL,
  sport text NOT NULL,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Games
games (
  id uuid PRIMARY KEY,
  espn_id text UNIQUE NOT NULL,
  sport text NOT NULL,
  home_team_id uuid REFERENCES teams(id),
  away_team_id uuid REFERENCES teams(id),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled, in_progress, final
  home_score_actual int,
  away_score_actual int,
  espn_data jsonb, -- raw ESPN response for reference
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Picks (one per game per algorithm version)
picks (
  id uuid PRIMARY KEY,
  game_id uuid REFERENCES games(id),
  predicted_winner_id uuid REFERENCES teams(id),
  home_score_predicted int NOT NULL,
  away_score_predicted int NOT NULL,
  confidence text NOT NULL, -- low, medium, high
  confidence_score float NOT NULL, -- 0-100
  analysis_factors jsonb NOT NULL, -- what drove the pick
  algorithm_version text NOT NULL,
  was_correct boolean, -- filled after game ends
  score_diff_error float, -- predicted vs actual margin
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, algorithm_version)
)

-- Parlays
parlays (
  id uuid PRIMARY KEY,
  type text NOT NULL, -- lock_of_day, best_value, longshot, etc.
  pick_ids uuid[] NOT NULL,
  total_confidence float NOT NULL,
  all_correct boolean, -- filled after all games end
  created_at timestamptz DEFAULT now()
)
```

### Performance Tracking Tables

```sql
-- Algorithm versions
algorithm_versions (
  id uuid PRIMARY KEY,
  version text UNIQUE NOT NULL,
  config jsonb NOT NULL, -- weights, thresholds, etc.
  deployed_at timestamptz DEFAULT now(),
  notes text
)

-- Daily rollup for quick stats
daily_performance (
  id uuid PRIMARY KEY,
  date date NOT NULL,
  algorithm_version text NOT NULL,
  sport text, -- null for all sports
  total_picks int NOT NULL,
  correct_picks int NOT NULL,
  accuracy_pct float NOT NULL,
  avg_confidence_score float NOT NULL,
  avg_score_error float NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(date, algorithm_version, sport)
)
```

## API Endpoints

### Game & Pick Endpoints (for the app)

```
GET  /games
     ?date=2026-01-31
     ?sport=NFL,NBA
     → Returns games with picks already generated

GET  /games/{game_id}
     → Single game with full analysis details

GET  /picks
     ?date=2026-01-31
     ?sport=NFL
     ?confidence=high
     → Filter picks by various criteria

GET  /parlays
     ?date=2026-01-31
     ?type=lock_of_day
     → Pre-generated parlay recommendations

POST /parlays/custom
     { "leg_count": 4, "sports": ["NFL", "NBA"] }
     → Generate custom parlay on demand
```

### Performance & Stats Endpoints (for dashboard)

```
GET  /stats/accuracy
     ?start_date=2026-01-01
     ?end_date=2026-01-31
     ?sport=NFL
     → Accuracy breakdown by sport, confidence level

GET  /stats/calibration
     → Are high-confidence picks actually more accurate?

GET  /stats/algorithm/{version}
     → Performance metrics for specific algorithm version
```

### Admin Endpoints (for algorithm management)

```
GET  /algorithm/current
     → Current weights and config

POST /algorithm/deploy
     { "version": "1.1.0", "config": {...} }
     → Deploy new algorithm version

GET  /algorithm/compare?v1=1.0.0&v2=1.1.0
     → Compare performance between versions
```

## Background Jobs

### Job 1: Fetch Games (every 6 hours)
- Pull upcoming games from ESPN for next 3 days
- Create/update game records in database
- Run analysis algorithm on new games
- Generate picks and store them
- Generate parlay recommendations

### Job 2: Update Results (every 15 minutes)
- Query games with status = 'scheduled' or 'in_progress'
- Check ESPN for final scores
- Update game records with actual scores
- For completed games:
  - Calculate `was_correct` on each pick
  - Calculate `score_diff_error` (predicted margin vs actual)
  - Update parlay `all_correct` status

### Job 3: Daily Performance Rollup (midnight)
- Aggregate yesterday's picks into daily_performance table
- Calculate accuracy by sport, by confidence level
- Compare against previous algorithm versions

**Implementation:** FastAPI with APScheduler. Can upgrade to Celery later if needed.

## Algorithm Structure

### Config (stored in database)

```json
{
  "version": "1.0.0",
  "weights": {
    "win_percentage": 0.25,
    "home_away_splits": 0.15,
    "recent_form": 0.20,
    "head_to_head": 0.10,
    "rest_days": 0.10,
    "efficiency_rating": 0.20
  },
  "confidence_thresholds": {
    "high": 75,
    "medium": 55,
    "low": 0
  },
  "sport_adjustments": {
    "NFL": { "home_advantage": 3.0 },
    "NBA": { "home_advantage": 2.5 },
    "MLB": { "home_advantage": 1.5 }
  }
}
```

### Analysis Flow

1. Load game data from ESPN (team stats, injuries, schedule)
2. Calculate each factor score (0-100) for both teams
3. Apply weights from config to get composite score
4. Calculate predicted scores using sport-specific models
5. Determine confidence level from thresholds
6. Store pick with `analysis_factors` JSON showing what drove the decision

### Tuning Workflow

1. Review performance stats → notice NBA high-confidence picks underperforming
2. Adjust `weights` or `sport_adjustments` for NBA
3. Deploy new version via `/algorithm/deploy`
4. Track new version's performance separately
5. Compare versions with `/algorithm/compare`

## Mobile App Changes

### Remove from app
- `services/espn.ts` - API handles ESPN now
- `services/analysis.ts` - analysis runs server-side
- `services/parlayBuilder.ts` - parlays generated server-side
- All caching logic - API handles caching

### New API service

```typescript
// services/api.ts
const API_BASE = 'https://your-api.railway.app';

export async function getGames(date: string, sports?: string[]) {
  const params = new URLSearchParams({ date });
  if (sports) params.append('sports', sports.join(','));
  const res = await fetch(`${API_BASE}/games?${params}`);
  return res.json();
}

export async function getParlays(date: string, type?: string) { ... }
export async function createCustomParlay(legCount: number, sports: string[]) { ... }
export async function getStats(startDate: string, endDate: string) { ... }
```

### What stays the same
- All UI components (GameRow, ParlayCard, etc.)
- Navigation structure (tabs, modals)
- Types (minor updates to match API responses)

### New opportunity
Add a "Stats" tab showing pick accuracy over time, powered by `/stats` endpoints.

## Error Handling

### API-level

| Scenario | Handling |
|----------|----------|
| ESPN unavailable | Return cached games (up to 6 hours old) with stale flag, retry with backoff |
| Database unavailable | Return 503 with retry-after header |
| Analysis fails for a game | Log error, skip that game, continue with others |

### App-level

| Scenario | Handling |
|----------|----------|
| API unavailable | Show cached data (AsyncStorage), display offline banner |
| Slow responses | 10-second timeout, loading states, skeleton loaders |

### Data Integrity

- ESPN game IDs are unique keys (no duplicates)
- Picks generated once per game per algorithm version
- Only mark games final when ESPN status = "Final"
- Store raw ESPN response for debugging

## Deployment

### Supabase Setup
1. Create new Supabase project (free tier)
2. Run schema migrations to create tables
3. Copy connection string + anon key for API config
4. Enable Row Level Security (prep for future auth)

### Python API on Railway

```
Project structure:
├── app/
│   ├── main.py          # FastAPI app, routes
│   ├── models.py        # SQLAlchemy/Pydantic models
│   ├── analysis.py      # Algorithm logic (ported from TS)
│   ├── espn.py          # ESPN API client
│   ├── jobs.py          # Background tasks
│   └── config.py        # Environment config
├── requirements.txt
├── Procfile             # web: uvicorn app.main:app
└── railway.toml

Environment variables:
- SUPABASE_URL
- SUPABASE_KEY
```

### Cost Estimate
- Supabase free tier: $0 (500MB database)
- Railway free tier: $0 (500 hours/month)
- If exceeded: ~$5-10/month for both

## Implementation Phases

### Phase 1: Foundation
- Set up Supabase project and run schema migrations
- Create FastAPI project with basic health endpoint
- Deploy to Railway, verify it's running

### Phase 2: Data Layer
- Build ESPN client (port from TypeScript)
- Implement game fetching and storage
- Implement teams table population
- Test: API returns games from database

### Phase 3: Analysis Engine
- Port analysis logic from TypeScript to Python
- Implement pick generation and storage
- Implement parlay generation
- Test: API returns games with picks

### Phase 4: Results Tracking
- Build background job for result collection
- Implement pick accuracy calculation
- Build daily performance rollup
- Test: Picks marked correct/incorrect after games end

### Phase 5: Mobile App Migration
- Create `api.ts` service pointing to your API
- Update screens to use new service
- Remove old ESPN/analysis services
- Test: App works end-to-end with your API

### Phase 6: Stats & Tuning
- Build stats endpoints
- Add Stats tab to app (optional)
- Implement algorithm versioning and comparison
