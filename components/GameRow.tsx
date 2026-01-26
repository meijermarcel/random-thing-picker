import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
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
        <View style={styles.teamRow}>
          {game.awayLogo && <Image source={{ uri: game.awayLogo }} style={styles.logo} />}
          <Text style={styles.teamName}>{game.awayTeam}</Text>
        </View>
        <View style={styles.teamRow}>
          {game.homeLogo && <Image source={{ uri: game.homeLogo }} style={styles.logo} />}
          <Text style={styles.teamName}>{game.homeTeam}</Text>
        </View>
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
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '500',
  },
  meta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});
