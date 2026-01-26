import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Image } from 'react-native';
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
            <View style={styles.cardHeader}>
              <Text style={styles.league}>{item.game.leagueAbbr}</Text>
              <View style={styles.pickBadge}>
                <Text style={styles.pickLabel}>{item.label}</Text>
              </View>
            </View>
            <View style={styles.teamRow}>
              {item.game.awayLogo && (
                <Image source={{ uri: item.game.awayLogo }} style={styles.logo} />
              )}
              <Text style={styles.teamName}>{item.game.awayTeam}</Text>
            </View>
            <View style={styles.teamRow}>
              {item.game.homeLogo && (
                <Image source={{ uri: item.game.homeLogo }} style={styles.logo} />
              )}
              <Text style={styles.teamName}>{item.game.homeTeam}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={() => (
          <View style={styles.footer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryValue}>{picks.length}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.parlayNote}>
              {picks.length > 1 ? `${picks.length}-leg parlay` : 'Straight'}
            </Text>
          </View>
        )}
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/sports')}>
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  listContent: {
    padding: 12,
  },
  pickCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  league: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  logo: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  teamName: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  pickBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
  },
  pickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#888',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: '#eee',
  },
  parlayNote: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  buttonContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
