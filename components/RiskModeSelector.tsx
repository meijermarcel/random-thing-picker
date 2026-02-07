import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { RiskMode } from '../types/sports';

interface RiskModeSelectorProps {
  value: RiskMode;
  onChange: (mode: RiskMode) => void;
}

const MODES: { value: RiskMode; label: string; color: string }[] = [
  { value: 'conservative', label: 'Conservative', color: '#34C759' },
  { value: 'balanced', label: 'Balanced', color: '#FF9500' },
  { value: 'aggressive', label: 'Aggressive', color: '#FF3B30' },
];

export function RiskModeSelector({ value, onChange }: RiskModeSelectorProps) {
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
});
