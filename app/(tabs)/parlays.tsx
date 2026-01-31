import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Game, ParlayRecommendation } from '../../types/sports';
import { fetchGames } from '../../services/espn';
import { analyzeGames } from '../../services/analysis';
import { generateParlays } from '../../services/parlayBuilder';
import { DateSelector } from '../../components/DateSelector';
import { ParlayCard } from '../../components/ParlayCard';

export default function Parlays() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [parlays, setParlays] = useState<ParlayRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gameCount, setGameCount] = useState(0);
  const [analyzingCount, setAnalyzingCount] = useState(0);

  const loadParlays = useCallback(async () => {
    // Fetch all games
    const games = await fetchGames('all', selectedDate);
    setGameCount(games.length);

    if (games.length === 0) {
      setParlays([]);
      return;
    }

    setAnalyzingCount(games.length);

    // Analyze all games
    const analyses = await analyzeGames(games);

    // Generate parlays
    const recommendations = generateParlays(games, analyses);
    setParlays(recommendations);
  }, [selectedDate]);

  useEffect(() => {
    setLoading(true);
    setAnalyzingCount(0);
    loadParlays().finally(() => setLoading(false));
  }, [loadParlays]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadParlays();
    setRefreshing(false);
  };

  const handleViewParlay = (parlay: ParlayRecommendation) => {
    router.push({
      pathname: '/betslip',
      params: { picks: JSON.stringify(parlay.picks) },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          {analyzingCount > 0 && (
            <Text style={styles.loadingText}>Analyzing {analyzingCount} games...</Text>
          )}
        </View>
      ) : gameCount === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No games on this date</Text>
        </View>
      ) : parlays.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Not enough data to build parlays</Text>
          <Text style={styles.emptySubtext}>{gameCount} games found, but need more high-confidence picks</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <Text style={styles.headerText}>
            {parlays.length} parlay{parlays.length !== 1 ? 's' : ''} from {gameCount} games
          </Text>
          {parlays.map((parlay) => (
            <ParlayCard
              key={parlay.id}
              parlay={parlay}
              onView={() => handleViewParlay(parlay)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  headerText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
  },
});
