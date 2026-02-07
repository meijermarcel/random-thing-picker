import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { ParlayRecommendation } from '../../types/sports';
import { fetchParlays as fetchParlaysFromAPI, createCustomParlay as createCustomParlayFromAPI, APIParlay, invalidateCache } from '../../services/api';
import { convertAPIParlayToRecommendation } from '../../services/apiConverters';
import { DateSelector } from '../../components/DateSelector';
import { ParlayCard } from '../../components/ParlayCard';

export default function Parlays() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [parlays, setParlays] = useState<ParlayRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gameCount, setGameCount] = useState(0);
  const [customLegs, setCustomLegs] = useState('8');
  const [selectedLeagues, setSelectedLeagues] = useState<Set<string>>(new Set());
  const [generatingCustom, setGeneratingCustom] = useState(false);

  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);

  // Get game count for selected leagues (approximation based on total)
  const filteredGameCount = selectedLeagues.size === 0
    ? gameCount
    : Math.floor(gameCount * selectedLeagues.size / Math.max(availableLeagues.length, 1));

  const toggleLeague = (league: string) => {
    setSelectedLeagues(prev => {
      const next = new Set(prev);
      if (next.has(league)) {
        next.delete(league);
      } else {
        next.add(league);
      }
      return next;
    });
  };

  const selectAllLeagues = () => {
    setSelectedLeagues(new Set());
  };

  const loadParlays = useCallback(async (forceRefresh = false) => {
    // Fetch parlays from API (caching handled by api.ts)
    const apiParlays = await fetchParlaysFromAPI(selectedDate, undefined, forceRefresh);

    // Convert API parlays to frontend format
    const recommendations = apiParlays.map(convertAPIParlayToRecommendation);
    setParlays(recommendations);

    // Calculate game count and available leagues from parlay picks
    const allPicks = recommendations.flatMap(p => p.picks);
    const uniqueGames = new Map(allPicks.map(p => [p.game.id, p.game]));
    setGameCount(uniqueGames.size);
    setAvailableLeagues(Array.from(new Set(allPicks.map(p => p.game.leagueAbbr))));
  }, [selectedDate]);

  const handleGenerateCustom = async () => {
    const numLegs = parseInt(customLegs, 10);
    if (isNaN(numLegs) || numLegs < 2) return;

    setGeneratingCustom(true);
    try {
      const sports = selectedLeagues.size > 0 ? Array.from(selectedLeagues) : undefined;
      const result = await createCustomParlayFromAPI(selectedDate, numLegs, sports);

      if ('error' in result) {
        console.error('Custom parlay error:', result.error);
        return;
      }

      const customParlay = convertAPIParlayToRecommendation(result);
      handleViewParlay(customParlay);
    } catch (error) {
      console.error('Failed to generate custom parlay:', error);
    } finally {
      setGeneratingCustom(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadParlays().finally(() => setLoading(false));
  }, [loadParlays]);

  const handleRefresh = async () => {
    setRefreshing(true);
    invalidateCache('parlays');
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
          <Text style={styles.loadingText}>Loading parlays...</Text>
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

            {/* League Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.sportScroll}
              contentContainerStyle={styles.sportScrollContent}
            >
              <TouchableOpacity
                style={[styles.sportChip, selectedLeagues.size === 0 && styles.sportChipActive]}
                onPress={selectAllLeagues}
              >
                <Text style={[styles.sportChipText, selectedLeagues.size === 0 && styles.sportChipTextActive]}>
                  All ({gameCount})
                </Text>
              </TouchableOpacity>
              {availableLeagues.map(league => {
                // Estimate count per league based on parlay picks
                const pickCount = parlays
                  .flatMap(p => p.picks)
                  .filter(p => p.game.leagueAbbr === league).length;
                const isSelected = selectedLeagues.has(league);
                return (
                  <TouchableOpacity
                    key={league}
                    style={[styles.sportChip, isSelected && styles.sportChipActive]}
                    onPress={() => toggleLeague(league)}
                  >
                    <Text style={[styles.sportChipText, isSelected && styles.sportChipTextActive]}>
                      {league} ({pickCount})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

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
                  (parseInt(customLegs, 10) > filteredGameCount || generatingCustom) && styles.customButtonDisabled
                ]}
                onPress={handleGenerateCustom}
                disabled={parseInt(customLegs, 10) > filteredGameCount || generatingCustom}
              >
                <Text style={styles.customButtonText}>{generatingCustom ? 'Generating...' : 'Generate'}</Text>
              </TouchableOpacity>
            </View>
            {parseInt(customLegs, 10) > filteredGameCount && (
              <Text style={styles.customError}>Only {filteredGameCount} games available{selectedLeagues.size > 0 ? ` for selected leagues` : ''}</Text>
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
  sportScroll: {
    marginBottom: 12,
    marginHorizontal: -16,
  },
  sportScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  sportChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  sportChipActive: {
    backgroundColor: '#007AFF',
  },
  sportChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  sportChipTextActive: {
    color: '#fff',
  },
});
