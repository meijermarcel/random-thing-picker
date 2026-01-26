import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SportFilter as SportFilterType } from '../types/sports';

interface SportFilterProps {
  selected: SportFilterType;
  onSelect: (filter: SportFilterType) => void;
}

const FILTERS: { value: SportFilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'nfl', label: 'NFL' },
  { value: 'nba', label: 'NBA' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
  { value: 'soccer', label: 'Soccer' },
];

export function SportFilter({ selected, onSelect }: SportFilterProps) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            style={[styles.chip, selected === filter.value && styles.chipSelected]}
            onPress={() => onSelect(filter.value)}
          >
            <Text style={[styles.chipText, selected === filter.value && styles.chipTextSelected]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#f8f8f8',
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e8e8e8',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  chipTextSelected: {
    color: '#fff',
  },
});
