import { useState } from 'react';
import { View, TouchableOpacity, Text, TextInput, StyleSheet, Keyboard } from 'react-native';

interface BankrollSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

const TIERS = [25, 50, 100, 200];

export function BankrollSelector({ value, onChange }: BankrollSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState('');

  const isCustomValue = !TIERS.includes(value);

  const handleTierPress = (tier: number) => {
    setShowCustom(false);
    onChange(tier);
  };

  const handleCustomPress = () => {
    setShowCustom(true);
    setCustomText(isCustomValue ? String(value) : '');
  };

  const handleCustomSubmit = () => {
    const parsed = parseInt(customText, 10);
    if (!isNaN(parsed) && parsed >= 5) {
      onChange(parsed);
    }
    setShowCustom(false);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Bankroll</Text>
      <View style={styles.row}>
        {TIERS.map((tier) => (
          <TouchableOpacity
            key={tier}
            style={[styles.chip, value === tier && styles.chipSelected]}
            onPress={() => handleTierPress(tier)}
          >
            <Text style={[styles.chipText, value === tier && styles.chipTextSelected]}>
              ${tier}
            </Text>
          </TouchableOpacity>
        ))}
        {showCustom ? (
          <View style={styles.customInputWrap}>
            <Text style={styles.dollar}>$</Text>
            <TextInput
              style={styles.customInput}
              value={customText}
              onChangeText={setCustomText}
              onSubmitEditing={handleCustomSubmit}
              onBlur={handleCustomSubmit}
              keyboardType="number-pad"
              autoFocus
              maxLength={5}
              placeholder="50"
            />
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.chip, isCustomValue && styles.chipSelected]}
            onPress={handleCustomPress}
          >
            <Text style={[styles.chipText, isCustomValue && styles.chipTextSelected]}>
              {isCustomValue ? `$${value}` : 'Custom'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
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
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e8e8e8',
  },
  chipSelected: {
    backgroundColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  chipTextSelected: {
    color: '#fff',
  },
  customInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8e8e8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  dollar: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  customInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 50,
    paddingVertical: 4,
  },
});
