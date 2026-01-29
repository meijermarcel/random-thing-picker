import { Game, SportFilter, TeamStats } from '../types/sports';

export const ENDPOINTS: Record<Exclude<SportFilter, 'all'>, { sport: string; league: string; name: string }> = {
  nfl: { sport: 'football', league: 'nfl', name: 'NFL' },
  nba: { sport: 'basketball', league: 'nba', name: 'NBA' },
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
