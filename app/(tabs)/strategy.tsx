import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DateSelector } from '../../components/DateSelector';
import { BankrollSelector } from '../../components/BankrollSelector';
import { RiskModeSelector } from '../../components/RiskModeSelector';
import { StraightBetCard, ParlayStrategyCard, UnderdogCard, fmtDollars } from '../../components/StrategyCard';
import { fetchGames as fetchGamesFromAPI, invalidateCache, refreshOdds } from '../../services/api';
import { convertAPIGameWithPickToPick } from '../../services/apiConverters';
import { generateStrategy } from '../../services/strategy';
import { Pick, RiskMode, DailyStrategy } from '../../types/sports';

// leagueAbbr values from API (e.g. "NBA", "NCAAM", "NFL")
// Display order when multiple sports are available
const SPORT_ORDER = ['NFL', 'NBA', 'NCAAM', 'MLB', 'NHL', 'Premier League'];

const STORAGE_KEYS = {
  bankroll: 'strategy_bankroll',
  riskMode: 'strategy_risk_mode',
  sports: 'strategy_sports',
};

const DEFAULT_BANKROLL = 25;
const DEFAULT_RISK_MODE: RiskMode = 'balanced';

export default function Strategy() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bankroll, setBankroll] = useState(DEFAULT_BANKROLL);
  const [riskMode, setRiskMode] = useState<RiskMode>(DEFAULT_RISK_MODE);
  const [strategy, setStrategy] = useState<DailyStrategy | null>(null);
  const [allPicks, setAllPicks] = useState<Pick[]>([]);
  const [selectedSports, setSelectedSports] = useState<Set<string> | null>(null); // null = all
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    (async () => {
      const [savedBankroll, savedRisk, savedSports] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.bankroll),
        AsyncStorage.getItem(STORAGE_KEYS.riskMode),
        AsyncStorage.getItem(STORAGE_KEYS.sports),
      ]);
      if (savedBankroll) setBankroll(parseInt(savedBankroll, 10));
      if (savedRisk) setRiskMode(savedRisk as RiskMode);
      if (savedSports) {
        const parsed = JSON.parse(savedSports) as string[];
        if (parsed.length > 0) setSelectedSports(new Set(parsed));
      }
      setSettingsLoaded(true);
    })();
  }, []);

  // Persist settings when they change
  const handleBankrollChange = (val: number) => {
    setBankroll(val);
    AsyncStorage.setItem(STORAGE_KEYS.bankroll, String(val));
  };

  const handleRiskModeChange = (mode: RiskMode) => {
    setRiskMode(mode);
    AsyncStorage.setItem(STORAGE_KEYS.riskMode, mode);
  };

  // Fetch picks data (always fetch all sports)
  const loadData = useCallback(async () => {
    const gamesData = await fetchGamesFromAPI(selectedDate);

    const convertedPicks = gamesData
      .map(convertAPIGameWithPickToPick)
      .filter((p): p is Pick => p !== null);

    setAllPicks(convertedPicks);
  }, [selectedDate]);

  // Detect which sports have games today (uses leagueAbbr e.g. "NBA", "NCAAM")
  const availableSports = useMemo(() => {
    const sports = new Set(allPicks.map(p => p.game.leagueAbbr));
    return SPORT_ORDER.filter(s => sports.has(s));
  }, [allPicks]);

  // Filter picks by selected sports
  const picks = useMemo(() => {
    if (!selectedSports) return allPicks; // null = all sports
    return allPicks.filter(p => selectedSports.has(p.game.leagueAbbr));
  }, [allPicks, selectedSports]);

  const handleSportToggle = (sport: string) => {
    setSelectedSports(prev => {
      let next: Set<string> | null;
      if (!prev) {
        // Currently "all" — tapping a sport means "only this sport"
        next = new Set([sport]);
      } else if (prev.has(sport)) {
        const copy = new Set(prev);
        copy.delete(sport);
        next = copy.size === 0 ? null : copy; // empty = back to all
      } else {
        next = new Set(prev).add(sport);
      }
      // Check if all available sports are selected — treat as "all"
      if (next && availableSports.every(s => next!.has(s))) {
        next = null;
      }
      AsyncStorage.setItem(
        STORAGE_KEYS.sports,
        JSON.stringify(next ? [...next] : []),
      );
      return next;
    });
  };

  const handleAllSportsPress = () => {
    setSelectedSports(null);
    AsyncStorage.setItem(STORAGE_KEYS.sports, JSON.stringify([]));
  };

  // Generate strategy whenever inputs change
  useEffect(() => {
    if (!settingsLoaded) return;
    if (picks.length === 0 && !loading) {
      setStrategy(null);
      return;
    }
    if (picks.length > 0) {
      const result = generateStrategy(picks, [], bankroll, riskMode);
      setStrategy(result);
    }
  }, [picks, bankroll, riskMode, settingsLoaded, loading]);

  // Load data on date change
  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshOdds(selectedDate);
      invalidateCache();
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const hasBets = strategy && (
    strategy.straightBets.length > 0 ||
    strategy.parlays.length > 0 ||
    strategy.underdogFlyers.length > 0
  );

  const allLowConfidence = strategy && picks.length > 0 &&
    picks.every(p => p.analysis?.confidence === 'low');

  return (
    <SafeAreaView style={styles.container}>
      <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
      <BankrollSelector value={bankroll} onChange={handleBankrollChange} />
      <RiskModeSelector value={riskMode} onChange={handleRiskModeChange} />

      {availableSports.length > 1 && (
        <View style={styles.sportsRow}>
          <Text style={styles.sportsLabel}>Sports</Text>
          <View style={styles.sportsChips}>
            <TouchableOpacity
              style={[styles.sportChip, !selectedSports && styles.sportChipSelected]}
              onPress={handleAllSportsPress}
            >
              <Text style={[styles.sportChipText, !selectedSports && styles.sportChipTextSelected]}>
                All
              </Text>
            </TouchableOpacity>
            {availableSports.map(sport => {
              const isSelected = !selectedSports || selectedSports.has(sport);
              return (
                <TouchableOpacity
                  key={sport}
                  style={[styles.sportChip, selectedSports && isSelected && styles.sportChipSelected]}
                  onPress={() => handleSportToggle(sport)}
                >
                  <Text style={[styles.sportChipText, selectedSports && isSelected && styles.sportChipTextSelected]}>
                    {sport}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Building strategy...</Text>
        </View>
      ) : allLowConfidence && riskMode === 'conservative' ? (
        <View style={styles.center}>
          <Text style={styles.warningText}>No strong picks today</Text>
          <Text style={styles.warningSubtext}>
            All picks are low confidence. Consider sitting this one out or switching to Balanced mode.
          </Text>
        </View>
      ) : !hasBets ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No picks available for this date</Text>
        </View>
      ) : (
        <View style={styles.contentWrapper}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            {/* Straight Bets */}
            {strategy!.straightBets.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>
                  Straight Bets — ${strategy!.straightBets.reduce((s, b) => s + b.wager, 0)} across {strategy!.straightBets.length} bet{strategy!.straightBets.length !== 1 ? 's' : ''}
                </Text>
                {strategy!.straightBets.map((bet, i) => (
                  <StraightBetCard key={`straight-${i}`} bet={bet} />
                ))}
              </>
            )}

            {/* Parlays */}
            {strategy!.parlays.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>
                  Parlays — ${strategy!.parlays.reduce((s, p) => s + p.wager, 0)} across {strategy!.parlays.length} parlay{strategy!.parlays.length !== 1 ? 's' : ''}
                </Text>
                {strategy!.parlays.map((entry, i) => (
                  <ParlayStrategyCard key={`parlay-${i}`} entry={entry} />
                ))}
              </>
            )}

            {/* Underdog Flyers */}
            {strategy!.underdogFlyers.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>
                  Underdog Flyers — ${strategy!.underdogFlyers.reduce((s, b) => s + b.wager, 0)} across {strategy!.underdogFlyers.length} bet{strategy!.underdogFlyers.length !== 1 ? 's' : ''}
                </Text>
                {strategy!.underdogFlyers.map((bet, i) => (
                  <UnderdogCard key={`underdog-${i}`} bet={bet} />
                ))}
              </>
            )}
          </ScrollView>

          {/* Sticky Footer */}
          <View style={styles.footer}>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Today's Budget</Text>
              <Text style={styles.footerValue}>
                {fmtDollars(strategy!.dailyBudget)} of {fmtDollars(strategy!.bankroll)}
              </Text>
            </View>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Profit if all hit</Text>
              <Text style={styles.footerValue}>
                {fmtDollars(strategy!.potentialReturnRange.high)}
              </Text>
            </View>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Expected Profit</Text>
              <Text style={[styles.footerValue, { color: strategy!.potentialReturnRange.expected >= 0 ? '#007AFF' : '#FF3B30' }]}>
                ~{fmtDollars(strategy!.potentialReturnRange.expected)}
              </Text>
            </View>
          </View>
        </View>
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
  warningText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF9500',
    marginBottom: 8,
  },
  warningSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  sportsRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sportsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  sportsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e8e8e8',
  },
  sportChipSelected: {
    backgroundColor: '#007AFF',
  },
  sportChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  sportChipTextSelected: {
    color: '#fff',
  },
  contentWrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  footerLabel: {
    fontSize: 14,
    color: '#666',
  },
  footerValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
});
