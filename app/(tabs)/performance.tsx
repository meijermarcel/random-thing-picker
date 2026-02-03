import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';

type Period = 'day' | '7d' | '30d' | 'all';
type PickType = 'ml' | 'spread';
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
  home_team_abbr: string;
  away_team_abbr: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  pick: string;
  pick_abbr: string;
  pick_is_home: boolean;
  is_draw_pick: boolean;
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

function formatPickDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  const day = date.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st'
    : day === 2 || day === 22 ? 'nd'
    : day === 3 || day === 23 ? 'rd'
    : 'th';
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${month} ${day}${suffix}, ${year}`;
}

export default function PerformanceScreen() {
  const [period, setPeriod] = useState<Period>('7d');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [league, setLeague] = useState<League>('all');
  const [pickType, setPickType] = useState<PickType>('ml');
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [fixingScores, setFixingScores] = useState(false);

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
        league === 'all' ? undefined : league,
        pickType
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
  }, [period, selectedDate, league, pickType]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPerformance();
  };

  const onUpdateResults = async () => {
    setUpdating(true);
    try {
      await apiService.triggerUpdateResults();
      Alert.alert('Success', 'Game results updated. Pull to refresh.');
      fetchPerformance();
    } catch (error) {
      Alert.alert('Error', 'Failed to update results. Try again later.');
      console.error('Error updating results:', error);
    } finally {
      setUpdating(false);
    }
  };

  const onFixScores = async () => {
    setFixingScores(true);
    try {
      const refreshResult = await apiService.refreshFinalScores();
      const fixResult = await apiService.fixOrphanedPicks();
      Alert.alert(
        'Success',
        `Updated ${refreshResult.updated_games} game scores, fixed ${fixResult.fixed_picks} picks.`
      );
      fetchPerformance();
    } catch (error) {
      Alert.alert('Error', 'Failed to fix scores. Try again later.');
      console.error('Error fixing scores:', error);
    } finally {
      setFixingScores(false);
    }
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

      {/* Pick Type Toggle */}
      <View style={styles.pickTypeSelector}>
        {(['ml', 'spread'] as PickType[]).map((pt) => (
          <TouchableOpacity
            key={pt}
            style={[styles.pickTypeButton, pickType === pt && styles.pickTypeButtonActive]}
            onPress={() => setPickType(pt)}
          >
            <Text style={[styles.pickTypeText, pickType === pt && styles.pickTypeTextActive]}>
              {pt === 'ml' ? 'Moneyline' : 'Spread'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
        {pickType === 'ml' && (
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: (summary?.units_profit || 0) >= 0 ? '#34C759' : '#FF3B30' }]}>
              {(summary?.units_profit || 0) >= 0 ? '+' : ''}{(summary?.units_profit || 0).toFixed(1)}u
            </Text>
            <Text style={styles.statLabel}>Units</Text>
          </View>
        )}
      </View>

      {/* Admin Buttons */}
      <View style={styles.adminButtonRow}>
        <TouchableOpacity
          style={[styles.adminButton, styles.updateButton]}
          onPress={onUpdateResults}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.adminButtonText}>Update Results</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.adminButton, styles.fixButton]}
          onPress={onFixScores}
          disabled={fixingScores}
        >
          {fixingScores ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="build" size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.adminButtonText}>Fix Scores</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Results List */}
      <Text style={styles.sectionTitle}>
        {period === 'day' ? `Picks for ${formatDisplayDate(selectedDate)}` : 'Recent Picks'}
      </Text>
      {picks.length === 0 ? (
        <Text style={styles.emptyText}>No completed picks in this period</Text>
      ) : (
        (pickType === 'spread'
          ? picks.filter(p => p.spread !== null && p.spread_result !== null)
          : picks
        ).map((pick) => (
          <View key={pick.id} style={styles.pickCard}>
            {/* Header with result badge and metadata */}
            <View style={styles.pickHeader}>
              <View style={[
                styles.resultBadge,
                (pickType === 'ml' ? pick.result : pick.spread_result) === 'win' ? styles.winBadge : styles.lossBadge
              ]}>
                <Text style={styles.resultText}>
                  {(pickType === 'ml' ? pick.result : pick.spread_result) === 'win' ? 'W' : 'L'}
                </Text>
              </View>
              <Text style={styles.pickLeague}>{pick.league}</Text>
              <Text style={styles.pickDate}>{formatPickDate(pick.date)}</Text>
            </View>

            {/* Matchup with logos and scores */}
            <View style={styles.matchupContainer}>
              {/* Away Team */}
              <View style={styles.teamColumn}>
                {pick.away_team_logo ? (
                  <Image source={{ uri: pick.away_team_logo }} style={styles.teamLogo} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Text style={styles.logoPlaceholderText}>{pick.away_team_abbr?.charAt(0)}</Text>
                  </View>
                )}
                <Text style={[styles.teamAbbr, !pick.pick_is_home && !pick.is_draw_pick && styles.pickedTeam]}>
                  {pick.away_team_abbr}
                </Text>
                {pick.away_score !== null && (
                  <Text style={styles.teamScore}>{pick.away_score}</Text>
                )}
                {pick.away_score_predicted !== null && (
                  <Text style={styles.predictedTeamScore}>{pick.away_score_predicted.toFixed(1)}</Text>
                )}
              </View>

              {/* VS / @ */}
              <View style={styles.vsColumn}>
                <Text style={styles.vsText}>@</Text>
                {pick.home_score !== null && <Text style={styles.finalLabel}>Final</Text>}
                {pick.home_score_predicted !== null && <Text style={styles.predLabel}>Pred</Text>}
              </View>

              {/* Home Team */}
              <View style={styles.teamColumn}>
                {pick.home_team_logo ? (
                  <Image source={{ uri: pick.home_team_logo }} style={styles.teamLogo} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Text style={styles.logoPlaceholderText}>{pick.home_team_abbr?.charAt(0)}</Text>
                  </View>
                )}
                <Text style={[styles.teamAbbr, pick.pick_is_home && !pick.is_draw_pick && styles.pickedTeam]}>
                  {pick.home_team_abbr}
                </Text>
                {pick.home_score !== null && (
                  <Text style={styles.teamScore}>{pick.home_score}</Text>
                )}
                {pick.home_score_predicted !== null && (
                  <Text style={styles.predictedTeamScore}>{pick.home_score_predicted.toFixed(1)}</Text>
                )}
              </View>
            </View>

            {/* Pick info */}
            <View style={styles.pickInfoRow}>
              <Text style={styles.pickLabel}>
                Pick: <Text style={pick.is_draw_pick ? styles.pickDrawName : styles.pickTeamName}>{pick.pick_abbr}</Text>
              </Text>
              {pick.odds && !pick.is_draw_pick && (
                <Text style={styles.pickOdds}>
                  {pick.odds > 0 ? '+' : ''}{pick.odds}
                </Text>
              )}
            </View>

            {/* Spread info */}
            {pickType === 'spread' && pick.spread !== null && (
              <View style={styles.spreadInfoRow}>
                <Text style={styles.spreadLabel}>
                  Spread: {pick.spread > 0 ? '+' : ''}{pick.spread}
                </Text>
                <Text style={[
                  styles.spreadResult,
                  pick.spread_result === 'win' ? styles.spreadWin : styles.spreadLoss
                ]}>
                  {pick.spread_result === 'win' ? 'Covered' : 'Missed'}
                </Text>
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
  adminButtonRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  adminButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  fixButton: {
    backgroundColor: '#FF9500',
  },
  adminButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
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
  matchupContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  teamColumn: {
    alignItems: 'center',
    width: 80,
  },
  teamLogo: {
    width: 48,
    height: 48,
    marginBottom: 6,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  logoPlaceholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6B6B6B',
  },
  teamAbbr: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  pickedTeam: {
    color: '#007AFF',
  },
  teamScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  predictedTeamScore: {
    fontSize: 14,
    color: '#6B6B6B',
    marginTop: 2,
  },
  vsColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 8,
  },
  finalLabel: {
    fontSize: 10,
    color: '#6B6B6B',
    marginTop: 24,
  },
  predLabel: {
    fontSize: 10,
    color: '#6B6B6B',
    marginTop: 4,
  },
  pickInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 12,
    marginTop: 4,
  },
  pickLabel: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  pickTeamName: {
    color: '#007AFF',
    fontWeight: '600',
  },
  pickDrawName: {
    color: '#FF9500',
    fontWeight: '600',
  },
  pickOdds: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  pickTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  pickTypeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
  },
  pickTypeButtonActive: {
    backgroundColor: '#34C759',
  },
  pickTypeText: {
    color: '#6B6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  pickTypeTextActive: {
    color: '#FFF',
  },
  spreadInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  spreadLabel: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  spreadResult: {
    fontSize: 14,
    fontWeight: '600',
  },
  spreadWin: {
    color: '#34C759',
  },
  spreadLoss: {
    color: '#FF3B30',
  },
});
