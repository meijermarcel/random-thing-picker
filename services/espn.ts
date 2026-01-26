import { Game, SportFilter } from '../types/sports';

const ENDPOINTS: Record<Exclude<SportFilter, 'all'>, { sport: string; league: string; name: string }> = {
  nfl: { sport: 'football', league: 'nfl', name: 'NFL' },
  nba: { sport: 'basketball', league: 'nba', name: 'NBA' },
  mlb: { sport: 'baseball', league: 'mlb', name: 'MLB' },
  nhl: { sport: 'hockey', league: 'nhl', name: 'NHL' },
  soccer: { sport: 'soccer', league: 'eng.1', name: 'Premier League' },
};

async function fetchLeagueGames(sport: string, league: string, leagueName: string): Promise<Game[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const events = data.events || [];

    return events.map((event: any) => {
      const competition = event.competitions?.[0];
      const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away');

      return {
        id: event.id,
        homeTeam: homeTeam?.team?.displayName || 'TBD',
        awayTeam: awayTeam?.team?.displayName || 'TBD',
        startTime: new Date(event.date),
        league: leagueName,
        leagueAbbr: league.toUpperCase(),
      };
    });
  } catch {
    return [];
  }
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
