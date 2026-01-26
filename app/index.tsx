import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { AddItemInput } from '../components/AddItemInput';
import { ItemList } from '../components/ItemList';
import { PickButton } from '../components/PickButton';
import { ResultModal } from '../components/ResultModal';

export default function Index() {
  const [items, setItems] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const handleAdd = (item: string) => {
    setItems([...items, item]);
  };

  const handleDelete = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handlePick = () => {
    const randomIndex = Math.floor(Math.random() * items.length);
    setSelectedItem(items[randomIndex]);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  const canPick = items.length >= 2;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Random Picker</Text>
        <AddItemInput onAdd={handleAdd} />
        <View style={styles.listContainer}>
          <ItemList items={items} onDelete={handleDelete} />
        </View>
        {!canPick && items.length === 1 && (
          <Text style={styles.hint}>Add one more item to pick</Text>
        )}
        <PickButton onPick={handlePick} disabled={!canPick} />
        <ResultModal item={selectedItem} onClose={handleCloseModal} />
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 16,
  },
  listContainer: {
    flex: 1,
  },
  hint: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
});
