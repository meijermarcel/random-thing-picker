import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SportFilter } from '../../components/SportFilter';
import { DateSelector } from '../../components/DateSelector';
import { SpreadPickCard } from '../../components/SpreadPickCard';
import { fetchGames as fetchGamesFromAPI, APIGameWithPick, invalidateCache } from '../../services/api';
import { SportFilter as SportFilterType } from '../../types/sports';

export default function Spread() {
  const [spreadGames, setSpreadGames] = useState<APIGameWithPick[]>([]);
  const [filter, setFilter] = useState<SportFilterType>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGames = useCallback(async () => {
    const sport = filter === 'all' ? undefined : filter;
    const data = await fetchGamesFromAPI(selectedDate, sport);

    // Filter to only games with spread data and spread picks
    const filtered = data.filter(
      (g) =>
        g.game.espn_data?.odds?.spread != null &&
        g.pick?.analysis_factors?.spread_pick != null
    );

    setSpreadGames(filtered);
  }, [filter, selectedDate]);

  useEffect(() => {
    setLoading(true);
    loadGames().finally(() => setLoading(false));
  }, [loadGames]);

  const handleRefresh = async () => {
    setRefreshing(true);
    invalidateCache('picks');
    await loadGames();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: APIGameWithPick }) => {
    const spread = item.game.espn_data?.odds?.spread ?? 0;
    const spreadPick = item.pick?.analysis_factors?.spread_pick as 'home' | 'away';
    const spreadConfidence = (item.pick?.analysis_factors?.spread_confidence as 'low' | 'medium' | 'high') ?? 'medium';
    const projection = item.pick?.analysis_factors?.projection;

    // Calculate projected margin from home team perspective
    let projectedMargin = 0;
    if (projection) {
      projectedMargin = projection.projected_winner === 'home'
        ? projection.projected_margin
        : -projection.projected_margin;
    }

    return (
      <SpreadPickCard
        homeTeam={item.home_team?.name ?? 'Home'}
        awayTeam={item.away_team?.name ?? 'Away'}
        homeLogo={item.home_team?.logo_url ?? undefined}
        awayLogo={item.away_team?.logo_url ?? undefined}
        spreadPick={spreadPick}
        spreadConfidence={spreadConfidence}
        spread={spread}
        projectedMargin={projectedMargin}
        gameTime={new Date(item.game.scheduled_at)}
        league={item.game.espn_data?.league ?? item.game.sport.toUpperCase()}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <SportFilter selected={filter} onSelect={setFilter} />
      <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : spreadGames.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No spread picks available</Text>
        </View>
      ) : (
        <FlatList
          data={spreadGames}
          keyExtractor={(item) => item.game.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
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
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  listContent: {
    paddingVertical: 12,
  },
});
