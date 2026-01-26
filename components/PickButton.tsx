import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface PickButtonProps {
  onPick: () => void;
  disabled: boolean;
}

export function PickButton({ onPick, disabled }: PickButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPick}
      disabled={disabled}
    >
      <Text style={[styles.text, disabled && styles.disabledText]}>
        Pick Random
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    margin: 16,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabled: {
    backgroundColor: '#ccc',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  disabledText: {
    color: '#888',
  },
});
