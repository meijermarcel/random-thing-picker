import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Game, Pick, SportFilter as SportFilterType } from '../../types/sports';
import { fetchGames } from '../../services/espn';
import { SportFilter } from '../../components/SportFilter';
import { GameRow } from '../../components/GameRow';
import { PickButton } from '../../components/PickButton';
import { SportsPicksModal } from '../../components/SportsPicksModal';

export default function Sports() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [filter, setFilter] = useState<SportFilterType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGames = useCallback(async () => {
    const data = await fetchGames(filter);
    setGames(data);
    setSelectedIds(new Set());
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    loadGames().finally(() => setLoading(false));
  }, [loadGames]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  };

  const toggleGame = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePick = () => {
    const selectedGames = games.filter((g) => selectedIds.has(g.id));
    const newPicks = selectedGames.map((game) => {
      const pickHome = Math.random() < 0.5;
      return {
        game,
        pickedTeam: pickHome ? game.homeTeam : game.awayTeam,
        opponent: pickHome ? game.awayTeam : game.homeTeam,
      };
    });
    setPicks(newPicks);
  };

  const selectedCount = selectedIds.size;

  return (
    <SafeAreaView style={styles.container}>
      <SportFilter selected={filter} onSelect={setFilter} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : games.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No upcoming games</Text>
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GameRow
              game={item}
              selected={selectedIds.has(item.id)}
              onToggle={() => toggleGame(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      <PickButton
        onPick={handlePick}
        disabled={selectedCount === 0}
        label={selectedCount > 0 ? `Pick Sides (${selectedCount})` : 'Pick Sides'}
      />

      <SportsPicksModal picks={picks} onClose={() => setPicks(null)} />
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
  separator: {
    height: 1,
    backgroundColor: '#eee',
  },
});
