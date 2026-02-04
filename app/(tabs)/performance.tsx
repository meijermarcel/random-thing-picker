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
type League = 'all' | 'nba' | 'ncaam' | 'football' | 'hockey' | 'baseball' | 'soccer';

const LEAGUES: { key: League; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'nba', label: 'NBA' },
  { key: 'ncaam', label: 'NCAAM' },
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
  scheduled_at: string | null;
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
  // Use local date components, not UTC (toISOString converts to UTC)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatPickDate(scheduledAt: string | null, fallbackDate: string): string {
  // Use scheduled_at (ISO timestamp) if available, converting to local timezone
  // Otherwise fall back to the date string
  let date: Date;
  if (scheduledAt) {
    date = new Date(scheduledAt);
  } else {
    date = new Date(fallbackDate + 'T12:00:00'); // Use noon to avoid timezone edge cases
  }

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
  const [period, setPeriod] = useState<Period>('day');
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

      {/* Confidence Breakdown */}
      {(() => {
        const confidenceStats = picks.reduce(
          (acc, pick) => {
            const conf = (pick.confidence || 'medium').toLowerCase();
            const isWin = (pickType === 'ml' ? pick.result : pick.spread_result) === 'win';
            if (pickType === 'spread' && pick.spread_result === null) return acc;
            if (conf === 'high') {
              acc.high.total++;
              if (isWin) acc.high.wins++;
            } else if (conf === 'low') {
              acc.low.total++;
              if (isWin) acc.low.wins++;
            } else {
              acc.medium.total++;
              if (isWin) acc.medium.wins++;
            }
            return acc;
          },
          { high: { wins: 0, total: 0 }, medium: { wins: 0, total: 0 }, low: { wins: 0, total: 0 } }
        );

        const formatRecord = (stats: { wins: number; total: number }) => {
          const losses = stats.total - stats.wins;
          const pct = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(0) : '0';
          return { record: `${stats.wins}-${losses}`, pct: `${pct}%` };
        };

        const high = formatRecord(confidenceStats.high);
        const medium = formatRecord(confidenceStats.medium);
        const low = formatRecord(confidenceStats.low);

        return (
          <View style={styles.confidenceContainer}>
            <View style={styles.confidenceCard}>
              <Text style={styles.confidenceLabel}>HIGH</Text>
              <Text style={styles.confidenceRecord}>{high.record}</Text>
              <Text style={styles.confidencePct}>({high.pct})</Text>
            </View>
            <View style={styles.confidenceCard}>
              <Text style={styles.confidenceLabel}>MEDIUM</Text>
              <Text style={styles.confidenceRecord}>{medium.record}</Text>
              <Text style={styles.confidencePct}>({medium.pct})</Text>
            </View>
            <View style={styles.confidenceCard}>
              <Text style={styles.confidenceLabel}>LOW</Text>
              <Text style={styles.confidenceRecord}>{low.record}</Text>
              <Text style={styles.confidencePct}>({low.pct})</Text>
            </View>
          </View>
        );
      })()}

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
        ).map((pick) => {
          const isWin = (pickType === 'ml' ? pick.result : pick.spread_result) === 'win';
          const margin = pick.home_score !== null && pick.away_score !== null
            ? Math.abs(pick.home_score - pick.away_score)
            : null;
          const homeWon = pick.home_score !== null && pick.away_score !== null && pick.home_score > pick.away_score;

          return (
            <View key={pick.id} style={styles.pickCard}>
              {/* Header: League and Date */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardLeague}>{pick.league}</Text>
                <Text style={styles.cardDate}>{formatPickDate(pick.scheduled_at, pick.date)}</Text>
              </View>

              {/* Matchup Row */}
              <View style={styles.matchupRow}>
                {/* Away Team */}
                <View style={styles.teamRow}>
                  {pick.away_team_logo ? (
                    <Image source={{ uri: pick.away_team_logo }} style={styles.teamLogoSmall} />
                  ) : (
                    <View style={styles.logoPlaceholderSmall}>
                      <Text style={styles.logoPlaceholderTextSmall}>{pick.away_team_abbr?.charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={styles.teamName}>{pick.away_team_abbr}</Text>
                  <Text style={[styles.scoreText, !homeWon && pick.away_score !== null && styles.winningScore]}>
                    {pick.away_score ?? '-'}
                  </Text>
                </View>

                {/* Home Team */}
                <View style={styles.teamRow}>
                  {pick.home_team_logo ? (
                    <Image source={{ uri: pick.home_team_logo }} style={styles.teamLogoSmall} />
                  ) : (
                    <View style={styles.logoPlaceholderSmall}>
                      <Text style={styles.logoPlaceholderTextSmall}>{pick.home_team_abbr?.charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={styles.teamName}>{pick.home_team_abbr}</Text>
                  <Text style={[styles.scoreText, homeWon && styles.winningScore]}>
                    {pick.home_score ?? '-'}
                  </Text>
                </View>
              </View>

              {/* Our Pick Section */}
              <View style={styles.ourPickSection}>
                <Text style={styles.ourPickLabel}>OUR PICK</Text>
                <View style={styles.pickBetRow}>
                  <Text style={styles.pickBetText}>
                    {pick.is_draw_pick ? 'Draw' : pick.pick_abbr}
                    {pickType === 'spread' && pick.spread !== null && (
                      <Text style={styles.spreadText}> {pick.spread > 0 ? '+' : ''}{pick.spread}</Text>
                    )}
                    {pickType === 'ml' && pick.odds && !pick.is_draw_pick && (
                      <Text style={styles.oddsText}> ({pick.odds > 0 ? '+' : ''}{pick.odds})</Text>
                    )}
                  </Text>
                </View>
              </View>

              {/* Result Section */}
              <View style={[styles.resultSection, isWin ? styles.resultWin : styles.resultLoss]}>
                <Text style={styles.resultIcon}>{isWin ? '✓' : '✗'}</Text>
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultMainText}>
                    {pickType === 'spread'
                      ? (isWin ? 'COVERED' : 'MISSED')
                      : (isWin ? 'WIN' : 'LOSS')
                    }
                  </Text>
                  {margin !== null && (
                    <Text style={styles.resultSubText}>
                      {homeWon ? pick.home_team_abbr : pick.away_team_abbr} won by {margin}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        })
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
  confidenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  confidenceCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  confidenceRecord: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 4,
  },
  confidencePct: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 2,
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  cardLeague: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  matchupRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  teamLogoSmall: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  logoPlaceholderSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoPlaceholderTextSmall: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6B6B6B',
  },
  teamName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
    minWidth: 36,
    textAlign: 'right',
  },
  winningScore: {
    color: '#000',
    fontWeight: '700',
  },
  ourPickSection: {
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  ourPickLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 4,
  },
  pickBetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickBetText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  spreadText: {
    color: '#007AFF',
  },
  oddsText: {
    color: '#8E8E93',
    fontWeight: '400',
  },
  resultSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  resultWin: {
    backgroundColor: '#34C759',
  },
  resultLoss: {
    backgroundColor: '#FF3B30',
  },
  resultIcon: {
    fontSize: 20,
    color: '#FFF',
    fontWeight: 'bold',
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultMainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  resultSubText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
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
});
