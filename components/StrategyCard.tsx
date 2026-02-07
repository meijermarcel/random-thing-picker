import { View, Text, StyleSheet, Image } from 'react-native';
import { StrategyBet, StrategyParlay } from '../types/sports';

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
            {pick.game.awayTeam}
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
            {pick.game.homeTeam}
          </Text>
        </View>
      </View>

      <View style={styles.betRow}>
        <View style={styles.betTypeBadge}>
          <Text style={styles.betTypeText}>{betLabel}</Text>
        </View>
        <Text style={styles.wagerAmount}>${wager}</Text>
      </View>

      {reason ? (
        <Text style={styles.reason} numberOfLines={2}>{reason}</Text>
      ) : null}

      <Text style={styles.returnText}>
        Potential return: ${Math.round(potentialReturn)}
      </Text>
    </View>
  );
}

interface ParlayStrategyCardProps {
  entry: StrategyParlay;
}

export function ParlayStrategyCard({ entry }: ParlayStrategyCardProps) {
  const { parlay, wager } = entry;

  const pickSummary = parlay.picks
    .slice(0, 4)
    .map(p => {
      if (p.pickType === 'home') return p.game.homeTeam;
      if (p.pickType === 'away') return p.game.awayTeam;
      return p.label;
    });
  const moreCount = parlay.picks.length - 4;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.parlayIcon}>{parlay.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.parlayTitle}>{parlay.title}</Text>
          <Text style={styles.parlaySubtitle}>
            {parlay.picks.length} legs
          </Text>
        </View>
        <Text style={styles.wagerAmount}>${wager}</Text>
      </View>

      <View style={styles.legsList}>
        {pickSummary.map((name, i) => (
          <Text key={i} style={styles.legItem}>
            {name}{parlay.picks[i]?.analysis?.confidence === 'high' ? ' *' : ''}
          </Text>
        ))}
        {moreCount > 0 && (
          <Text style={styles.legMore}>+{moreCount} more</Text>
        )}
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
            {pick.game.awayTeam}
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
            {pick.game.homeTeam}
          </Text>
        </View>
      </View>

      <View style={styles.betRow}>
        <Text style={styles.wagerAmount}>${wager}</Text>
        <Text style={styles.returnText}>
          Win: ${Math.round(potentialReturn)}
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
  wagerAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
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
  legItem: {
    fontSize: 14,
    color: '#444',
    paddingVertical: 3,
  },
  legMore: {
    fontSize: 13,
    color: '#888',
    paddingVertical: 3,
  },
  underdogOdds: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FF9500',
  },
});
