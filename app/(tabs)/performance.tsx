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
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';

type Period = 'day' | '7d' | '30d' | 'all';
type League = 'all' | 'basketball' | 'football' | 'hockey' | 'baseball' | 'soccer';

const LEAGUES: { key: League; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'basketball', label: 'NBA' },
  { key: 'football', label: 'NFL' },
  { key: 'hockey', label: 'NHL' },
  { key: 'baseball', label: 'MLB' },
  { key: 'soccer', label: 'Soccer' },
];

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
  home_score_predicted: number | null;
  away_score_predicted: number | null;
}

interface PerformanceData {
  summary: PerformanceSummary;
  daily_breakdown: DailyBreakdown[];
  picks: PickDetail[];
}

function formatDisplayDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function formatApiDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function PerformanceScreen() {
  const [period, setPeriod] = useState<Period>('7d');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [league, setLeague] = useState<League>('all');
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPerformance = async () => {
    try {
      let startDate: Date;
      let endDate: Date;

      if (period === 'day') {
        startDate = selectedDate;
        endDate = selectedDate;
      } else {
        endDate = new Date();
        switch (period) {
          case '7d':
            startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'all':
            startDate = new Date('2020-01-01');
            break;
          default:
            startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
      }

      const response = await apiService.getPerformance(
        formatApiDate(startDate),
        formatApiDate(endDate),
        league === 'all' ? undefined : league
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
  }, [period, selectedDate, league]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPerformance();
  };

  const navigateDay = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    // Don't allow future dates
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
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
        {(['day', '7d', '30d', 'all'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodButton, period === p && styles.periodButtonActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p === 'day' ? 'Day' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'All Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Day Picker - only show when period is 'day' */}
      {period === 'day' && (
        <View style={styles.dayPicker}>
          <TouchableOpacity onPress={() => navigateDay(-1)} style={styles.dayArrow}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.dayText}>{formatDisplayDate(selectedDate)}</Text>
          <TouchableOpacity
            onPress={() => navigateDay(1)}
            style={styles.dayArrow}
            disabled={selectedDate.toDateString() === new Date().toDateString()}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={selectedDate.toDateString() === new Date().toDateString() ? '#CCC' : '#007AFF'}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* League Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.leagueScroll}
        contentContainerStyle={styles.leagueContainer}
      >
        {LEAGUES.map((l) => (
          <TouchableOpacity
            key={l.key}
            style={[styles.leagueButton, league === l.key && styles.leagueButtonActive]}
            onPress={() => setLeague(l.key)}
          >
            <Text style={[styles.leagueText, league === l.key && styles.leagueTextActive]}>
              {l.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
      <Text style={styles.sectionTitle}>
        {period === 'day' ? `Picks for ${formatDisplayDate(selectedDate)}` : 'Recent Picks'}
      </Text>
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
              <View style={styles.scoresContainer}>
                <Text style={styles.pickScore}>
                  Final: {pick.away_score} - {pick.home_score}
                </Text>
                {pick.home_score_predicted !== null && pick.away_score_predicted !== null && (
                  <Text style={styles.predictedScore}>
                    Predicted: {pick.away_score_predicted.toFixed(1)} - {pick.home_score_predicted.toFixed(1)}
                  </Text>
                )}
              </View>
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
    backgroundColor: '#F2F2F7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
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
    backgroundColor: '#E5E5EA',
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodText: {
    color: '#6B6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  periodTextActive: {
    color: '#FFF',
  },
  dayPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 16,
  },
  dayArrow: {
    padding: 8,
  },
  dayText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    minWidth: 100,
    textAlign: 'center',
  },
  leagueScroll: {
    maxHeight: 50,
  },
  leagueContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  leagueButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    marginRight: 8,
  },
  leagueButtonActive: {
    backgroundColor: '#34C759',
  },
  leagueText: {
    color: '#6B6B6B',
    fontSize: 13,
    fontWeight: '600',
  },
  leagueTextActive: {
    color: '#FFF',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 24,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  emptyText: {
    color: '#6B6B6B',
    textAlign: 'center',
    marginTop: 20,
  },
  pickCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    color: '#6B6B6B',
    fontSize: 12,
    marginRight: 8,
  },
  pickDate: {
    color: '#6B6B6B',
    fontSize: 12,
  },
  pickTeams: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  pickSelection: {
    color: '#6B6B6B',
    fontSize: 14,
  },
  pickTeamName: {
    color: '#007AFF',
    fontWeight: '600',
  },
  pickOdds: {
    color: '#6B6B6B',
  },
  scoresContainer: {
    marginTop: 8,
  },
  pickScore: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  predictedScore: {
    color: '#6B6B6B',
    fontSize: 13,
    marginTop: 2,
  },
});
