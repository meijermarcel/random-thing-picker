import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { RiskMode } from '../types/sports';

interface RiskModeSelectorProps {
  value: RiskMode;
  onChange: (mode: RiskMode) => void;
}

const MODES: { value: RiskMode; label: string; color: string; description: string }[] = [
  { value: 'conservative', label: 'Conservative', color: '#34C759', description: 'Mostly straight bets, top picks only' },
  { value: 'balanced', label: 'Balanced', color: '#FF9500', description: 'Mix of straights and parlays' },
  { value: 'aggressive', label: 'Aggressive', color: '#FF3B30', description: 'More parlays and underdog plays' },
];

export function RiskModeSelector({ value, onChange }: RiskModeSelectorProps) {
  const selected = MODES.find(m => m.value === value) ?? MODES[1]; // fallback to balanced

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Risk Mode</Text>
      <View style={styles.row}>
        {MODES.map((mode) => (
          <TouchableOpacity
            key={mode.value}
            style={[
              styles.pill,
              value === mode.value && { backgroundColor: mode.color },
            ]}
            onPress={() => onChange(mode.value)}
          >
            <Text style={[styles.pillText, value === mode.value && styles.pillTextSelected]}>
              {mode.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.description}>{selected.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  pillTextSelected: {
    color: '#fff',
  },
  description: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
    textAlign: 'center',
  },
});
