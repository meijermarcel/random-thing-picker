import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Pick } from '../types/sports';

interface SportsPicksModalProps {
  picks: Pick[] | null;
  onClose: () => void;
}

export function SportsPicksModal({ picks, onClose }: SportsPicksModalProps) {
  if (!picks) return null;

  return (
    <Modal
      visible={picks !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.header}>Your Picks</Text>
          <FlatList
            data={picks}
            keyExtractor={(item) => item.game.id}
            renderItem={({ item }) => (
              <View style={styles.pickRow}>
                <Text style={styles.matchup}>
                  {item.game.awayTeam} @ {item.game.homeTeam}
                </Text>
                <Text style={styles.pickLabel}>{item.label}</Text>
                <Text style={styles.league}>{item.game.league}</Text>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            style={styles.list}
          />
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  list: {
    flexGrow: 0,
  },
  pickRow: {
    paddingVertical: 12,
  },
  matchup: {
    fontSize: 14,
    color: '#666',
  },
  pickLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  league: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
