import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Game, Pick, SportFilter as SportFilterType, PickMode, PickType } from '../../types/sports';
import { fetchGames } from '../../services/espn';
import { analyzeGames, getAnalyzedPickLabel } from '../../services/analysis';
import { SportFilter } from '../../components/SportFilter';
import { GameRow } from '../../components/GameRow';
import { PickButton } from '../../components/PickButton';
import { PickModeSelector } from '../../components/PickModeSelector';

export default function Sports() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGames, setSelectedGames] = useState<Map<string, Game>>(new Map());
  const [filter, setFilter] = useState<SportFilterType>('all');
  const [pickMode, setPickMode] = useState<PickMode>('random');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const loadGames = useCallback(async () => {
    const data = await fetchGames(filter);
    setGames(data);
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

  const toggleGame = (game: Game) => {
    setSelectedGames((prev) => {
      const next = new Map(prev);
      if (next.has(game.id)) {
        next.delete(game.id);
      } else {
        next.set(game.id, game);
      }
      return next;
    });
  };

  const handleRandomPick = () => {
    const gamesToPick = Array.from(selectedGames.values());
    const pickTypes: Array<PickType> = [
      'home', 'away', 'home_cover', 'away_cover', 'over', 'under'
    ];
    const newPicks: Pick[] = gamesToPick.map((game) => {
      const pickType = pickTypes[Math.floor(Math.random() * pickTypes.length)];
      let label: string;
      switch (pickType) {
        case 'home':
          label = `${game.homeTeam} ML`;
          break;
        case 'away':
          label = `${game.awayTeam} ML`;
          break;
        case 'home_cover':
          label = `${game.homeTeam} to cover`;
          break;
        case 'away_cover':
          label = `${game.awayTeam} to cover`;
          break;
        case 'over':
          label = 'Over';
          break;
        case 'under':
          label = 'Under';
          break;
      }
      return { game, pickType, label };
    });
    router.push({
      pathname: '/betslip',
      params: { picks: JSON.stringify(newPicks) },
    });
  };

  const handleAnalyzedPick = async () => {
    const gamesToPick = Array.from(selectedGames.values());
    setAnalyzing(true);
    
    try {
      const analyses = await analyzeGames(gamesToPick);
      
      const newPicks: Pick[] = gamesToPick.map((game) => {
        const analysis = analyses.get(game.id);
        if (!analysis) {
          // Fallback to random if analysis fails
          const pickType: PickType = Math.random() < 0.5 ? 'home' : 'away';
          return {
            game,
            pickType,
            label: pickType === 'home' ? `${game.homeTeam} ML` : `${game.awayTeam} ML`,
          };
        }
        
        return {
          game,
          pickType: analysis.pickType,
          label: getAnalyzedPickLabel(game, analysis),
          analysis,
        };
      });
      
      router.push({
        pathname: '/betslip',
        params: { picks: JSON.stringify(newPicks) },
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      // Fallback to random on error
      handleRandomPick();
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePick = () => {
    if (pickMode === 'analyzed') {
      handleAnalyzedPick();
    } else {
      handleRandomPick();
    }
  };

  const selectedCount = selectedGames.size;
  const isPickDisabled = selectedCount === 0 || analyzing;

  const getButtonLabel = () => {
    if (analyzing) {
      return 'Analyzing...';
    }
    if (selectedCount === 0) {
      return pickMode === 'analyzed' ? 'Analyze Games' : 'Pick Sides';
    }
    return pickMode === 'analyzed' 
      ? `Analyze Games (${selectedCount})`
      : `Pick Sides (${selectedCount})`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <SportFilter selected={filter} onSelect={setFilter} />
      <PickModeSelector 
        selected={pickMode} 
        onSelect={setPickMode}
        disabled={analyzing}
      />

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
              selected={selectedGames.has(item.id)}
              onToggle={() => toggleGame(item)}
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
        disabled={isPickDisabled}
        label={getButtonLabel()}
      />
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
