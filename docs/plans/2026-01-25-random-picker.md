# Random Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React Native/Expo app that lets users enter items and randomly pick one.

**Architecture:** Single-screen app with inline input, scrollable list with swipe-to-delete, and modal for displaying picked item. State managed with React useState hooks.

**Tech Stack:** Expo (TypeScript template), react-native-gesture-handler for swipe gestures, React Native built-in Modal component.

---

### Task 1: Initialize Expo Project

**Files:**
- Create: Project scaffolding via `create-expo-app`

**Step 1: Create Expo project with TypeScript**

```bash
cd /Users/marcelmeijer/Documents/rtp/.worktrees/random-picker
npx create-expo-app@latest . --template blank-typescript
```

Accept any prompts to overwrite existing files (docs folder will be preserved).

**Step 2: Verify project runs**

Run: `npx expo start`
Expected: Metro bundler starts, QR code displayed

Press `q` to quit after verifying.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: initialize Expo project with TypeScript"
```

---

### Task 2: Create AddItemInput Component

**Files:**
- Create: `components/AddItemInput.tsx`

**Step 1: Create the component**

```tsx
import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface AddItemInputProps {
  onAdd: (item: string) => void;
}

export function AddItemInput({ onAdd }: AddItemInputProps) {
  const [text, setText] = useState('');

  const handleAdd = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onAdd(trimmed);
      setText('');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Add an item..."
        onSubmitEditing={handleAdd}
        returnKeyType="done"
      />
      <TouchableOpacity style={styles.button} onPress={handleAdd}>
        <Text style={styles.buttonText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

**Step 2: Commit**

```bash
git add components/AddItemInput.tsx
git commit -m "feat: add AddItemInput component"
```

---

### Task 3: Create ItemList Component with Swipe-to-Delete

**Files:**
- Create: `components/ItemList.tsx`

**Step 1: Create the component**

```tsx
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useRef } from 'react';

interface ItemListProps {
  items: string[];
  onDelete: (index: number) => void;
}

export function ItemList({ items, onDelete }: ItemListProps) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Add some items to get started</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <SwipeableItem
            item={item}
            onDelete={() => onDelete(index)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </GestureHandlerRootView>
  );
}

interface SwipeableItemProps {
  item: string;
  onDelete: () => void;
}

function SwipeableItem({ item, onDelete }: SwipeableItemProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <View style={styles.deleteAction}>
      <Text style={styles.deleteText}>Delete</Text>
    </View>
  );

  const handleSwipeOpen = () => {
    onDelete();
    swipeableRef.current?.close();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
    >
      <View style={styles.item}>
        <Text style={styles.itemText} numberOfLines={1}>{item}</Text>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  item: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  itemText: {
    fontSize: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
  },
  deleteAction: {
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '600',
  },
});
```

**Step 2: Commit**

```bash
git add components/ItemList.tsx
git commit -m "feat: add ItemList component with swipe-to-delete"
```

---

### Task 4: Create PickButton Component

**Files:**
- Create: `components/PickButton.tsx`

**Step 1: Create the component**

```tsx
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
```

**Step 2: Commit**

```bash
git add components/PickButton.tsx
git commit -m "feat: add PickButton component"
```

---

### Task 5: Create ResultModal Component

**Files:**
- Create: `components/ResultModal.tsx`

**Step 1: Create the component**

```tsx
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ResultModalProps {
  item: string | null;
  onClose: () => void;
}

export function ResultModal({ item, onClose }: ResultModalProps) {
  return (
    <Modal
      visible={item !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.label}>You picked:</Text>
          <Text style={styles.result}>{item}</Text>
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
    padding: 32,
    width: '100%',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    color: '#888',
    marginBottom: 8,
  },
  result: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

**Step 2: Commit**

```bash
git add components/ResultModal.tsx
git commit -m "feat: add ResultModal component"
```

---

### Task 6: Wire Up Main Screen

**Files:**
- Modify: `app/index.tsx`

**Step 1: Replace contents of app/index.tsx**

```tsx
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
```

**Step 2: Run app to verify everything works**

Run: `npx expo start`
Test manually:
- Add items
- Swipe to delete
- Pick random (needs 2+ items)
- Modal shows and closes

**Step 3: Commit**

```bash
git add app/index.tsx
git commit -m "feat: wire up main screen with all components"
```

---

### Task 7: Final Cleanup and Testing

**Files:**
- Review all files

**Step 1: Run the app and test all flows**

Run: `npx expo start`

Test checklist:
- [ ] Add item via input
- [ ] Add item via keyboard return
- [ ] Empty input doesn't add item
- [ ] Swipe left to delete item
- [ ] Pick button disabled with 0-1 items
- [ ] Pick button enabled with 2+ items
- [ ] Modal shows picked item
- [ ] Modal closes on Done
- [ ] Keyboard dismisses on tap outside

**Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final cleanup"
```

---

## Summary

| Task | Component | Purpose |
|------|-----------|---------|
| 1 | Project setup | Initialize Expo with TypeScript |
| 2 | AddItemInput | Text input with Add button |
| 3 | ItemList | Scrollable list with swipe-to-delete |
| 4 | PickButton | Random pick trigger |
| 5 | ResultModal | Display picked item |
| 6 | Main screen | Wire everything together |
| 7 | Testing | Verify all functionality |
