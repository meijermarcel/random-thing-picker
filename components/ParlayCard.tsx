import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ParlayRecommendation } from '../types/sports';

interface ParlayCardProps {
  parlay: ParlayRecommendation;
  onView: () => void;
}

export function ParlayCard({ parlay, onView }: ParlayCardProps) {
  // Build summary of picks (first 3 teams)
  const pickSummary = parlay.picks
    .slice(0, 3)
    .map(p => {
      if (p.pickType === 'draw') return 'Draw';
      if (p.pickType === 'over') return 'Over';
      if (p.pickType === 'under') return 'Under';
      return p.pickType === 'home' ? p.game.homeTeam : p.game.awayTeam;
    })
    .join(', ');

  const moreCount = parlay.picks.length - 3;
  const displaySummary = moreCount > 0
    ? `${pickSummary}, +${moreCount} more`
    : pickSummary;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>{parlay.icon}</Text>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{parlay.title}</Text>
          <Text style={styles.subtitle}>{parlay.subtitle}</Text>
        </View>
      </View>
      <Text style={styles.summary} numberOfLines={1}>{displaySummary}</Text>
      <TouchableOpacity style={styles.viewButton} onPress={onView}>
        <Text style={styles.viewButtonText}>View</Text>
      </TouchableOpacity>
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
    marginBottom: 10,
  },
  icon: {
    fontSize: 28,
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  summary: {
    fontSize: 14,
    color: '#444',
    marginBottom: 12,
  },
  viewButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
