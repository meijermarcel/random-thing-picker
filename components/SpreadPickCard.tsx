import { View, Text, StyleSheet, Image } from 'react-native';

interface SpreadPickCardProps {
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  spreadPick: 'home' | 'away';
  spreadConfidence: 'low' | 'medium' | 'high';
  spread: number;  // from home team perspective, negative = home favored
  projectedMargin: number;  // positive = home wins by X
  gameTime: Date;
  league: string;
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

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

function formatSpread(spread: number): string {
  if (spread > 0) return `+${spread}`;
  return spread.toString();
}

export function SpreadPickCard({
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  spreadPick,
  spreadConfidence,
  spread,
  projectedMargin,
  gameTime,
  league,
}: SpreadPickCardProps) {
  // Key calculations
  const pickTeam = spreadPick === 'home' ? homeTeam : awayTeam;
  const pickSpread = spreadPick === 'home' ? spread : -spread;
  const coverMargin = spreadPick === 'home'
    ? (projectedMargin + spread)
    : -(projectedMargin + spread);

  const confidenceColor = CONFIDENCE_COLORS[spreadConfidence];

  return (
    <View style={styles.card}>
      {/* Header: league badge, game time, confidence badge */}
      <View style={styles.header}>
        <View style={styles.leagueBadge}>
          <Text style={styles.leagueText}>{league}</Text>
        </View>
        <Text style={styles.gameTime}>{formatGameTime(gameTime)}</Text>
        <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor }]}>
          <Text style={styles.confidenceText}>{spreadConfidence.toUpperCase()}</Text>
        </View>
      </View>

      {/* Teams stacked vertically */}
      <View style={styles.teamsContainer}>
        <View style={[styles.teamRow, spreadPick === 'away' && styles.pickedTeamRow]}>
          {awayLogo ? (
            <Image source={{ uri: awayLogo }} style={styles.teamLogo} />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
          <Text
            style={[styles.teamName, spreadPick === 'away' && styles.pickedTeamName]}
            numberOfLines={1}
          >
            {awayTeam}
          </Text>
          {spreadPick === 'away' && <Text style={styles.spreadValue}>{formatSpread(-spread)}</Text>}
        </View>
        <View style={[styles.teamRow, spreadPick === 'home' && styles.pickedTeamRow]}>
          {homeLogo ? (
            <Image source={{ uri: homeLogo }} style={styles.teamLogo} />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
          <Text
            style={[styles.teamName, spreadPick === 'home' && styles.pickedTeamName]}
            numberOfLines={1}
          >
            {homeTeam}
          </Text>
          {spreadPick === 'home' && <Text style={styles.spreadValue}>{formatSpread(spread)}</Text>}
        </View>
      </View>

      {/* Pick section */}
      <View style={styles.pickSection}>
        {coverMargin > 0 ? (
          <Text style={styles.coverMarginPositive}>
            Projected to cover by {coverMargin.toFixed(1)} pts
          </Text>
        ) : (
          <Text style={styles.coverMarginNegative}>
            Close call ({Math.abs(coverMargin).toFixed(1)} pts margin)
          </Text>
        )}
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
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
  teamsContainer: {
    marginBottom: 16,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickedTeamRow: {
    backgroundColor: '#f0f7ff',
  },
  teamLogo: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  logoPlaceholder: {
    width: 28,
    height: 28,
    marginRight: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 14,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  pickedTeamName: {
    color: '#007AFF',
    fontWeight: '700',
  },
  spreadValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    minWidth: 45,
    textAlign: 'right',
  },
  pickSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  coverMarginPositive: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  coverMarginNegative: {
    fontSize: 14,
    color: '#FF9500',
  },
});
