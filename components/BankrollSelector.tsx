import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Keyboard } from 'react-native';

interface BankrollSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

export function BankrollSelector({ value, onChange }: BankrollSelectorProps) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  const commit = () => {
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      onChange(parsed);
      setText(String(parsed));
    } else {
      setText(String(value));
    }
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Bankroll</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <Text style={styles.dollar}>$</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={commit}
          onBlur={() => { setFocused(false); commit(); }}
          onFocus={() => { setFocused(true); setText(''); }}
          keyboardType="number-pad"
          maxLength={6}
          selectTextOnFocus
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8e8e8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputWrapFocused: {
    borderColor: '#007AFF',
  },
  dollar: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  input: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    minWidth: 40,
    paddingVertical: 0,
  },
});
