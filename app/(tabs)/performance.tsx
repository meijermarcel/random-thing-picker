import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { apiService } from '../../services/api';

type Period = 'today' | '7d' | '30d' | 'all';

interface PerformanceSummary {
  total_picks: number;
  wins: number;
  losses: number;
  win_rate: number;
  roi: number;
  units_profit: number;
  spread_record: string | null;
}

interface DailyBreakdown {
  date: string;
  wins: number;
  losses: number;
  win_rate: number;
}

interface PickDetail {
  id: string;
  date: string;
  league: string;
  home_team: string;
  away_team: string;
  pick: string;
  confidence: string;
  odds: number | null;
  spread: number | null;
  result: 'win' | 'loss';
  spread_result: 'win' | 'loss' | null;
  home_score: number | null;
  away_score: number | null;
}

interface PerformanceData {
  summary: PerformanceSummary;
  daily_breakdown: DailyBreakdown[];
  picks: PickDetail[];
}

export default function PerformanceScreen() {
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPerformance = async () => {
    try {
      const today = new Date();
      let startDate: Date;

      switch (period) {
        case 'today':
          startDate = today;
          break;
        case '7d':
          startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          startDate = new Date('2020-01-01');
          break;
      }

      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      const response = await apiService.getPerformance(
        formatDate(startDate),
        formatDate(today)
      );
      setData(response);
    } catch (error) {
      console.error('Error fetching performance:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchPerformance();
  }, [period]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPerformance();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const summary = data?.summary;
  const picks = data?.picks || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['today', '7d', '30d', 'all'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodButton, period === p && styles.periodButtonActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'All Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats Header */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {summary?.wins || 0}-{summary?.losses || 0}
          </Text>
          <Text style={styles.statLabel}>Record</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: (summary?.win_rate || 0) >= 0.5 ? '#34C759' : '#FF3B30' }]}>
            {((summary?.win_rate || 0) * 100).toFixed(1)}%
          </Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: (summary?.units_profit || 0) >= 0 ? '#34C759' : '#FF3B30' }]}>
            {(summary?.units_profit || 0) >= 0 ? '+' : ''}{(summary?.units_profit || 0).toFixed(1)}u
          </Text>
          <Text style={styles.statLabel}>Units</Text>
        </View>
      </View>

      {/* Results List */}
      <Text style={styles.sectionTitle}>Recent Picks</Text>
      {picks.length === 0 ? (
        <Text style={styles.emptyText}>No completed picks in this period</Text>
      ) : (
        picks.map((pick) => (
          <View key={pick.id} style={styles.pickCard}>
            <View style={styles.pickHeader}>
              <View style={[styles.resultBadge, pick.result === 'win' ? styles.winBadge : styles.lossBadge]}>
                <Text style={styles.resultText}>{pick.result === 'win' ? 'W' : 'L'}</Text>
              </View>
              <Text style={styles.pickLeague}>{pick.league}</Text>
              <Text style={styles.pickDate}>{pick.date}</Text>
            </View>
            <Text style={styles.pickTeams}>
              {pick.away_team} @ {pick.home_team}
            </Text>
            <Text style={styles.pickSelection}>
              Pick: <Text style={styles.pickTeamName}>{pick.pick}</Text>
              {pick.odds && <Text style={styles.pickOdds}> ({pick.odds > 0 ? '+' : ''}{pick.odds})</Text>}
            </Text>
            {pick.home_score !== null && pick.away_score !== null && (
              <Text style={styles.pickScore}>
                Final: {pick.away_score} - {pick.home_score}
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  periodTextActive: {
    color: '#FFF',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#1C1C1E',
    marginHorizontal: 16,
    borderRadius: 12,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 24,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  emptyText: {
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 20,
  },
  pickCard: {
    backgroundColor: '#1C1C1E',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  pickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  winBadge: {
    backgroundColor: '#34C759',
  },
  lossBadge: {
    backgroundColor: '#FF3B30',
  },
  resultText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  pickLeague: {
    color: '#8E8E93',
    fontSize: 12,
    marginRight: 8,
  },
  pickDate: {
    color: '#8E8E93',
    fontSize: 12,
  },
  pickTeams: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  pickSelection: {
    color: '#8E8E93',
    fontSize: 14,
  },
  pickTeamName: {
    color: '#007AFF',
    fontWeight: '600',
  },
  pickOdds: {
    color: '#8E8E93',
  },
  pickScore: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 4,
  },
});
