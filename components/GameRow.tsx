import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Game } from '../types/sports';

interface GameRowProps {
  game: Game;
  selected: boolean;
  onToggle: () => void;
}

function formatGameTime(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

export function GameRow({ game, selected, onToggle }: GameRowProps) {
  return (
    <TouchableOpacity
      style={[styles.container, selected && styles.containerSelected]}
      onPress={onToggle}
    >
      <View style={styles.checkbox}>
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={24}
          color={selected ? '#007AFF' : '#ccc'}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.teams}>
          {game.awayTeam} @ {game.homeTeam}
        </Text>
        <Text style={styles.meta}>
          {game.league} · {formatGameTime(game.startTime)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  containerSelected: {
    backgroundColor: '#f0f7ff',
  },
  checkbox: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  teams: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: '#888',
  },
});
