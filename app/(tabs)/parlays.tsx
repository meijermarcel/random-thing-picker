import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Game, ParlayRecommendation, PickAnalysis } from '../../types/sports';
import { fetchGames } from '../../services/espn';
import { analyzeGames } from '../../services/analysis';
import { generateParlays, buildCustomParlay } from '../../services/parlayBuilder';
import { DateSelector } from '../../components/DateSelector';
import { ParlayCard } from '../../components/ParlayCard';

// Helper to get date string for comparison
const getDateKey = (date: Date) => date.toISOString().split('T')[0];

// Module-level cache that persists across component remounts
interface ParlayCache {
  dateKey: string;
  parlays: ParlayRecommendation[];
  gameCount: number;
  games: Game[];
  analyses: Map<string, PickAnalysis>;
}
let parlayCache: ParlayCache | null = null;

export default function Parlays() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [parlays, setParlays] = useState<ParlayRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gameCount, setGameCount] = useState(0);
  const [analyzingCount, setAnalyzingCount] = useState(0);
  const [customLegs, setCustomLegs] = useState('8');

  const loadParlays = useCallback(async (forceRefresh = false) => {
    const dateKey = getDateKey(selectedDate);

    // Check module-level cache first (unless force refresh)
    if (!forceRefresh && parlayCache && parlayCache.dateKey === dateKey) {
      setParlays(parlayCache.parlays);
      setGameCount(parlayCache.gameCount);
      return;
    }

    // Fetch all games
    const games = await fetchGames('all', selectedDate);
    setGameCount(games.length);

    if (games.length === 0) {
      setParlays([]);
      parlayCache = { dateKey, parlays: [], gameCount: 0, games: [], analyses: new Map() };
      return;
    }

    setAnalyzingCount(games.length);

    // Analyze all games
    const analyses = await analyzeGames(games);

    // Generate parlays
    const recommendations = generateParlays(games, analyses);
    setParlays(recommendations);

    // Update module-level cache
    parlayCache = { dateKey, parlays: recommendations, gameCount: games.length, games, analyses };
  }, [selectedDate]);

  const handleGenerateCustom = () => {
    const numLegs = parseInt(customLegs, 10);
    if (isNaN(numLegs) || numLegs < 2 || !parlayCache) return;

    const customParlay = buildCustomParlay(parlayCache.games, parlayCache.analyses, numLegs);
    if (customParlay) {
      handleViewParlay(customParlay);
    }
  };

  useEffect(() => {
    const dateKey = getDateKey(selectedDate);
    // Only show loading if we don't have cached data for this date
    if (!parlayCache || parlayCache.dateKey !== dateKey) {
      setLoading(true);
      setAnalyzingCount(0);
    }
    loadParlays().finally(() => setLoading(false));
  }, [loadParlays]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadParlays(true);
    setRefreshing(false);
  };

  const handleViewParlay = (parlay: ParlayRecommendation) => {
    router.push({
      pathname: '/betslip',
      params: { picks: JSON.stringify(parlay.picks), returnTo: 'parlays' },
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

          {/* Custom Parlay Generator */}
          <View style={styles.customSection}>
            <Text style={styles.customTitle}>Custom Parlay</Text>
            <Text style={styles.customSubtitle}>Generate a parlay with your desired number of legs</Text>
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={customLegs}
                onChangeText={setCustomLegs}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="8"
              />
              <Text style={styles.customLabel}>legs</Text>
              <TouchableOpacity
                style={[
                  styles.customButton,
                  parseInt(customLegs, 10) > gameCount && styles.customButtonDisabled
                ]}
                onPress={handleGenerateCustom}
                disabled={parseInt(customLegs, 10) > gameCount}
              >
                <Text style={styles.customButtonText}>Generate</Text>
              </TouchableOpacity>
            </View>
            {parseInt(customLegs, 10) > gameCount && (
              <Text style={styles.customError}>Only {gameCount} games available</Text>
            )}
          </View>
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
  customSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
  },
  customTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  customSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customInput: {
    width: 50,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: '#f8f8f8',
  },
  customLabel: {
    fontSize: 15,
    color: '#666',
    flex: 1,
  },
  customButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  customButtonDisabled: {
    backgroundColor: '#ccc',
  },
  customButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  customError: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 8,
  },
});
