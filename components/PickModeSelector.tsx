import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PickMode } from '../types/sports';

interface PickModeSelectorProps {
  selected: PickMode;
  onSelect: (mode: PickMode) => void;
  disabled?: boolean;
}

export function PickModeSelector({ selected, onSelect, disabled }: PickModeSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Pick Mode:</Text>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.option,
            styles.optionLeft,
            selected === 'random' && styles.optionSelected,
          ]}
          onPress={() => onSelect('random')}
          disabled={disabled}
        >
          <Ionicons
            name="dice"
            size={18}
            color={selected === 'random' ? '#fff' : '#666'}
          />
          <Text
            style={[
              styles.optionText,
              selected === 'random' && styles.optionTextSelected,
            ]}
          >
            Random
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.option,
            styles.optionRight,
            selected === 'analyzed' && styles.optionSelected,
          ]}
          onPress={() => onSelect('analyzed')}
          disabled={disabled}
        >
          <Ionicons
            name="analytics"
            size={18}
            color={selected === 'analyzed' ? '#fff' : '#666'}
          />
          <Text
            style={[
              styles.optionText,
              selected === 'analyzed' && styles.optionTextSelected,
            ]}
          >
            Analyzed
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginRight: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: '#fff',
  },
  optionLeft: {
    borderRightWidth: 1,
    borderRightColor: '#007AFF',
  },
  optionRight: {},
  optionSelected: {
    backgroundColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  optionTextSelected: {
    color: '#fff',
  },
});
