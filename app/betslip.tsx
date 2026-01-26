import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Pick } from '../types/sports';

export default function BetSlip() {
  const { picks: picksParam } = useLocalSearchParams<{ picks: string }>();
  const picks: Pick[] = picksParam ? JSON.parse(picksParam) : [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bet Slip</Text>
        <Text style={styles.headerSubtitle}>{picks.length} {picks.length === 1 ? 'pick' : 'picks'}</Text>
      </View>

      <FlatList
        data={picks}
        keyExtractor={(item) => item.game.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.pickCard}>
            <View style={styles.pickHeader}>
              <Text style={styles.league}>{item.game.leagueAbbr}</Text>
            </View>
            <Text style={styles.matchup}>
              {item.game.awayTeam} @ {item.game.homeTeam}
            </Text>
            <View style={styles.pickBadge}>
              <Text style={styles.pickLabel}>{item.label}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={() => (
          <View style={styles.footer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Picks</Text>
              <Text style={styles.summaryValue}>{picks.length}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.parlayNote}>
              {picks.length > 1 ? `${picks.length}-leg parlay` : 'Straight bet'}
            </Text>
          </View>
        )}
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  pickCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  league: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
  },
  matchup: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  pickBadge: {
    backgroundColor: '#4ade80',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pickLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  footer: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#888',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#3d3d54',
    marginVertical: 12,
  },
  parlayNote: {
    fontSize: 14,
    color: '#4ade80',
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  button: {
    backgroundColor: '#4ade80',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: '700',
  },
});
