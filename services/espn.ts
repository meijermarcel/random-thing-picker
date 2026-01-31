import { Game, GameOdds, SportFilter, TeamStats, AdvancedStats, ScheduleGame, ScheduleContext, HeadToHead, InjuredPlayer, InjuryReport } from '../types/sports';

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

export const ENDPOINTS: Record<Exclude<SportFilter, 'all'>, { sport: string; league: string; name: string }> = {
  nfl: { sport: 'football', league: 'nfl', name: 'NFL' },
  nba: { sport: 'basketball', league: 'nba', name: 'NBA' },
  ncaam: { sport: 'basketball', league: 'mens-college-basketball', name: 'NCAAM' },
  mlb: { sport: 'baseball', league: 'mlb', name: 'MLB' },
  nhl: { sport: 'hockey', league: 'nhl', name: 'NHL' },
  soccer: { sport: 'soccer', league: 'eng.1', name: 'Premier League' },
};

// Parse record string like "10-5" or "10-5-2" into wins/losses
function parseRecord(record: string | undefined): { wins: number; losses: number } {
  if (!record) return { wins: 0, losses: 0 };
  const parts = record.split('-').map(n => parseInt(n, 10));
  return { wins: parts[0] || 0, losses: parts[1] || 0 };
}

// Parse odds from ESPN API competition data
function parseOdds(competition: any): GameOdds | undefined {
  const oddsArray = competition?.odds;
  if (!oddsArray || oddsArray.length === 0) return undefined;
  
  // Use the first odds provider (usually the primary one)
  const oddsData = oddsArray[0];
  
  // Extract spread - ESPN format varies, check multiple possible locations
  let spread: number | undefined;
  let overUnder: number | undefined;
  let homeMoneyline: number | undefined;
  let awayMoneyline: number | undefined;
  
  // Check for spread in details array
  if (oddsData.details) {
    // Details string format is like "LAL -5.5" 
    const detailsMatch = oddsData.details.match(/([+-]?\d+\.?\d*)/);
    if (detailsMatch) {
      spread = parseFloat(detailsMatch[1]);
    }
  }
  
  // Check spread directly
  if (oddsData.spread !== undefined) {
    spread = parseFloat(oddsData.spread);
  }
  
  // Over/under total
  if (oddsData.overUnder !== undefined) {
    overUnder = parseFloat(oddsData.overUnder);
  }
  
  // Moneylines from homeTeamOdds/awayTeamOdds
  if (oddsData.homeTeamOdds?.moneyLine !== undefined) {
    homeMoneyline = parseInt(oddsData.homeTeamOdds.moneyLine, 10);
  }
  if (oddsData.awayTeamOdds?.moneyLine !== undefined) {
    awayMoneyline = parseInt(oddsData.awayTeamOdds.moneyLine, 10);
  }
  
  // Also check for spread in team odds
  if (spread === undefined && oddsData.homeTeamOdds?.spreadOdds !== undefined) {
    // If home has positive spread odds, they're the underdog
    const homeSpread = parseFloat(oddsData.homeTeamOdds.spreadOdds);
    if (!isNaN(homeSpread)) {
      spread = homeSpread;
    }
  }
  
  // If we still don't have spread, try to extract from awayTeamOdds
  if (spread === undefined && oddsData.awayTeamOdds?.spreadOdds !== undefined) {
    const awaySpread = parseFloat(oddsData.awayTeamOdds.spreadOdds);
    if (!isNaN(awaySpread)) {
      spread = -awaySpread; // Flip sign for home perspective
    }
  }
  
  if (spread === undefined && overUnder === undefined && 
      homeMoneyline === undefined && awayMoneyline === undefined) {
    return undefined;
  }
  
  return {
    spread,
    overUnder,
    homeMoneyline,
    awayMoneyline,
    provider: oddsData.provider?.name || 'ESPN',
  };
}

