import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DateSelector } from '../../components/DateSelector';
import { BankrollSelector } from '../../components/BankrollSelector';
import { RiskModeSelector } from '../../components/RiskModeSelector';
import { StraightBetCard, ParlayStrategyCard, UnderdogCard } from '../../components/StrategyCard';
import { fetchGames as fetchGamesFromAPI, fetchParlays as fetchParlaysFromAPI, invalidateCache } from '../../services/api';
import { convertAPIGameWithPickToPick, convertAPIParlayToRecommendation } from '../../services/apiConverters';
import { generateStrategy } from '../../services/strategy';
import { Pick, ParlayRecommendation, RiskMode, DailyStrategy } from '../../types/sports';

const STORAGE_KEYS = {
  bankroll: 'strategy_bankroll',
  riskMode: 'strategy_risk_mode',
};

const DEFAULT_BANKROLL = 50;
const DEFAULT_RISK_MODE: RiskMode = 'balanced';

export default function Strategy() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bankroll, setBankroll] = useState(DEFAULT_BANKROLL);
  const [riskMode, setRiskMode] = useState<RiskMode>(DEFAULT_RISK_MODE);
  const [strategy, setStrategy] = useState<DailyStrategy | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [parlays, setParlays] = useState<ParlayRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    (async () => {
      const [savedBankroll, savedRisk] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.bankroll),
        AsyncStorage.getItem(STORAGE_KEYS.riskMode),
      ]);
      if (savedBankroll) setBankroll(parseInt(savedBankroll, 10));
      if (savedRisk) setRiskMode(savedRisk as RiskMode);
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

  // Fetch picks and parlays data
  const loadData = useCallback(async () => {
    const [gamesData, parlaysData] = await Promise.all([
      fetchGamesFromAPI(selectedDate),
      fetchParlaysFromAPI(selectedDate),
    ]);

    const convertedPicks = gamesData
      .map(convertAPIGameWithPickToPick)
      .filter((p): p is Pick => p !== null);

    const convertedParlays = parlaysData.map(convertAPIParlayToRecommendation);

    setPicks(convertedPicks);
    setParlays(convertedParlays);
  }, [selectedDate]);

  // Generate strategy whenever inputs change
  useEffect(() => {
    if (!settingsLoaded) return;
    if (picks.length === 0 && !loading) {
      setStrategy(null);
      return;
    }
    if (picks.length > 0) {
      const result = generateStrategy(picks, parlays, bankroll, riskMode);
      setStrategy(result);
    }
  }, [picks, parlays, bankroll, riskMode, settingsLoaded, loading]);

  // Load data on date change
  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    invalidateCache();
    await loadData();
    setRefreshing(false);
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Summary Banner */}
          <View style={styles.summaryBanner}>
            {strategy!.straightBets.length > 0 && (
              <Text style={styles.summaryText}>
                Straight: ${strategy!.straightBets.reduce((s, b) => s + b.wager, 0)}
              </Text>
            )}
            {strategy!.parlays.length > 0 && (
              <Text style={styles.summaryText}>
                Parlays: ${strategy!.parlays.reduce((s, p) => s + p.wager, 0)}
              </Text>
            )}
            {strategy!.underdogFlyers.length > 0 && (
              <Text style={styles.summaryText}>
                Underdogs: ${strategy!.underdogFlyers.reduce((s, b) => s + b.wager, 0)}
              </Text>
            )}
          </View>

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

          {/* Totals Footer */}
          <View style={styles.footer}>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Total Wagered</Text>
              <Text style={styles.footerValue}>${strategy!.totalWagered}</Text>
            </View>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Potential Return</Text>
              <Text style={styles.footerValue}>
                ${strategy!.potentialReturnRange.low} – ${strategy!.potentialReturnRange.high}
              </Text>
            </View>
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>Expected Return</Text>
              <Text style={[styles.footerValue, { color: '#007AFF' }]}>
                ~${strategy!.potentialReturnRange.expected}
              </Text>
            </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  summaryBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
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
