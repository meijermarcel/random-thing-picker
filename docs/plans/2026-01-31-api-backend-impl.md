# RTP API Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Python FastAPI backend that centralizes game analysis, pick generation, and performance tracking.

**Architecture:** Python API fetches from ESPN, runs analysis, stores in Supabase. Mobile app becomes a thin UI layer calling this API. Background jobs poll for results and calculate accuracy metrics.

**Tech Stack:** Python 3.11+, FastAPI, Supabase (PostgreSQL), APScheduler, httpx, Pydantic

---

## Prerequisites

Before starting, you need:
1. A Supabase account (free tier: https://supabase.com)
2. Python 3.11+ installed
3. Railway account (free tier: https://railway.app) - for deployment later

---

## Phase 1: Foundation

### Task 1.1: Create API Project Structure

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/__init__.py`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/main.py`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/requirements.txt`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/.gitignore`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/pyproject.toml`

**Step 1: Create directory structure**

```bash
mkdir -p /Users/marcelmeijer/Documents/RTP-dev/rtp-api/app
mkdir -p /Users/marcelmeijer/Documents/RTP-dev/rtp-api/tests
```

**Step 2: Create requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
httpx==0.27.2
pydantic==2.9.0
pydantic-settings==2.5.0
supabase==2.9.0
apscheduler==3.10.4
python-dotenv==1.0.1
pytest==8.3.0
pytest-asyncio==0.24.0
```

**Step 3: Create pyproject.toml**

```toml
[project]
name = "rtp-api"
version = "0.1.0"
description = "RTP Sports Betting Analysis API"
requires-python = ">=3.11"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**Step 4: Create .gitignore**

```
__pycache__/
*.py[cod]
*$py.class
.env
.venv/
venv/
*.egg-info/
.pytest_cache/
.coverage
htmlcov/
dist/
build/
```

**Step 5: Create app/__init__.py**

```python
# RTP API
```

**Step 6: Create app/main.py with health endpoint**

```python
from fastapi import FastAPI

app = FastAPI(
    title="RTP API",
    description="Sports betting analysis API",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "0.1.0"}
```

**Step 7: Initialize git and commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git init
git add .
git commit -m "feat: initialize FastAPI project structure"
```

---

### Task 1.2: Set Up Virtual Environment and Verify

**Step 1: Create virtual environment**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Step 2: Run the API locally**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Expected: Server starts on http://127.0.0.1:8000

**Step 3: Test health endpoint**

In another terminal:
```bash
curl http://localhost:8000/health
```

Expected: `{"status":"healthy","version":"0.1.0"}`

---

### Task 1.3: Create Supabase Project and Schema

**Step 1: Create Supabase project**

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Name it "rtp-api"
4. Choose a strong database password (save it!)
5. Select closest region
6. Click "Create new project"

**Step 2: Get connection details**

1. Go to Project Settings > API
2. Copy:
   - Project URL (SUPABASE_URL)
   - anon/public key (SUPABASE_KEY)

**Step 3: Create .env file**

Create `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

**Step 4: Run SQL to create tables**

Go to Supabase Dashboard > SQL Editor and run:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  espn_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  sport TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  espn_id TEXT UNIQUE NOT NULL,
  sport TEXT NOT NULL,
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  home_score_actual INT,
  away_score_actual INT,
  espn_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Algorithm versions table
CREATE TABLE algorithm_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version TEXT UNIQUE NOT NULL,
  config JSONB NOT NULL,
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Picks table
CREATE TABLE picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  predicted_winner_id UUID REFERENCES teams(id),
  home_score_predicted INT NOT NULL,
  away_score_predicted INT NOT NULL,
  confidence TEXT NOT NULL,
  confidence_score FLOAT NOT NULL,
  analysis_factors JSONB NOT NULL,
  algorithm_version TEXT NOT NULL,
  was_correct BOOLEAN,
  score_diff_error FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, algorithm_version)
);

-- Parlays table
CREATE TABLE parlays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  pick_ids UUID[] NOT NULL,
  total_confidence FLOAT NOT NULL,
  all_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily performance rollup
CREATE TABLE daily_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  algorithm_version TEXT NOT NULL,
  sport TEXT,
  total_picks INT NOT NULL,
  correct_picks INT NOT NULL,
  accuracy_pct FLOAT NOT NULL,
  avg_confidence_score FLOAT NOT NULL,
  avg_score_error FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, algorithm_version, sport)
);

-- Create indexes for common queries
CREATE INDEX idx_games_scheduled_at ON games(scheduled_at);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_picks_game_id ON picks(game_id);
CREATE INDEX idx_picks_algorithm_version ON picks(algorithm_version);
CREATE INDEX idx_daily_performance_date ON daily_performance(date);
```

**Step 5: Insert initial algorithm version**

```sql
INSERT INTO algorithm_versions (version, config, notes) VALUES (
  '1.0.0',
  '{
    "weights": {
      "win_percentage": 0.15,
      "home_away_split": 0.15,
      "recent_form": 0.15,
      "scoring_margin": 0.10,
      "advanced_stats": 0.20,
      "rest_schedule": 0.10,
      "head_to_head": 0.10,
      "injuries": 0.05
    },
    "confidence_thresholds": {
      "high": 15,
      "medium": 5,
      "low": 0
    },
    "sport_adjustments": {
      "basketball": {"home_advantage": 3},
      "football": {"home_advantage": 2.5},
      "hockey": {"home_advantage": 0.2},
      "baseball": {"home_advantage": 0.3},
      "soccer": {"home_advantage": 0.3}
    }
  }',
  'Initial algorithm version ported from TypeScript app'
);
```

---

### Task 1.4: Add Supabase Client to API

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/config.py`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/database.py`
- Modify: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/main.py`

**Step 1: Create config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    algorithm_version: str = "1.0.0"

    class Config:
        env_file = ".env"


settings = Settings()
```

**Step 2: Create database.py**

```python
from supabase import create_client, Client

from app.config import settings

supabase: Client = create_client(settings.supabase_url, settings.supabase_key)


def get_db() -> Client:
    return supabase
```

**Step 3: Update main.py to verify database connection**

```python
from fastapi import FastAPI

from app.database import get_db

app = FastAPI(
    title="RTP API",
    description="Sports betting analysis API",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    # Verify database connection
    try:
        db = get_db()
        result = db.table("algorithm_versions").select("version").limit(1).execute()
        db_status = "connected"
        current_version = result.data[0]["version"] if result.data else "unknown"
    except Exception as e:
        db_status = f"error: {str(e)}"
        current_version = "unknown"

    return {
        "status": "healthy",
        "version": "0.1.0",
        "database": db_status,
        "algorithm_version": current_version,
    }
```

**Step 4: Test database connection**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Then:
```bash
curl http://localhost:8000/health
```

Expected: `{"status":"healthy","version":"0.1.0","database":"connected","algorithm_version":"1.0.0"}`

**Step 5: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add Supabase database connection"
```

---

## Phase 2: Data Layer

### Task 2.1: Create Pydantic Models

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/models.py`

**Step 1: Create models.py**

```python
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


# Database models
class Team(BaseModel):
    id: UUID
    espn_id: str
    name: str
    abbreviation: str
    sport: str
    logo_url: Optional[str] = None


class TeamCreate(BaseModel):
    espn_id: str
    name: str
    abbreviation: str
    sport: str
    logo_url: Optional[str] = None


class Game(BaseModel):
    id: UUID
    espn_id: str
    sport: str
    home_team_id: Optional[UUID] = None
    away_team_id: Optional[UUID] = None
    scheduled_at: datetime
    status: str = "scheduled"
    home_score_actual: Optional[int] = None
    away_score_actual: Optional[int] = None
    espn_data: Optional[dict] = None


class GameCreate(BaseModel):
    espn_id: str
    sport: str
    home_team_id: Optional[UUID] = None
    away_team_id: Optional[UUID] = None
    scheduled_at: datetime
    status: str = "scheduled"
    espn_data: Optional[dict] = None


# ESPN API response models
class ESPNTeam(BaseModel):
    id: str
    name: str
    abbreviation: str
    logo: Optional[str] = None


class ESPNOdds(BaseModel):
    spread: Optional[float] = None
    over_under: Optional[float] = None
    home_moneyline: Optional[int] = None
    away_moneyline: Optional[int] = None
    provider: str = "ESPN"


class ESPNGame(BaseModel):
    id: str
    home_team: ESPNTeam
    away_team: ESPNTeam
    start_time: datetime
    sport: str
    league: str
    home_record: Optional[str] = None
    away_record: Optional[str] = None
    odds: Optional[ESPNOdds] = None
    status: str = "scheduled"
    home_score: Optional[int] = None
    away_score: Optional[int] = None


# Analysis models
class GameProjection(BaseModel):
    home_points: float
    away_points: float
    total_points: float
    projected_winner: str  # "home" or "away"
    projected_margin: float
    confidence: str  # "low", "medium", "high"


class PickAnalysis(BaseModel):
    pick_type: str  # "home", "away", "draw"
    confidence: str
    reasoning: list[str]
    home_score: float  # Composite analysis score 0-100
    away_score: float
    differential: float
    projection: GameProjection


class Pick(BaseModel):
    id: UUID
    game_id: UUID
    predicted_winner_id: Optional[UUID] = None
    home_score_predicted: int
    away_score_predicted: int
    confidence: str
    confidence_score: float
    analysis_factors: dict
    algorithm_version: str
    was_correct: Optional[bool] = None
    score_diff_error: Optional[float] = None


# API response models
class GameWithPick(BaseModel):
    game: Game
    home_team: Optional[Team] = None
    away_team: Optional[Team] = None
    pick: Optional[Pick] = None
    analysis: Optional[PickAnalysis] = None


class ParlayRecommendation(BaseModel):
    id: str
    category: str  # "lock", "value", "sport", "longshot", "mega", "custom"
    title: str
    subtitle: str
    picks: list[GameWithPick]
    icon: str
```

**Step 2: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add Pydantic models for API"
```

---

### Task 2.2: Create ESPN Client

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/espn.py`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/tests/test_espn.py`

**Step 1: Write failing test**

Create `tests/__init__.py`:
```python
# Tests
```

Create `tests/test_espn.py`:
```python
import pytest
from datetime import datetime

from app.espn import ESPNClient, ENDPOINTS


@pytest.mark.asyncio
async def test_fetch_games_returns_list():
    client = ESPNClient()
    games = await client.fetch_games("nba")
    assert isinstance(games, list)


@pytest.mark.asyncio
async def test_fetch_games_with_date():
    client = ESPNClient()
    # Use a date that likely has games
    date = datetime(2026, 1, 30)
    games = await client.fetch_games("nba", date)
    assert isinstance(games, list)


def test_endpoints_defined():
    assert "nba" in ENDPOINTS
    assert "nfl" in ENDPOINTS
    assert ENDPOINTS["nba"]["sport"] == "basketball"
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
source venv/bin/activate
pytest tests/test_espn.py -v
```

Expected: FAIL with "ModuleNotFoundError" or "ImportError"

**Step 3: Create espn.py**

```python
from datetime import datetime
from typing import Optional

import httpx

from app.models import ESPNGame, ESPNTeam, ESPNOdds

ENDPOINTS: dict[str, dict[str, str]] = {
    "nfl": {"sport": "football", "league": "nfl", "name": "NFL"},
    "nba": {"sport": "basketball", "league": "nba", "name": "NBA"},
    "ncaam": {"sport": "basketball", "league": "mens-college-basketball", "name": "NCAAM"},
    "mlb": {"sport": "baseball", "league": "mlb", "name": "MLB"},
    "nhl": {"sport": "hockey", "league": "nhl", "name": "NHL"},
    "soccer": {"sport": "soccer", "league": "eng.1", "name": "Premier League"},
}


def _format_date(date: datetime) -> str:
    """Format date as YYYYMMDD for ESPN API."""
    return date.strftime("%Y%m%d")


def _parse_odds(competition: dict) -> Optional[ESPNOdds]:
    """Parse odds from ESPN competition data."""
    odds_array = competition.get("odds", [])
    if not odds_array:
        return None

    odds_data = odds_array[0]
    spread = None
    over_under = None
    home_ml = None
    away_ml = None

    # Try to get spread from details
    if details := odds_data.get("details"):
        import re
        match = re.search(r"([+-]?\d+\.?\d*)", details)
        if match:
            spread = float(match.group(1))

    # Direct spread
    if odds_data.get("spread") is not None:
        spread = float(odds_data["spread"])

    # Over/under
    if odds_data.get("overUnder") is not None:
        over_under = float(odds_data["overUnder"])

    # Moneylines
    if home_odds := odds_data.get("homeTeamOdds"):
        if home_odds.get("moneyLine") is not None:
            home_ml = int(home_odds["moneyLine"])
    if away_odds := odds_data.get("awayTeamOdds"):
        if away_odds.get("moneyLine") is not None:
            away_ml = int(away_odds["moneyLine"])

    if spread is None and over_under is None and home_ml is None and away_ml is None:
        return None

    return ESPNOdds(
        spread=spread,
        over_under=over_under,
        home_moneyline=home_ml,
        away_moneyline=away_ml,
        provider=odds_data.get("provider", {}).get("name", "ESPN"),
    )


class ESPNClient:
    """Client for fetching data from ESPN API."""

    BASE_URL = "https://site.api.espn.com/apis/site/v2/sports"

    def __init__(self):
        self._client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        await self._client.aclose()

    async def fetch_games(
        self,
        league_key: str,
        date: Optional[datetime] = None,
    ) -> list[ESPNGame]:
        """Fetch games for a league, optionally filtered by date."""
        if league_key not in ENDPOINTS:
            return []

        config = ENDPOINTS[league_key]
        url = f"{self.BASE_URL}/{config['sport']}/{config['league']}/scoreboard"

        params = {}
        if date:
            params["dates"] = _format_date(date)

        try:
            response = await self._client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
        except Exception:
            return []

        games = []
        for event in data.get("events", []):
            competition = event.get("competitions", [{}])[0]
            competitors = competition.get("competitors", [])

            home_data = next((c for c in competitors if c.get("homeAway") == "home"), {})
            away_data = next((c for c in competitors if c.get("homeAway") == "away"), {})

            home_team_data = home_data.get("team", {})
            away_team_data = away_data.get("team", {})

            # Determine status
            status_data = competition.get("status", {}).get("type", {})
            if status_data.get("completed"):
                status = "final"
            elif status_data.get("state") == "in":
                status = "in_progress"
            else:
                status = "scheduled"

            # Get scores if available
            home_score = None
            away_score = None
            if status in ("final", "in_progress"):
                try:
                    home_score = int(home_data.get("score", 0))
                    away_score = int(away_data.get("score", 0))
                except (ValueError, TypeError):
                    pass

            game = ESPNGame(
                id=event.get("id", ""),
                home_team=ESPNTeam(
                    id=home_team_data.get("id", ""),
                    name=home_team_data.get("displayName", "TBD"),
                    abbreviation=home_team_data.get("abbreviation", ""),
                    logo=home_team_data.get("logo"),
                ),
                away_team=ESPNTeam(
                    id=away_team_data.get("id", ""),
                    name=away_team_data.get("displayName", "TBD"),
                    abbreviation=away_team_data.get("abbreviation", ""),
                    logo=away_team_data.get("logo"),
                ),
                start_time=datetime.fromisoformat(
                    event.get("date", "").replace("Z", "+00:00")
                ),
                sport=config["sport"],
                league=config["name"],
                home_record=home_data.get("records", [{}])[0].get("summary"),
                away_record=away_data.get("records", [{}])[0].get("summary"),
                odds=_parse_odds(competition),
                status=status,
                home_score=home_score,
                away_score=away_score,
            )
            games.append(game)

        return sorted(games, key=lambda g: g.start_time)

    async def fetch_all_games(
        self,
        date: Optional[datetime] = None,
    ) -> list[ESPNGame]:
        """Fetch games from all leagues."""
        all_games = []
        for league_key in ENDPOINTS:
            games = await self.fetch_games(league_key, date)
            all_games.extend(games)
        return sorted(all_games, key=lambda g: g.start_time)

    async def fetch_team_stats(
        self,
        sport: str,
        league: str,
        team_id: str,
    ) -> Optional[dict]:
        """Fetch detailed team statistics."""
        url = f"{self.BASE_URL}/{sport}/{league}/teams/{team_id}"

        try:
            response = await self._client.get(url)
            response.raise_for_status()
            data = response.json()
            return data.get("team")
        except Exception:
            return None

    async def fetch_team_schedule(
        self,
        sport: str,
        league: str,
        team_id: str,
    ) -> list[dict]:
        """Fetch team schedule for H2H and rest calculation."""
        url = f"{self.BASE_URL}/{sport}/{league}/teams/{team_id}/schedule"

        try:
            response = await self._client.get(url)
            response.raise_for_status()
            data = response.json()
            return data.get("events", [])
        except Exception:
            return []

    async def fetch_injuries(
        self,
        sport: str,
        league: str,
    ) -> dict[str, list[dict]]:
        """Fetch league injuries, returns dict of team_id -> injuries."""
        url = f"{self.BASE_URL}/{sport}/{league}/injuries"

        try:
            response = await self._client.get(url)
            response.raise_for_status()
            data = response.json()
        except Exception:
            return {}

        injuries_by_team = {}
        for team_data in data.get("teams", []):
            team_id = team_data.get("team", {}).get("id")
            if team_id:
                injuries_by_team[team_id] = team_data.get("injuries", [])

        return injuries_by_team
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
source venv/bin/activate
pytest tests/test_espn.py -v
```

Expected: All tests PASS

**Step 5: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add ESPN API client"
```

---

### Task 2.3: Create Team Repository

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/repositories/__init__.py`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/repositories/teams.py`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/tests/test_teams_repo.py`

**Step 1: Write failing test**

Create `tests/test_teams_repo.py`:
```python
import pytest
from uuid import uuid4

from app.repositories.teams import TeamRepository
from app.models import TeamCreate


def test_team_repository_exists():
    repo = TeamRepository()
    assert repo is not None


@pytest.mark.asyncio
async def test_get_or_create_team():
    repo = TeamRepository()
    team_data = TeamCreate(
        espn_id="test-123",
        name="Test Team",
        abbreviation="TST",
        sport="basketball",
        logo_url="https://example.com/logo.png",
    )

    # First call should create
    team = await repo.get_or_create(team_data)
    assert team is not None
    assert team.espn_id == "test-123"

    # Second call should return existing
    team2 = await repo.get_or_create(team_data)
    assert team2.id == team.id

    # Cleanup
    await repo.delete_by_espn_id("test-123")
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
source venv/bin/activate
pytest tests/test_teams_repo.py -v
```

Expected: FAIL

**Step 3: Create repositories/__init__.py**

```python
# Repositories
```

**Step 4: Create teams.py**

```python
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.models import Team, TeamCreate


class TeamRepository:
    """Repository for team data operations."""

    def __init__(self):
        self._db = get_db()

    async def get_by_id(self, team_id: UUID) -> Optional[Team]:
        """Get team by UUID."""
        result = self._db.table("teams").select("*").eq("id", str(team_id)).execute()
        if result.data:
            return Team(**result.data[0])
        return None

    async def get_by_espn_id(self, espn_id: str) -> Optional[Team]:
        """Get team by ESPN ID."""
        result = self._db.table("teams").select("*").eq("espn_id", espn_id).execute()
        if result.data:
            return Team(**result.data[0])
        return None

    async def create(self, team: TeamCreate) -> Team:
        """Create a new team."""
        result = self._db.table("teams").insert(team.model_dump()).execute()
        return Team(**result.data[0])

    async def get_or_create(self, team: TeamCreate) -> Team:
        """Get existing team or create new one."""
        existing = await self.get_by_espn_id(team.espn_id)
        if existing:
            return existing
        return await self.create(team)

    async def delete_by_espn_id(self, espn_id: str) -> None:
        """Delete team by ESPN ID (for testing)."""
        self._db.table("teams").delete().eq("espn_id", espn_id).execute()
```

**Step 5: Run tests to verify they pass**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
source venv/bin/activate
pytest tests/test_teams_repo.py -v
```

Expected: All tests PASS

**Step 6: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add team repository"
```

---

### Task 2.4: Create Game Repository

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/repositories/games.py`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/tests/test_games_repo.py`

**Step 1: Write failing test**

Create `tests/test_games_repo.py`:
```python
import pytest
from datetime import datetime, timezone

from app.repositories.games import GameRepository
from app.models import GameCreate


def test_game_repository_exists():
    repo = GameRepository()
    assert repo is not None


@pytest.mark.asyncio
async def test_get_games_by_date():
    repo = GameRepository()
    # Should return empty list for far future date
    games = await repo.get_by_date(datetime(2099, 1, 1, tzinfo=timezone.utc))
    assert isinstance(games, list)
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_games_repo.py -v
```

Expected: FAIL

**Step 3: Create games.py**

```python
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.models import Game, GameCreate


class GameRepository:
    """Repository for game data operations."""

    def __init__(self):
        self._db = get_db()

    async def get_by_id(self, game_id: UUID) -> Optional[Game]:
        """Get game by UUID."""
        result = self._db.table("games").select("*").eq("id", str(game_id)).execute()
        if result.data:
            return Game(**result.data[0])
        return None

    async def get_by_espn_id(self, espn_id: str) -> Optional[Game]:
        """Get game by ESPN ID."""
        result = self._db.table("games").select("*").eq("espn_id", espn_id).execute()
        if result.data:
            return Game(**result.data[0])
        return None

    async def get_by_date(self, date: datetime) -> list[Game]:
        """Get games for a specific date (UTC)."""
        start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)

        result = (
            self._db.table("games")
            .select("*")
            .gte("scheduled_at", start.isoformat())
            .lt("scheduled_at", end.isoformat())
            .order("scheduled_at")
            .execute()
        )

        return [Game(**row) for row in result.data]

    async def get_pending_results(self) -> list[Game]:
        """Get games that need result updates (scheduled or in_progress)."""
        result = (
            self._db.table("games")
            .select("*")
            .in_("status", ["scheduled", "in_progress"])
            .lt("scheduled_at", datetime.utcnow().isoformat())
            .execute()
        )

        return [Game(**row) for row in result.data]

    async def create(self, game: GameCreate) -> Game:
        """Create a new game."""
        result = self._db.table("games").insert(game.model_dump(mode="json")).execute()
        return Game(**result.data[0])

    async def upsert(self, game: GameCreate) -> Game:
        """Create or update game by ESPN ID."""
        existing = await self.get_by_espn_id(game.espn_id)
        if existing:
            # Update existing game
            result = (
                self._db.table("games")
                .update(game.model_dump(mode="json"))
                .eq("espn_id", game.espn_id)
                .execute()
            )
            return Game(**result.data[0])
        return await self.create(game)

    async def update_result(
        self,
        game_id: UUID,
        status: str,
        home_score: Optional[int],
        away_score: Optional[int],
    ) -> Game:
        """Update game result."""
        update_data = {
            "status": status,
            "home_score_actual": home_score,
            "away_score_actual": away_score,
            "updated_at": datetime.utcnow().isoformat(),
        }
        result = (
            self._db.table("games")
            .update(update_data)
            .eq("id", str(game_id))
            .execute()
        )
        return Game(**result.data[0])

    async def delete_by_espn_id(self, espn_id: str) -> None:
        """Delete game by ESPN ID (for testing)."""
        self._db.table("games").delete().eq("espn_id", espn_id).execute()
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_games_repo.py -v
```

Expected: All tests PASS

**Step 5: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add game repository"
```

---

### Task 2.5: Create Games Endpoint

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/routers/__init__.py`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/routers/games.py`
- Modify: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/main.py`

**Step 1: Create routers/__init__.py**

```python
# Routers
```

**Step 2: Create games.py router**

```python
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Query

from app.espn import ESPNClient, ENDPOINTS
from app.models import ESPNGame, TeamCreate, GameCreate
from app.repositories.teams import TeamRepository
from app.repositories.games import GameRepository

router = APIRouter(prefix="/games", tags=["games"])


@router.get("")
async def get_games(
    date_param: Optional[date] = Query(None, alias="date"),
    sport: Optional[str] = Query(None),
) -> list[dict]:
    """
    Get games for a date, optionally filtered by sport.

    If games don't exist in database, fetches from ESPN and stores them.
    """
    target_date = datetime.combine(date_param, datetime.min.time()) if date_param else datetime.utcnow()

    # Check database first
    game_repo = GameRepository()
    db_games = await game_repo.get_by_date(target_date)

    if db_games:
        # Return from database
        if sport:
            db_games = [g for g in db_games if g.sport == sport]
        return [g.model_dump() for g in db_games]

    # Fetch from ESPN and store
    espn = ESPNClient()
    try:
        espn_games = await espn.fetch_all_games(target_date)
    finally:
        await espn.close()

    if not espn_games:
        return []

    # Store teams and games
    team_repo = TeamRepository()
    stored_games = []

    for eg in espn_games:
        # Get or create teams
        home_team = await team_repo.get_or_create(
            TeamCreate(
                espn_id=eg.home_team.id,
                name=eg.home_team.name,
                abbreviation=eg.home_team.abbreviation,
                sport=eg.sport,
                logo_url=eg.home_team.logo,
            )
        )
        away_team = await team_repo.get_or_create(
            TeamCreate(
                espn_id=eg.away_team.id,
                name=eg.away_team.name,
                abbreviation=eg.away_team.abbreviation,
                sport=eg.sport,
                logo_url=eg.away_team.logo,
            )
        )

        # Create game
        game = await game_repo.upsert(
            GameCreate(
                espn_id=eg.id,
                sport=eg.sport,
                home_team_id=home_team.id,
                away_team_id=away_team.id,
                scheduled_at=eg.start_time,
                status=eg.status,
                espn_data={
                    "league": eg.league,
                    "home_record": eg.home_record,
                    "away_record": eg.away_record,
                    "odds": eg.odds.model_dump() if eg.odds else None,
                },
            )
        )
        stored_games.append(game)

    if sport:
        stored_games = [g for g in stored_games if g.sport == sport]

    return [g.model_dump() for g in stored_games]


@router.get("/sports")
async def get_available_sports() -> list[dict]:
    """Get list of available sports/leagues."""
    return [
        {"key": key, **config}
        for key, config in ENDPOINTS.items()
    ]
```

**Step 3: Update main.py to include router**

```python
from fastapi import FastAPI

from app.database import get_db
from app.routers import games

app = FastAPI(
    title="RTP API",
    description="Sports betting analysis API",
    version="0.1.0",
)

# Include routers
app.include_router(games.router)


@app.get("/health")
async def health_check():
    # Verify database connection
    try:
        db = get_db()
        result = db.table("algorithm_versions").select("version").limit(1).execute()
        db_status = "connected"
        current_version = result.data[0]["version"] if result.data else "unknown"
    except Exception as e:
        db_status = f"error: {str(e)}"
        current_version = "unknown"

    return {
        "status": "healthy",
        "version": "0.1.0",
        "database": db_status,
        "algorithm_version": current_version,
    }
```

**Step 4: Test the games endpoint**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

In another terminal:
```bash
curl "http://localhost:8000/games?date=2026-01-31"
```

Expected: JSON array of games (may be empty if no games that day)

```bash
curl "http://localhost:8000/games/sports"
```

Expected: JSON array of available sports

**Step 5: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add games endpoint"
```

---

## Phase 3: Analysis Engine

### Task 3.1: Create Analysis Module

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/analysis.py`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/tests/test_analysis.py`

**Step 1: Write failing test**

Create `tests/test_analysis.py`:
```python
import pytest

from app.analysis import (
    calculate_win_pct_score,
    calculate_composite_score,
    get_confidence_level,
    AlgorithmConfig,
)


def test_calculate_win_pct_score():
    # 75% win rate should return 75
    score = calculate_win_pct_score(0.75)
    assert score == 75.0


def test_calculate_win_pct_score_zero():
    score = calculate_win_pct_score(0.0)
    assert score == 0.0


def test_get_confidence_level():
    config = AlgorithmConfig()

    # High differential = high confidence
    assert get_confidence_level(20, config) == "high"

    # Medium differential = medium confidence
    assert get_confidence_level(10, config) == "medium"

    # Low differential = low confidence
    assert get_confidence_level(3, config) == "low"
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_analysis.py -v
```

Expected: FAIL

**Step 3: Create analysis.py**

```python
from dataclasses import dataclass
from typing import Optional

from app.database import get_db


@dataclass
class AlgorithmConfig:
    """Configuration for the analysis algorithm."""

    version: str = "1.0.0"

    # Weights for different factors
    win_percentage: float = 0.15
    home_away_split: float = 0.15
    recent_form: float = 0.15
    scoring_margin: float = 0.10
    advanced_stats: float = 0.20
    rest_schedule: float = 0.10
    head_to_head: float = 0.10
    injuries: float = 0.05

    # Confidence thresholds (differential score)
    high_threshold: float = 15.0
    medium_threshold: float = 5.0

    # Sport-specific home advantage (in points)
    home_advantage: dict = None

    def __post_init__(self):
        if self.home_advantage is None:
            self.home_advantage = {
                "basketball": 3.0,
                "football": 2.5,
                "hockey": 0.2,
                "baseball": 0.3,
                "soccer": 0.3,
            }

    @classmethod
    def from_database(cls) -> "AlgorithmConfig":
        """Load config from database."""
        db = get_db()
        result = (
            db.table("algorithm_versions")
            .select("*")
            .order("deployed_at", desc=True)
            .limit(1)
            .execute()
        )

        if not result.data:
            return cls()

        row = result.data[0]
        config_data = row.get("config", {})
        weights = config_data.get("weights", {})
        thresholds = config_data.get("confidence_thresholds", {})
        sport_adj = config_data.get("sport_adjustments", {})

        return cls(
            version=row.get("version", "1.0.0"),
            win_percentage=weights.get("win_percentage", 0.15),
            home_away_split=weights.get("home_away_split", 0.15),
            recent_form=weights.get("recent_form", 0.15),
            scoring_margin=weights.get("scoring_margin", 0.10),
            advanced_stats=weights.get("advanced_stats", 0.20),
            rest_schedule=weights.get("rest_schedule", 0.10),
            head_to_head=weights.get("head_to_head", 0.10),
            injuries=weights.get("injuries", 0.05),
            high_threshold=thresholds.get("high", 15.0),
            medium_threshold=thresholds.get("medium", 5.0),
            home_advantage={
                sport: adj.get("home_advantage", 0)
                for sport, adj in sport_adj.items()
            } if sport_adj else None,
        )


# League averages for score projections
LEAGUE_AVERAGES = {
    "basketball": 110,
    "football": 22,
    "hockey": 3,
    "baseball": 4.5,
    "soccer": 1.3,
}


def calculate_win_pct_score(win_pct: float) -> float:
    """Calculate score from win percentage (0-100)."""
    return win_pct * 100


def calculate_home_away_score(
    home_wins: int,
    home_losses: int,
    away_wins: int,
    away_losses: int,
    is_home: bool,
) -> float:
    """Calculate home/away performance score (0-100)."""
    if is_home:
        total = home_wins + home_losses
        if total == 0:
            return 50.0
        return (home_wins / total) * 100
    else:
        total = away_wins + away_losses
        if total == 0:
            return 50.0
        return (away_wins / total) * 100


def calculate_form_score(streak: int, streak_type: str) -> float:
    """Calculate recent form score based on streak (0-100)."""
    streak_impact = streak * 5
    adjustment = streak_impact if streak_type == "W" else -streak_impact
    return max(0, min(100, 50 + adjustment))


def calculate_margin_score(points_for: float, points_against: float, games: int) -> float:
    """Calculate scoring margin score (0-100)."""
    if games == 0 or (points_for == 0 and points_against == 0):
        return 50.0

    avg_for = points_for / games
    avg_against = points_against / games
    margin = avg_for - avg_against

    # Normalize: +20 margin = 100, -20 margin = 0, 0 margin = 50
    normalized = 50 + (margin * 2.5)
    return max(0, min(100, normalized))


def calculate_rest_score(
    days_since_last: int,
    is_back_to_back: bool,
    opponent_days_rest: Optional[int] = None,
) -> float:
    """Calculate rest advantage score (0-100)."""
    if is_back_to_back:
        base_score = 30
    elif days_since_last <= 1:
        base_score = 45
    elif days_since_last == 2:
        base_score = 60
    elif days_since_last == 3:
        base_score = 75
    else:
        base_score = 85

    # Compare against opponent
    if opponent_days_rest is not None:
        rest_diff = days_since_last - opponent_days_rest
        if rest_diff >= 2:
            base_score += 10
        elif rest_diff <= -2:
            base_score -= 10

    return max(0, min(100, base_score))


def calculate_h2h_score(meetings: int, wins: int, avg_point_diff: float) -> float:
    """Calculate head-to-head score (0-100)."""
    if meetings < 2:
        return 50.0  # Not enough data

    win_rate = wins / meetings
    margin_factor = min(10, max(-10, avg_point_diff)) / 10

    return max(0, min(100, 50 + (win_rate - 0.5) * 60 + margin_factor * 20))


def calculate_injury_score(
    team_impact: float,
    opponent_impact: float,
) -> float:
    """Calculate injury advantage score (0-100)."""
    health_diff = team_impact - opponent_impact
    return max(0, min(100, 50 + health_diff / 2))


def calculate_composite_score(
    win_pct_score: float,
    home_away_score: float,
    form_score: float,
    margin_score: float,
    advanced_score: float,
    rest_score: float,
    h2h_score: float,
    injury_score: float,
    config: AlgorithmConfig,
) -> float:
    """Calculate weighted composite score."""
    return (
        win_pct_score * config.win_percentage +
        home_away_score * config.home_away_split +
        form_score * config.recent_form +
        margin_score * config.scoring_margin +
        advanced_score * config.advanced_stats +
        rest_score * config.rest_schedule +
        h2h_score * config.head_to_head +
        injury_score * config.injuries
    )


def get_confidence_level(differential: float, config: AlgorithmConfig) -> str:
    """Determine confidence level from score differential."""
    if differential >= config.high_threshold:
        return "high"
    elif differential >= config.medium_threshold:
        return "medium"
    return "low"


def calculate_projected_score(
    team_ppg: float,
    opponent_ppg_against: float,
    is_home: bool,
    sport: str,
    win_pct: float,
    streak: int,
    streak_type: str,
    config: AlgorithmConfig,
) -> float:
    """Calculate projected points for a team."""
    league_avg = LEAGUE_AVERAGES.get(sport, 100)
    home_bonus = config.home_advantage.get(sport, 2)

    if team_ppg > 0 and opponent_ppg_against > 0:
        # Blend team offense with opponent defense
        projected = (team_ppg + opponent_ppg_against) / 2

        # Home/away adjustment
        if is_home:
            projected += home_bonus
        else:
            projected -= home_bonus * 0.5

        # Form adjustment
        form_adjust = streak * 0.5 if streak_type == "W" else -streak * 0.5
        projected += form_adjust

        # Win percentage adjustment
        win_pct_adjust = (win_pct - 0.5) * league_avg * 0.1
        projected += win_pct_adjust

        return max(0, round(projected, 1))

    # Fallback: use win percentage
    base_score = league_avg * (0.85 + win_pct * 0.3)
    if is_home:
        base_score += home_bonus

    return round(base_score, 1)
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_analysis.py -v
```

Expected: All tests PASS

**Step 5: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add analysis engine"
```

---

### Task 3.2: Create Game Analyzer Service

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/services/__init__.py`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/services/analyzer.py`

**Step 1: Create services/__init__.py**

```python
# Services
```

**Step 2: Create analyzer.py**

```python
from datetime import datetime
from typing import Optional
from uuid import UUID

from app.analysis import (
    AlgorithmConfig,
    calculate_win_pct_score,
    calculate_home_away_score,
    calculate_form_score,
    calculate_margin_score,
    calculate_rest_score,
    calculate_h2h_score,
    calculate_injury_score,
    calculate_composite_score,
    calculate_projected_score,
    get_confidence_level,
    LEAGUE_AVERAGES,
)
from app.espn import ESPNClient, ENDPOINTS
from app.models import Game, PickAnalysis, GameProjection


def _get_league_key(sport: str) -> Optional[str]:
    """Get league key from sport name."""
    for key, config in ENDPOINTS.items():
        if config["sport"] == sport:
            return config["league"]
    return None


async def analyze_game(
    game: Game,
    espn_data: dict,
    config: Optional[AlgorithmConfig] = None,
) -> PickAnalysis:
    """
    Analyze a game and generate pick recommendation.

    Args:
        game: Game record from database
        espn_data: Raw ESPN data stored with game
        config: Algorithm config (loaded from DB if not provided)

    Returns:
        PickAnalysis with pick recommendation
    """
    if config is None:
        config = AlgorithmConfig.from_database()

    league_key = _get_league_key(game.sport)
    if not league_key:
        # Return default analysis if sport not supported
        return _default_analysis(game)

    # Extract team data from ESPN data
    home_record = espn_data.get("home_record", "0-0")
    away_record = espn_data.get("away_record", "0-0")

    home_wins, home_losses = _parse_record(home_record)
    away_wins, away_losses = _parse_record(away_record)

    home_total = home_wins + home_losses
    away_total = away_wins + away_losses

    home_win_pct = home_wins / home_total if home_total > 0 else 0.5
    away_win_pct = away_wins / away_total if away_total > 0 else 0.5

    # Fetch additional data from ESPN
    espn = ESPNClient()
    try:
        # For now, use simplified analysis based on records
        # Full analysis would fetch team stats, schedule, injuries
        home_stats = None
        away_stats = None

        if game.home_team_id:
            # Could fetch detailed stats here
            pass
        if game.away_team_id:
            pass
    finally:
        await espn.close()

    # Calculate factor scores for home team
    home_win_pct_score = calculate_win_pct_score(home_win_pct)
    # Assume roughly 50/50 home/away split without detailed data
    home_home_away_score = calculate_home_away_score(
        home_wins // 2, home_losses // 2,
        home_wins - home_wins // 2, home_losses - home_losses // 2,
        is_home=True,
    )
    home_form_score = 50.0  # Neutral without streak data
    home_margin_score = 50.0  # Neutral without scoring data
    home_advanced_score = 50.0
    home_rest_score = 50.0
    home_h2h_score = 50.0
    home_injury_score = 50.0

    # Calculate factor scores for away team
    away_win_pct_score = calculate_win_pct_score(away_win_pct)
    away_home_away_score = calculate_home_away_score(
        away_wins // 2, away_losses // 2,
        away_wins - away_wins // 2, away_losses - away_losses // 2,
        is_home=False,
    )
    away_form_score = 50.0
    away_margin_score = 50.0
    away_advanced_score = 50.0
    away_rest_score = 50.0
    away_h2h_score = 50.0
    away_injury_score = 50.0

    # Calculate composite scores
    home_composite = calculate_composite_score(
        home_win_pct_score, home_home_away_score, home_form_score,
        home_margin_score, home_advanced_score, home_rest_score,
        home_h2h_score, home_injury_score, config,
    )

    away_composite = calculate_composite_score(
        away_win_pct_score, away_home_away_score, away_form_score,
        away_margin_score, away_advanced_score, away_rest_score,
        away_h2h_score, away_injury_score, config,
    )

    differential = abs(home_composite - away_composite)
    confidence = get_confidence_level(differential, config)

    # Calculate projected scores
    league_avg = LEAGUE_AVERAGES.get(game.sport, 100)
    home_projected = calculate_projected_score(
        team_ppg=league_avg * (0.9 + home_win_pct * 0.2),
        opponent_ppg_against=league_avg * (0.9 + (1 - away_win_pct) * 0.2),
        is_home=True,
        sport=game.sport,
        win_pct=home_win_pct,
        streak=0,
        streak_type="W",
        config=config,
    )

    away_projected = calculate_projected_score(
        team_ppg=league_avg * (0.9 + away_win_pct * 0.2),
        opponent_ppg_against=league_avg * (0.9 + (1 - home_win_pct) * 0.2),
        is_home=False,
        sport=game.sport,
        win_pct=away_win_pct,
        streak=0,
        streak_type="W",
        config=config,
    )

    projected_winner = "home" if home_projected >= away_projected else "away"
    projected_margin = round(home_projected - away_projected, 1)

    # Determine pick type
    if game.sport == "soccer" and abs(projected_margin) < 0.5:
        pick_type = "draw"
    else:
        pick_type = projected_winner

    # Generate reasoning
    reasoning = _generate_reasoning(
        home_record, away_record,
        home_win_pct, away_win_pct,
        pick_type, projected_margin,
    )

    return PickAnalysis(
        pick_type=pick_type,
        confidence=confidence,
        reasoning=reasoning,
        home_score=home_composite,
        away_score=away_composite,
        differential=differential,
        projection=GameProjection(
            home_points=home_projected,
            away_points=away_projected,
            total_points=round(home_projected + away_projected, 1),
            projected_winner=projected_winner,
            projected_margin=projected_margin,
            confidence=confidence,
        ),
    )


def _parse_record(record: str) -> tuple[int, int]:
    """Parse record string like '10-5' into wins/losses."""
    if not record:
        return 0, 0
    parts = record.split("-")
    try:
        return int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        return 0, 0


def _generate_reasoning(
    home_record: str,
    away_record: str,
    home_win_pct: float,
    away_win_pct: float,
    pick_type: str,
    margin: float,
) -> list[str]:
    """Generate reasoning strings for the pick."""
    reasons = []

    if pick_type == "home":
        if home_win_pct > away_win_pct:
            reasons.append(f"Home team {home_record} vs {away_record}")
        reasons.append(f"Projected to win by {abs(margin):.1f}")
        reasons.append("Home court advantage")
    elif pick_type == "away":
        if away_win_pct > home_win_pct:
            reasons.append(f"Away team {away_record} vs {home_record}")
        reasons.append(f"Projected to win by {abs(margin):.1f}")
    else:  # draw
        reasons.append("Teams evenly matched")
        reasons.append(f"Home {home_record} vs Away {away_record}")

    return reasons[:3]


def _default_analysis(game: Game) -> PickAnalysis:
    """Return default analysis when sport not supported."""
    return PickAnalysis(
        pick_type="home",
        confidence="low",
        reasoning=["Insufficient data for analysis"],
        home_score=50,
        away_score=50,
        differential=0,
        projection=GameProjection(
            home_points=0,
            away_points=0,
            total_points=0,
            projected_winner="home",
            projected_margin=0,
            confidence="low",
        ),
    )
```

**Step 3: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add game analyzer service"
```

---

### Task 3.3: Create Pick Repository and Endpoint

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/repositories/picks.py`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/routers/picks.py`
- Modify: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/main.py`

**Step 1: Create picks.py repository**

```python
from datetime import datetime
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.models import Pick


class PickCreate:
    def __init__(
        self,
        game_id: UUID,
        predicted_winner_id: Optional[UUID],
        home_score_predicted: int,
        away_score_predicted: int,
        confidence: str,
        confidence_score: float,
        analysis_factors: dict,
        algorithm_version: str,
    ):
        self.game_id = game_id
        self.predicted_winner_id = predicted_winner_id
        self.home_score_predicted = home_score_predicted
        self.away_score_predicted = away_score_predicted
        self.confidence = confidence
        self.confidence_score = confidence_score
        self.analysis_factors = analysis_factors
        self.algorithm_version = algorithm_version


class PickRepository:
    """Repository for pick data operations."""

    def __init__(self):
        self._db = get_db()

    async def get_by_game(
        self,
        game_id: UUID,
        algorithm_version: Optional[str] = None,
    ) -> Optional[Pick]:
        """Get pick for a game, optionally for specific algorithm version."""
        query = self._db.table("picks").select("*").eq("game_id", str(game_id))

        if algorithm_version:
            query = query.eq("algorithm_version", algorithm_version)
        else:
            query = query.order("created_at", desc=True).limit(1)

        result = query.execute()
        if result.data:
            return Pick(**result.data[0])
        return None

    async def get_by_date(
        self,
        date: datetime,
        sport: Optional[str] = None,
        confidence: Optional[str] = None,
    ) -> list[Pick]:
        """Get picks for games on a specific date."""
        # First get game IDs for the date
        from app.repositories.games import GameRepository
        game_repo = GameRepository()
        games = await game_repo.get_by_date(date)

        if sport:
            games = [g for g in games if g.sport == sport]

        if not games:
            return []

        game_ids = [str(g.id) for g in games]

        query = self._db.table("picks").select("*").in_("game_id", game_ids)

        if confidence:
            query = query.eq("confidence", confidence)

        result = query.execute()
        return [Pick(**row) for row in result.data]

    async def create(self, pick: PickCreate) -> Pick:
        """Create a new pick."""
        data = {
            "game_id": str(pick.game_id),
            "predicted_winner_id": str(pick.predicted_winner_id) if pick.predicted_winner_id else None,
            "home_score_predicted": pick.home_score_predicted,
            "away_score_predicted": pick.away_score_predicted,
            "confidence": pick.confidence,
            "confidence_score": pick.confidence_score,
            "analysis_factors": pick.analysis_factors,
            "algorithm_version": pick.algorithm_version,
        }
        result = self._db.table("picks").insert(data).execute()
        return Pick(**result.data[0])

    async def upsert(self, pick: PickCreate) -> Pick:
        """Create or update pick for a game/version."""
        existing = await self.get_by_game(pick.game_id, pick.algorithm_version)

        if existing:
            # Update existing
            data = {
                "predicted_winner_id": str(pick.predicted_winner_id) if pick.predicted_winner_id else None,
                "home_score_predicted": pick.home_score_predicted,
                "away_score_predicted": pick.away_score_predicted,
                "confidence": pick.confidence,
                "confidence_score": pick.confidence_score,
                "analysis_factors": pick.analysis_factors,
            }
            result = (
                self._db.table("picks")
                .update(data)
                .eq("id", str(existing.id))
                .execute()
            )
            return Pick(**result.data[0])

        return await self.create(pick)

    async def update_result(
        self,
        pick_id: UUID,
        was_correct: bool,
        score_diff_error: float,
    ) -> Pick:
        """Update pick with actual result."""
        data = {
            "was_correct": was_correct,
            "score_diff_error": score_diff_error,
        }
        result = (
            self._db.table("picks")
            .update(data)
            .eq("id", str(pick_id))
            .execute()
        )
        return Pick(**result.data[0])
```

**Step 2: Create picks.py router**

```python
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from app.config import settings
from app.models import Game, PickAnalysis
from app.repositories.games import GameRepository
from app.repositories.picks import PickRepository, PickCreate
from app.repositories.teams import TeamRepository
from app.services.analyzer import analyze_game

router = APIRouter(prefix="/picks", tags=["picks"])


@router.get("")
async def get_picks(
    date_param: Optional[date] = Query(None, alias="date"),
    sport: Optional[str] = Query(None),
    confidence: Optional[str] = Query(None),
) -> list[dict]:
    """
    Get picks for a date, optionally filtered by sport and confidence.

    Generates picks if they don't exist.
    """
    target_date = datetime.combine(date_param, datetime.min.time()) if date_param else datetime.utcnow()

    # Get games for the date
    game_repo = GameRepository()
    games = await game_repo.get_by_date(target_date)

    if sport:
        games = [g for g in games if g.sport == sport]

    if not games:
        return []

    # Get or generate picks
    pick_repo = PickRepository()
    team_repo = TeamRepository()
    results = []

    for game in games:
        # Check for existing pick
        pick = await pick_repo.get_by_game(game.id, settings.algorithm_version)

        if not pick:
            # Generate new pick
            analysis = await analyze_game(game, game.espn_data or {})

            # Determine winner ID
            winner_id = None
            if analysis.pick_type == "home":
                winner_id = game.home_team_id
            elif analysis.pick_type == "away":
                winner_id = game.away_team_id

            # Store pick
            pick = await pick_repo.upsert(
                PickCreate(
                    game_id=game.id,
                    predicted_winner_id=winner_id,
                    home_score_predicted=int(analysis.projection.home_points),
                    away_score_predicted=int(analysis.projection.away_points),
                    confidence=analysis.confidence,
                    confidence_score=analysis.differential,
                    analysis_factors={
                        "pick_type": analysis.pick_type,
                        "reasoning": analysis.reasoning,
                        "home_score": analysis.home_score,
                        "away_score": analysis.away_score,
                    },
                    algorithm_version=settings.algorithm_version,
                )
            )

        if confidence and pick.confidence != confidence:
            continue

        # Get team names
        home_team = await team_repo.get_by_id(game.home_team_id) if game.home_team_id else None
        away_team = await team_repo.get_by_id(game.away_team_id) if game.away_team_id else None

        results.append({
            "game": game.model_dump(),
            "pick": pick.model_dump(),
            "home_team": home_team.model_dump() if home_team else None,
            "away_team": away_team.model_dump() if away_team else None,
        })

    return results


@router.get("/{game_id}")
async def get_pick(game_id: str) -> dict:
    """Get pick for a specific game."""
    game_repo = GameRepository()
    pick_repo = PickRepository()
    team_repo = TeamRepository()

    # Try to find game by UUID or ESPN ID
    game = await game_repo.get_by_id(game_id) if "-" in game_id else await game_repo.get_by_espn_id(game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Get or generate pick
    pick = await pick_repo.get_by_game(game.id, settings.algorithm_version)

    if not pick:
        analysis = await analyze_game(game, game.espn_data or {})

        winner_id = None
        if analysis.pick_type == "home":
            winner_id = game.home_team_id
        elif analysis.pick_type == "away":
            winner_id = game.away_team_id

        pick = await pick_repo.upsert(
            PickCreate(
                game_id=game.id,
                predicted_winner_id=winner_id,
                home_score_predicted=int(analysis.projection.home_points),
                away_score_predicted=int(analysis.projection.away_points),
                confidence=analysis.confidence,
                confidence_score=analysis.differential,
                analysis_factors={
                    "pick_type": analysis.pick_type,
                    "reasoning": analysis.reasoning,
                    "home_score": analysis.home_score,
                    "away_score": analysis.away_score,
                },
                algorithm_version=settings.algorithm_version,
            )
        )

    home_team = await team_repo.get_by_id(game.home_team_id) if game.home_team_id else None
    away_team = await team_repo.get_by_id(game.away_team_id) if game.away_team_id else None

    return {
        "game": game.model_dump(),
        "pick": pick.model_dump(),
        "home_team": home_team.model_dump() if home_team else None,
        "away_team": away_team.model_dump() if away_team else None,
    }
```

**Step 3: Update main.py**

```python
from fastapi import FastAPI

from app.database import get_db
from app.routers import games, picks

app = FastAPI(
    title="RTP API",
    description="Sports betting analysis API",
    version="0.1.0",
)

# Include routers
app.include_router(games.router)
app.include_router(picks.router)


@app.get("/health")
async def health_check():
    try:
        db = get_db()
        result = db.table("algorithm_versions").select("version").limit(1).execute()
        db_status = "connected"
        current_version = result.data[0]["version"] if result.data else "unknown"
    except Exception as e:
        db_status = f"error: {str(e)}"
        current_version = "unknown"

    return {
        "status": "healthy",
        "version": "0.1.0",
        "database": db_status,
        "algorithm_version": current_version,
    }
```

**Step 4: Test picks endpoint**

```bash
uvicorn app.main:app --reload --port 8000
```

```bash
curl "http://localhost:8000/picks?date=2026-01-31"
```

**Step 5: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add picks repository and endpoint"
```

---

## Phase 4: Parlays & Background Jobs

### Task 4.1: Create Parlay Builder Service

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/services/parlays.py`

**Step 1: Create parlays.py**

```python
from typing import Optional

from app.models import Pick, Game, GameWithPick, ParlayRecommendation
from app.repositories.teams import TeamRepository


async def build_lock_parlay(
    games_with_picks: list[tuple[Game, Pick, dict]],
) -> Optional[ParlayRecommendation]:
    """Build Lock of the Day parlay (high confidence only)."""
    high_conf = [
        (g, p, t) for g, p, t in games_with_picks
        if p.confidence == "high"
    ]
    high_conf.sort(key=lambda x: x[1].confidence_score, reverse=True)

    if len(high_conf) < 2:
        return None

    selected = high_conf[:3]
    picks = [_to_game_with_pick(g, p, t) for g, p, t in selected]

    return ParlayRecommendation(
        id="lock",
        category="lock",
        title="Lock of the Day",
        subtitle=f"{len(picks)} legs - High confidence",
        picks=picks,
        icon="lock",
    )


async def build_value_parlay(
    games_with_picks: list[tuple[Game, Pick, dict]],
) -> Optional[ParlayRecommendation]:
    """Build Best Value parlay (biggest edge)."""
    qualified = [
        (g, p, t) for g, p, t in games_with_picks
        if p.confidence != "low"
    ]
    qualified.sort(key=lambda x: x[1].confidence_score, reverse=True)

    if len(qualified) < 3:
        return None

    selected = qualified[:4]
    picks = [_to_game_with_pick(g, p, t) for g, p, t in selected]

    return ParlayRecommendation(
        id="value",
        category="value",
        title="Best Value",
        subtitle=f"{len(picks)} legs - Strong edge",
        picks=picks,
        icon="gem",
    )


async def build_longshot_parlay(
    games_with_picks: list[tuple[Game, Pick, dict]],
) -> Optional[ParlayRecommendation]:
    """Build Longshot parlay (5-7 legs, mixed sports)."""
    qualified = [
        (g, p, t) for g, p, t in games_with_picks
        if p.confidence != "low"
    ]
    qualified.sort(key=lambda x: x[1].confidence_score, reverse=True)

    if len(qualified) < 5:
        return None

    # Try to get variety of sports
    selected = []
    used_sports = set()

    for g, p, t in qualified:
        if g.sport not in used_sports and len(selected) < 6:
            selected.append((g, p, t))
            used_sports.add(g.sport)

    # Fill remaining
    for g, p, t in qualified:
        if len(selected) >= 6:
            break
        if (g, p, t) not in selected:
            selected.append((g, p, t))

    if len(selected) < 5:
        return None

    picks = [_to_game_with_pick(g, p, t) for g, p, t in selected]

    return ParlayRecommendation(
        id="longshot",
        category="longshot",
        title="Longshot",
        subtitle=f"{len(picks)} legs - High risk/reward",
        picks=picks,
        icon="rocket",
    )


async def build_sport_parlays(
    games_with_picks: list[tuple[Game, Pick, dict]],
) -> list[ParlayRecommendation]:
    """Build sport-specific parlays."""
    parlays = []

    by_sport: dict[str, list] = {}
    for g, p, t in games_with_picks:
        if g.sport not in by_sport:
            by_sport[g.sport] = []
        by_sport[g.sport].append((g, p, t))

    sport_info = {
        "basketball": ("NBA", "basketball"),
        "football": ("NFL", "football"),
        "hockey": ("NHL", "ice-hockey"),
        "baseball": ("MLB", "baseball"),
        "soccer": ("Soccer", "soccer"),
    }

    for sport, sport_games in by_sport.items():
        if len(sport_games) < 3:
            continue

        qualified = [
            (g, p, t) for g, p, t in sport_games
            if p.confidence != "low"
        ]
        qualified.sort(key=lambda x: x[1].confidence_score, reverse=True)

        if len(qualified) < 3:
            continue

        selected = qualified[:5]
        picks = [_to_game_with_pick(g, p, t) for g, p, t in selected]

        name, icon = sport_info.get(sport, (sport.title(), "target"))

        parlays.append(ParlayRecommendation(
            id=f"sport-{sport}",
            category="sport",
            title=f"{name} Special",
            subtitle=f"{len(picks)} legs - All {name}",
            picks=picks,
            icon=icon,
        ))

    return parlays


async def build_custom_parlay(
    games_with_picks: list[tuple[Game, Pick, dict]],
    num_legs: int,
    sports_filter: Optional[set[str]] = None,
) -> Optional[ParlayRecommendation]:
    """Build custom parlay with specified legs and optional sport filter."""
    filtered = games_with_picks
    if sports_filter:
        filtered = [(g, p, t) for g, p, t in filtered if g.sport in sports_filter]

    qualified = [
        (g, p, t) for g, p, t in filtered
        if p.confidence != "low"
    ]
    qualified.sort(key=lambda x: x[1].confidence_score, reverse=True)

    if len(qualified) < num_legs:
        # Include low confidence if needed
        qualified = list(filtered)
        qualified.sort(key=lambda x: x[1].confidence_score, reverse=True)

    if len(qualified) < num_legs:
        return None

    # Try for variety
    selected = []
    used_sports = set()

    for g, p, t in qualified:
        if g.sport not in used_sports and len(selected) < num_legs:
            selected.append((g, p, t))
            used_sports.add(g.sport)

    for g, p, t in qualified:
        if len(selected) >= num_legs:
            break
        if (g, p, t) not in selected:
            selected.append((g, p, t))

    picks = [_to_game_with_pick(g, p, t) for g, p, t in selected]

    return ParlayRecommendation(
        id=f"custom-{num_legs}",
        category="custom",
        title=f"Custom {num_legs}-Leg",
        subtitle=f"{len(picks)} legs - Your pick",
        picks=picks,
        icon="sparkles",
    )


async def generate_all_parlays(
    games_with_picks: list[tuple[Game, Pick, dict]],
) -> list[ParlayRecommendation]:
    """Generate all parlay recommendations."""
    parlays = []

    # Lock of the Day
    lock = await build_lock_parlay(games_with_picks)
    if lock:
        parlays.append(lock)

    # Best Value
    value = await build_value_parlay(games_with_picks)
    if value:
        parlays.append(value)

    # Sport Specials (only if 15+ games)
    if len(games_with_picks) >= 15:
        sport_parlays = await build_sport_parlays(games_with_picks)
        parlays.extend(sport_parlays)

    # Longshot (only if 5+ games)
    if len(games_with_picks) >= 5:
        longshot = await build_longshot_parlay(games_with_picks)
        if longshot:
            parlays.append(longshot)

    return parlays


def _to_game_with_pick(game: Game, pick: Pick, teams: dict) -> GameWithPick:
    """Convert to GameWithPick response model."""
    from app.models import Team, PickAnalysis, GameProjection

    factors = pick.analysis_factors or {}

    return GameWithPick(
        game=game,
        home_team=Team(**teams["home"]) if teams.get("home") else None,
        away_team=Team(**teams["away"]) if teams.get("away") else None,
        pick=pick,
        analysis=PickAnalysis(
            pick_type=factors.get("pick_type", "home"),
            confidence=pick.confidence,
            reasoning=factors.get("reasoning", []),
            home_score=factors.get("home_score", 50),
            away_score=factors.get("away_score", 50),
            differential=pick.confidence_score,
            projection=GameProjection(
                home_points=pick.home_score_predicted,
                away_points=pick.away_score_predicted,
                total_points=pick.home_score_predicted + pick.away_score_predicted,
                projected_winner="home" if pick.home_score_predicted >= pick.away_score_predicted else "away",
                projected_margin=pick.home_score_predicted - pick.away_score_predicted,
                confidence=pick.confidence,
            ),
        ),
    )
```

**Step 2: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add parlay builder service"
```

---

### Task 4.2: Create Parlays Endpoint

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/routers/parlays.py`
- Modify: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/main.py`

**Step 1: Create parlays.py router**

```python
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.config import settings
from app.repositories.games import GameRepository
from app.repositories.picks import PickRepository, PickCreate
from app.repositories.teams import TeamRepository
from app.services.analyzer import analyze_game
from app.services.parlays import generate_all_parlays, build_custom_parlay

router = APIRouter(prefix="/parlays", tags=["parlays"])


class CustomParlayRequest(BaseModel):
    leg_count: int
    sports: Optional[list[str]] = None


@router.get("")
async def get_parlays(
    date_param: Optional[date] = Query(None, alias="date"),
    type_param: Optional[str] = Query(None, alias="type"),
) -> list[dict]:
    """
    Get parlay recommendations for a date.

    Optionally filter by type: lock, value, sport, longshot, mega, custom
    """
    target_date = datetime.combine(date_param, datetime.min.time()) if date_param else datetime.utcnow()

    # Get games and picks
    games_with_picks = await _get_games_with_picks(target_date)

    if not games_with_picks:
        return []

    # Generate parlays
    parlays = await generate_all_parlays(games_with_picks)

    if type_param:
        parlays = [p for p in parlays if p.category == type_param]

    return [p.model_dump() for p in parlays]


@router.post("/custom")
async def create_custom_parlay(
    request: CustomParlayRequest,
    date_param: Optional[date] = Query(None, alias="date"),
) -> dict:
    """Generate a custom parlay with specified legs and sports."""
    target_date = datetime.combine(date_param, datetime.min.time()) if date_param else datetime.utcnow()

    games_with_picks = await _get_games_with_picks(target_date)

    if not games_with_picks:
        return {"error": "No games available"}

    sports_filter = set(request.sports) if request.sports else None

    parlay = await build_custom_parlay(
        games_with_picks,
        request.leg_count,
        sports_filter,
    )

    if not parlay:
        return {"error": f"Not enough games for {request.leg_count}-leg parlay"}

    return parlay.model_dump()


async def _get_games_with_picks(
    target_date: datetime,
) -> list[tuple]:
    """Get games with their picks and team data."""
    game_repo = GameRepository()
    pick_repo = PickRepository()
    team_repo = TeamRepository()

    games = await game_repo.get_by_date(target_date)

    results = []
    for game in games:
        # Get or generate pick
        pick = await pick_repo.get_by_game(game.id, settings.algorithm_version)

        if not pick:
            analysis = await analyze_game(game, game.espn_data or {})

            winner_id = None
            if analysis.pick_type == "home":
                winner_id = game.home_team_id
            elif analysis.pick_type == "away":
                winner_id = game.away_team_id

            pick = await pick_repo.upsert(
                PickCreate(
                    game_id=game.id,
                    predicted_winner_id=winner_id,
                    home_score_predicted=int(analysis.projection.home_points),
                    away_score_predicted=int(analysis.projection.away_points),
                    confidence=analysis.confidence,
                    confidence_score=analysis.differential,
                    analysis_factors={
                        "pick_type": analysis.pick_type,
                        "reasoning": analysis.reasoning,
                        "home_score": analysis.home_score,
                        "away_score": analysis.away_score,
                    },
                    algorithm_version=settings.algorithm_version,
                )
            )

        # Get teams
        home_team = await team_repo.get_by_id(game.home_team_id) if game.home_team_id else None
        away_team = await team_repo.get_by_id(game.away_team_id) if game.away_team_id else None

        teams = {
            "home": home_team.model_dump() if home_team else None,
            "away": away_team.model_dump() if away_team else None,
        }

        results.append((game, pick, teams))

    return results
```

**Step 2: Update main.py**

```python
from fastapi import FastAPI

from app.database import get_db
from app.routers import games, picks, parlays

app = FastAPI(
    title="RTP API",
    description="Sports betting analysis API",
    version="0.1.0",
)

# Include routers
app.include_router(games.router)
app.include_router(picks.router)
app.include_router(parlays.router)


@app.get("/health")
async def health_check():
    try:
        db = get_db()
        result = db.table("algorithm_versions").select("version").limit(1).execute()
        db_status = "connected"
        current_version = result.data[0]["version"] if result.data else "unknown"
    except Exception as e:
        db_status = f"error: {str(e)}"
        current_version = "unknown"

    return {
        "status": "healthy",
        "version": "0.1.0",
        "database": db_status,
        "algorithm_version": current_version,
    }
```

**Step 3: Test parlays endpoint**

```bash
curl "http://localhost:8000/parlays?date=2026-01-31"
```

**Step 4: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add parlays endpoint"
```

---

### Task 4.3: Create Background Jobs

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/jobs.py`
- Modify: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/app/main.py`

**Step 1: Create jobs.py**

```python
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.espn import ESPNClient
from app.models import TeamCreate, GameCreate
from app.repositories.games import GameRepository
from app.repositories.picks import PickRepository, PickCreate
from app.repositories.teams import TeamRepository
from app.services.analyzer import analyze_game

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def fetch_games_job():
    """Fetch games for next 3 days and generate picks."""
    logger.info("Running fetch_games_job")

    espn = ESPNClient()
    game_repo = GameRepository()
    team_repo = TeamRepository()
    pick_repo = PickRepository()

    try:
        for days_ahead in range(3):
            target_date = datetime.utcnow() + timedelta(days=days_ahead)
            logger.info(f"Fetching games for {target_date.date()}")

            espn_games = await espn.fetch_all_games(target_date)

            for eg in espn_games:
                # Get or create teams
                home_team = await team_repo.get_or_create(
                    TeamCreate(
                        espn_id=eg.home_team.id,
                        name=eg.home_team.name,
                        abbreviation=eg.home_team.abbreviation,
                        sport=eg.sport,
                        logo_url=eg.home_team.logo,
                    )
                )
                away_team = await team_repo.get_or_create(
                    TeamCreate(
                        espn_id=eg.away_team.id,
                        name=eg.away_team.name,
                        abbreviation=eg.away_team.abbreviation,
                        sport=eg.sport,
                        logo_url=eg.away_team.logo,
                    )
                )

                # Create/update game
                game = await game_repo.upsert(
                    GameCreate(
                        espn_id=eg.id,
                        sport=eg.sport,
                        home_team_id=home_team.id,
                        away_team_id=away_team.id,
                        scheduled_at=eg.start_time,
                        status=eg.status,
                        espn_data={
                            "league": eg.league,
                            "home_record": eg.home_record,
                            "away_record": eg.away_record,
                            "odds": eg.odds.model_dump() if eg.odds else None,
                        },
                    )
                )

                # Generate pick if none exists
                existing_pick = await pick_repo.get_by_game(game.id, settings.algorithm_version)
                if not existing_pick:
                    analysis = await analyze_game(game, game.espn_data or {})

                    winner_id = None
                    if analysis.pick_type == "home":
                        winner_id = game.home_team_id
                    elif analysis.pick_type == "away":
                        winner_id = game.away_team_id

                    await pick_repo.create(
                        PickCreate(
                            game_id=game.id,
                            predicted_winner_id=winner_id,
                            home_score_predicted=int(analysis.projection.home_points),
                            away_score_predicted=int(analysis.projection.away_points),
                            confidence=analysis.confidence,
                            confidence_score=analysis.differential,
                            analysis_factors={
                                "pick_type": analysis.pick_type,
                                "reasoning": analysis.reasoning,
                                "home_score": analysis.home_score,
                                "away_score": analysis.away_score,
                            },
                            algorithm_version=settings.algorithm_version,
                        )
                    )

            logger.info(f"Processed {len(espn_games)} games for {target_date.date()}")

    finally:
        await espn.close()

    logger.info("fetch_games_job completed")


async def update_results_job():
    """Check for game results and update picks."""
    logger.info("Running update_results_job")

    espn = ESPNClient()
    game_repo = GameRepository()
    pick_repo = PickRepository()

    try:
        # Get games needing results
        pending_games = await game_repo.get_pending_results()
        logger.info(f"Found {len(pending_games)} games pending results")

        for game in pending_games:
            # Fetch current status from ESPN
            espn_games = await espn.fetch_games(
                _get_league_key(game.sport),
                game.scheduled_at,
            )

            espn_game = next(
                (eg for eg in espn_games if eg.id == game.espn_id),
                None,
            )

            if not espn_game:
                continue

            if espn_game.status == "final":
                # Update game with final score
                await game_repo.update_result(
                    game.id,
                    status="final",
                    home_score=espn_game.home_score,
                    away_score=espn_game.away_score,
                )

                # Update pick accuracy
                pick = await pick_repo.get_by_game(game.id)
                if pick and espn_game.home_score is not None and espn_game.away_score is not None:
                    # Determine if pick was correct
                    actual_winner = "home" if espn_game.home_score > espn_game.away_score else "away"
                    if espn_game.home_score == espn_game.away_score:
                        actual_winner = "draw"

                    factors = pick.analysis_factors or {}
                    predicted_winner = factors.get("pick_type", "home")
                    was_correct = predicted_winner == actual_winner

                    # Calculate score prediction error
                    predicted_margin = pick.home_score_predicted - pick.away_score_predicted
                    actual_margin = espn_game.home_score - espn_game.away_score
                    score_diff_error = abs(predicted_margin - actual_margin)

                    await pick_repo.update_result(
                        pick.id,
                        was_correct=was_correct,
                        score_diff_error=score_diff_error,
                    )

                    logger.info(
                        f"Updated pick for game {game.espn_id}: "
                        f"correct={was_correct}, error={score_diff_error}"
                    )

            elif espn_game.status == "in_progress":
                await game_repo.update_result(
                    game.id,
                    status="in_progress",
                    home_score=espn_game.home_score,
                    away_score=espn_game.away_score,
                )

    finally:
        await espn.close()

    logger.info("update_results_job completed")


def _get_league_key(sport: str) -> str:
    """Get league key from sport name."""
    from app.espn import ENDPOINTS
    for key, config in ENDPOINTS.items():
        if config["sport"] == sport:
            return key
    return "nba"


def start_scheduler():
    """Start the background job scheduler."""
    # Fetch games every 6 hours
    scheduler.add_job(
        fetch_games_job,
        "interval",
        hours=6,
        id="fetch_games",
        replace_existing=True,
    )

    # Update results every 15 minutes
    scheduler.add_job(
        update_results_job,
        "interval",
        minutes=15,
        id="update_results",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Background scheduler started")


def stop_scheduler():
    """Stop the background job scheduler."""
    scheduler.shutdown()
    logger.info("Background scheduler stopped")
```

**Step 2: Update main.py with scheduler lifecycle**

```python
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI

from app.database import get_db
from app.routers import games, picks, parlays
from app.jobs import start_scheduler, stop_scheduler, fetch_games_job

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler()
    # Run initial fetch
    await fetch_games_job()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="RTP API",
    description="Sports betting analysis API",
    version="0.1.0",
    lifespan=lifespan,
)

# Include routers
app.include_router(games.router)
app.include_router(picks.router)
app.include_router(parlays.router)


@app.get("/health")
async def health_check():
    try:
        db = get_db()
        result = db.table("algorithm_versions").select("version").limit(1).execute()
        db_status = "connected"
        current_version = result.data[0]["version"] if result.data else "unknown"
    except Exception as e:
        db_status = f"error: {str(e)}"
        current_version = "unknown"

    return {
        "status": "healthy",
        "version": "0.1.0",
        "database": db_status,
        "algorithm_version": current_version,
    }
```

**Step 3: Test locally**

```bash
uvicorn app.main:app --reload --port 8000
```

Check logs for scheduler startup and initial fetch.

**Step 4: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add background jobs for game fetching and result tracking"
```

---

## Phase 5: Deployment

### Task 5.1: Create Railway Deployment Files

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/Procfile`
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp-api/railway.toml`

**Step 1: Create Procfile**

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Step 2: Create railway.toml**

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

**Step 3: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp-api
git add .
git commit -m "feat: add Railway deployment configuration"
```

---

### Task 5.2: Deploy to Railway

**Step 1: Create Railway project**

1. Go to https://railway.app and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account if not already connected
5. Select the rtp-api repository

**Step 2: Add environment variables**

In Railway dashboard:
1. Click on the service
2. Go to "Variables" tab
3. Add:
   - `SUPABASE_URL` = your Supabase URL
   - `SUPABASE_KEY` = your Supabase anon key

**Step 3: Verify deployment**

1. Wait for build to complete
2. Click on the generated URL
3. Add `/health` to the URL
4. Verify response shows healthy status

**Step 4: Note the API URL**

Save the Railway URL (e.g., `https://rtp-api-production.up.railway.app`) for mobile app configuration.

---

## Phase 6: Mobile App Migration

### Task 6.1: Create API Service in Mobile App

**Files:**
- Create: `/Users/marcelmeijer/Documents/RTP-dev/rtp/services/api.ts`

**Step 1: Create api.ts**

```typescript
// API service for RTP backend

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://your-api.railway.app';

export interface APIGame {
  id: string;
  espn_id: string;
  sport: string;
  home_team_id: string | null;
  away_team_id: string | null;
  scheduled_at: string;
  status: string;
  home_score_actual: number | null;
  away_score_actual: number | null;
  espn_data: {
    league: string;
    home_record: string | null;
    away_record: string | null;
    odds: {
      spread: number | null;
      over_under: number | null;
      home_moneyline: number | null;
      away_moneyline: number | null;
    } | null;
  } | null;
}

export interface APITeam {
  id: string;
  espn_id: string;
  name: string;
  abbreviation: string;
  sport: string;
  logo_url: string | null;
}

export interface APIPick {
  id: string;
  game_id: string;
  predicted_winner_id: string | null;
  home_score_predicted: number;
  away_score_predicted: number;
  confidence: 'low' | 'medium' | 'high';
  confidence_score: number;
  analysis_factors: {
    pick_type: string;
    reasoning: string[];
    home_score: number;
    away_score: number;
  };
  algorithm_version: string;
  was_correct: boolean | null;
  score_diff_error: number | null;
}

export interface APIGameWithPick {
  game: APIGame;
  pick: APIPick | null;
  home_team: APITeam | null;
  away_team: APITeam | null;
}

export interface APIParlay {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  picks: APIGameWithPick[];
  icon: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function fetchGames(date: Date, sport?: string): Promise<APIGameWithPick[]> {
  const params = new URLSearchParams({ date: formatDate(date) });
  if (sport) params.append('sport', sport);

  const response = await fetch(`${API_BASE}/picks?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch games: ${response.status}`);
  }
  return response.json();
}

export async function fetchParlays(date: Date, type?: string): Promise<APIParlay[]> {
  const params = new URLSearchParams({ date: formatDate(date) });
  if (type) params.append('type', type);

  const response = await fetch(`${API_BASE}/parlays?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch parlays: ${response.status}`);
  }
  return response.json();
}

export async function createCustomParlay(
  date: Date,
  legCount: number,
  sports?: string[],
): Promise<APIParlay | { error: string }> {
  const params = new URLSearchParams({ date: formatDate(date) });

  const response = await fetch(`${API_BASE}/parlays/custom?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leg_count: legCount,
      sports: sports || null,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create custom parlay: ${response.status}`);
  }
  return response.json();
}

export async function fetchSports(): Promise<{ key: string; name: string; sport: string; league: string }[]> {
  const response = await fetch(`${API_BASE}/games/sports`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sports: ${response.status}`);
  }
  return response.json();
}