async function fetchLeagueGames(sport: string, league: string, leagueName: string): Promise<Game[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const events = data.events || [];

    const now = new Date();
    const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    return events
      .map((event: any) => {
        const competition = event.competitions?.[0];
        const homeTeamData = competition?.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeamData = competition?.competitors?.find((c: any) => c.homeAway === 'away');

        // Extract records - typically in records array, first entry is overall record
        const homeRecord = homeTeamData?.records?.[0]?.summary;
        const awayRecord = awayTeamData?.records?.[0]?.summary;
        
        // Extract odds
        const odds = parseOdds(competition);

        return {
          id: event.id,
          homeTeam: homeTeamData?.team?.displayName || 'TBD',
          awayTeam: awayTeamData?.team?.displayName || 'TBD',
          homeTeamId: homeTeamData?.team?.id,
          awayTeamId: awayTeamData?.team?.id,
          homeLogo: homeTeamData?.team?.logo,
          awayLogo: awayTeamData?.team?.logo,
          startTime: new Date(event.date),
          league: leagueName,
          leagueAbbr: league.toUpperCase(),
          sport: sport,
          homeRecord,
          awayRecord,
          odds,
        };
      })
      .filter((game: Game) => game.startTime <= maxDate);
  } catch {
    return [];
  }
}

// Fetch detailed team statistics
export async function fetchTeamStats(sport: string, league: string, teamId: string): Promise<TeamStats | null> {
  const teamUrl = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}`;
  
  try {
    const response = await fetch(teamUrl);
    if (!response.ok) return null;
    
    const data = await response.json();
    const team = data.team;
    
    if (!team) return null;

    // Parse record from team data
    const recordItems = team.record?.items || [];
    const overallRecord = recordItems.find((r: any) => r.type === 'total') || recordItems[0];
    const homeRecordItem = recordItems.find((r: any) => r.type === 'home');
    const awayRecordItem = recordItems.find((r: any) => r.type === 'road' || r.type === 'away');
    
    // Get stats from record
    const stats = overallRecord?.stats || [];
    const getStatValue = (name: string): number => {
      const stat = stats.find((s: any) => s.name === name);
      return stat?.value || 0;
    };

    const wins = getStatValue('wins');
    const losses = getStatValue('losses');
    const totalGames = wins + losses;
    
    // Parse home/away records
    const homeStats = homeRecordItem?.stats || [];
    const awayStats = awayRecordItem?.stats || [];
    const getRecordStats = (statsArr: any[]): { wins: number; losses: number } => {
      const w = statsArr.find((s: any) => s.name === 'wins')?.value || 0;
      const l = statsArr.find((s: any) => s.name === 'losses')?.value || 0;
      return { wins: w, losses: l };
    };

    const homeRecord = getRecordStats(homeStats);
    const awayRecord = getRecordStats(awayStats);

    // Get streak info
    const streakValue = getStatValue('streak');
    const streakType: 'W' | 'L' = streakValue >= 0 ? 'W' : 'L';

    // Get points/goals data
    const pointsFor = getStatValue('pointsFor') || getStatValue('avgPointsFor') * totalGames;
    const pointsAgainst = getStatValue('pointsAgainst') || getStatValue('avgPointsAgainst') * totalGames;

    return {
      teamId,
      teamName: team.displayName || team.name,
      wins,
      losses,
      winPct: totalGames > 0 ? wins / totalGames : 0.5,
      homeWins: homeRecord.wins,
      homeLosses: homeRecord.losses,
      awayWins: awayRecord.wins,
      awayLosses: awayRecord.losses,
      pointsFor,
      pointsAgainst,
      streak: Math.abs(streakValue),
      streakType,
    };
  } catch {
    return null;
  }
}

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

// Create basic stats from game record info when detailed API fails
export function createBasicStats(teamName: string, teamId: string, record: string | undefined): TeamStats {
  const { wins, losses } = parseRecord(record);
  const totalGames = wins + losses;
  
  return {
    teamId,
    teamName,
    wins,
    losses,
    winPct: totalGames > 0 ? wins / totalGames : 0.5,
    homeWins: Math.floor(wins / 2),
    homeLosses: Math.floor(losses / 2),
    awayWins: Math.ceil(wins / 2),
    awayLosses: Math.ceil(losses / 2),
    pointsFor: 0,
    pointsAgainst: 0,
    streak: 0,
    streakType: 'W',
  };
}

export async function fetchGames(filter: SportFilter): Promise<Game[]> {
  if (filter === 'all') {
    const allGames = await Promise.all(
      Object.entries(ENDPOINTS).map(([_, config]) =>
        fetchLeagueGames(config.sport, config.league, config.name)
      )
    );
    return allGames.flat().sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  const config = ENDPOINTS[filter];
  return fetchLeagueGames(config.sport, config.league, config.name);
}
