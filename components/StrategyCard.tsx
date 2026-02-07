import { View, Text, StyleSheet, Image } from 'react-native';
import { StrategyBet, StrategyParlay } from '../types/sports';

/** Format a dollar amount — whole dollars stay whole, otherwise show cents.
 *  Negative values render as -$12 (not $-12). */
export function fmtDollars(val: number): string {
  if (val < 0) return `-$${Math.abs(Number.isInteger(val) ? val : parseFloat(val.toFixed(2)))}`;
  if (Number.isInteger(val)) return `$${val}`;
  return `$${val.toFixed(2)}`;
}

const CONFIDENCE_COLORS = {
  high: '#34C759',
  medium: '#FF9500',
  low: '#FF3B30',
};

function formatGameTime(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `Today ${timeStr}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow ${timeStr}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

function formatTeamName(name: string, record?: string): string {
  if (record) return `${name} (${record})`;
  return name;
}

interface StraightBetCardProps {
  bet: StrategyBet;
}

export function StraightBetCard({ bet }: StraightBetCardProps) {
  const { pick, betLabel, reason, wager, potentialReturn } = bet;
  const confidence = pick.analysis?.confidence ?? 'medium';
  const confidenceColor = CONFIDENCE_COLORS[confidence];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.leagueBadge}>
          <Text style={styles.leagueText}>{pick.game.leagueAbbr}</Text>
        </View>
        <Text style={styles.gameTime}>{formatGameTime(pick.game.startTime)}</Text>
        <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor }]}>
          <Text style={styles.confidenceText}>{confidence.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.matchupRow}>
        <View style={styles.teamInfo}>
          {pick.game.awayLogo ? (
            <Image source={{ uri: pick.game.awayLogo }} style={styles.teamLogo} />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
          <Text style={[
            styles.teamName,
            pick.pickType === 'away' && styles.pickedTeamName,
          ]} numberOfLines={1}>
            {formatTeamName(pick.game.awayTeam, pick.game.awayRecord)}
          </Text>
        </View>
        <Text style={styles.atText}>@</Text>
        <View style={styles.teamInfo}>
          {pick.game.homeLogo ? (
            <Image source={{ uri: pick.game.homeLogo }} style={styles.teamLogo} />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
          <Text style={[
            styles.teamName,
            pick.pickType === 'home' && styles.pickedTeamName,
          ]} numberOfLines={1}>
            {formatTeamName(pick.game.homeTeam, pick.game.homeRecord)}
          </Text>
        </View>
      </View>

      <View style={styles.betRow}>
        <View style={styles.betTypeBadge}>
          <Text style={styles.betTypeText}>{betLabel}</Text>
        </View>
        <Text style={styles.wagerReturn}>
          {fmtDollars(wager)} <Text style={styles.arrow}>{'->'}</Text> <Text style={styles.returnGreen}>{fmtDollars(wager + potentialReturn)}</Text>
        </Text>
      </View>

      {reason ? (
        <Text style={styles.reason} numberOfLines={2}>{reason}</Text>
      ) : null}
    </View>
  );
}

/** Format American odds as string */
function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

interface ParlayStrategyCardProps {
  entry: StrategyParlay;
}

export function ParlayStrategyCard({ entry }: ParlayStrategyCardProps) {
  const { title, icon, legs, wager, potentialReturn } = entry;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.parlayIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.parlayTitle}>{title}</Text>
          <Text style={styles.parlaySubtitle}>
            {legs.length} legs
          </Text>
        </View>
        <Text style={styles.wagerReturn}>
          {fmtDollars(wager)} <Text style={styles.arrow}>{'->'}</Text> <Text style={styles.returnGreen}>{fmtDollars(wager + potentialReturn)}</Text>
        </Text>
      </View>

      <View style={styles.legsList}>
        {legs.map((leg, i) => (
          <View key={i} style={styles.legRow}>
            <Text style={styles.legItem} numberOfLines={1}>
              {leg.label}
            </Text>
            <Text style={[styles.legTypeBadgeText, leg.betType === 'spread' && styles.legTypeSpread]}>
              {leg.betType === 'spread' ? 'SPR' : 'ML'}
            </Text>
            <Text style={[styles.legOdds, leg.odds > 0 ? styles.legOddsPlus : null]}>
              {formatOdds(leg.odds)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface UnderdogCardProps {
  bet: StrategyBet;
}

export function UnderdogCard({ bet }: UnderdogCardProps) {
  const { pick, betLabel, reason, wager, potentialReturn } = bet;

  return (
    <View style={[styles.card, styles.underdogCard]}>
      <View style={styles.header}>
        <View style={styles.leagueBadge}>
          <Text style={styles.leagueText}>{pick.game.leagueAbbr}</Text>
        </View>
        <Text style={styles.gameTime}>{formatGameTime(pick.game.startTime)}</Text>
        <Text style={styles.underdogOdds}>{betLabel}</Text>
      </View>

      <View style={styles.matchupRow}>
        <View style={styles.teamInfo}>
          {pick.game.awayLogo ? (
            <Image source={{ uri: pick.game.awayLogo }} style={styles.teamLogo} />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
          <Text style={[
            styles.teamName,
            pick.pickType === 'away' && styles.pickedTeamName,
          ]} numberOfLines={1}>
            {formatTeamName(pick.game.awayTeam, pick.game.awayRecord)}
          </Text>
        </View>
        <Text style={styles.atText}>@</Text>
        <View style={styles.teamInfo}>
          {pick.game.homeLogo ? (
            <Image source={{ uri: pick.game.homeLogo }} style={styles.teamLogo} />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
          <Text style={[
            styles.teamName,
            pick.pickType === 'home' && styles.pickedTeamName,
          ]} numberOfLines={1}>
            {formatTeamName(pick.game.homeTeam, pick.game.homeRecord)}
          </Text>
        </View>
      </View>

      <View style={styles.betRow}>
        <Text style={styles.wagerReturn}>
          {fmtDollars(wager)} <Text style={styles.arrow}>{'->'}</Text> <Text style={styles.returnGreen}>{fmtDollars(wager + potentialReturn)}</Text>
        </Text>
      </View>

      {reason ? (
        <Text style={styles.reason} numberOfLines={2}>{reason}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  underdogCard: {
    backgroundColor: '#FFF8F0',
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  leagueBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  leagueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  gameTime: {
    flex: 1,
    fontSize: 13,
    color: '#888',
    marginLeft: 10,
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  logoPlaceholder: {
    width: 24,
    height: 24,
    marginRight: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  pickedTeamName: {
    color: '#007AFF',
    fontWeight: '700',
  },
  atText: {
    fontSize: 13,
    color: '#aaa',
    marginHorizontal: 8,
  },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  betTypeBadge: {
    backgroundColor: '#f0f7ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  betTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  wagerReturn: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  arrow: {
    color: '#aaa',
    fontWeight: '400',
  },
  returnGreen: {
    color: '#34C759',
  },
  reason: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  returnText: {
    fontSize: 12,
    color: '#888',
  },
  parlayIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  parlayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  parlaySubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  legsList: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  legItem: {
    flex: 1,
    fontSize: 14,
    color: '#444',
  },
  legTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    marginRight: 6,
  },
  legTypeSpread: {
    color: '#007AFF',
  },
  legOdds: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    minWidth: 50,
    textAlign: 'right',
  },
  legOddsPlus: {
    color: '#34C759',
  },
  underdogOdds: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FF9500',
  },
});