export async function checkHealth(): Promise<{ status: string; version: string; database: string }> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`API health check failed: ${response.status}`);
  }
  return response.json();
}
```

**Step 2: Add environment variable**

Create `/Users/marcelmeijer/Documents/RTP-dev/rtp/.env`:

```
EXPO_PUBLIC_API_URL=https://your-api.railway.app
```

**Step 3: Update .gitignore**

Add to `/Users/marcelmeijer/Documents/RTP-dev/rtp/.gitignore`:

```
.env
.env.local
```

**Step 4: Commit**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp
git add services/api.ts .gitignore
git commit -m "feat: add API service for backend communication"
```

---

### Task 6.2: Update Sports Tab to Use API

**Files:**
- Modify: `/Users/marcelmeijer/Documents/RTP-dev/rtp/app/(tabs)/sports.tsx`

This task requires reading the current file and updating it to use the new API service instead of the local ESPN/analysis services. The changes include:

1. Import the new API service
2. Replace `fetchGames` calls with API calls
3. Update the data transformation to match API response format
4. Remove imports of old services

**Step 1: Read current file and make changes**

The specific changes depend on the current implementation. The general pattern is:

```typescript
// Replace:
import { fetchGames } from '../../services/espn';
import { analyzeGames } from '../../services/analysis';

// With:
import { fetchGames as fetchGamesAPI } from '../../services/api';

// Replace game fetching logic:
// Old:
const games = await fetchGames(filter, selectedDate);
const analyses = await analyzeGames(games);

// New:
const gamesWithPicks = await fetchGamesAPI(selectedDate, sportFilter);
// Data already includes picks from API
```

**Step 2: Test the app**

```bash
cd /Users/marcelmeijer/Documents/RTP-dev/rtp
npx expo start
```

Verify games load from the API.

**Step 3: Commit**

```bash
git add app/(tabs)/sports.tsx
git commit -m "refactor: update sports tab to use API backend"
```

---

### Task 6.3: Update Parlays Tab to Use API

Similar process for the parlays tab - update to use `fetchParlays` and `createCustomParlay` from the API service.

---

## Summary

This implementation plan covers:

1. **Phase 1**: Project setup, Supabase schema, database connection
2. **Phase 2**: ESPN client, team/game repositories, games endpoint
3. **Phase 3**: Analysis engine, game analyzer, picks endpoint
4. **Phase 4**: Parlay builder, parlays endpoint, background jobs
5. **Phase 5**: Railway deployment
6. **Phase 6**: Mobile app migration to use API

Each task is designed to be completed in 2-5 minutes with TDD approach where applicable.
