# Sports Picks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a sports picks tab that fetches upcoming games and randomly picks sides for selected games.

**Architecture:** Convert single-screen app to tab navigation using expo-router. New sports tab fetches from ESPN API, displays games with checkboxes, and shows random picks in a modal.

**Tech Stack:** expo-router tabs, ESPN unofficial API, React Native FlatList, existing component patterns.

---

### Task 1: Set Up Tab Navigation Structure

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx`
- Delete: `app/index.tsx` (move content to tabs/index.tsx)

**Step 1: Create tabs layout**

Create `app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Random Picker',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="dice" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sports"
        options={{
          title: 'Sports Picks',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="football" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

**Step 2: Move existing screen to tabs**

Copy content from `app/index.tsx` to `app/(tabs)/index.tsx` (exact same content).

**Step 3: Create placeholder sports screen**

Create `app/(tabs)/sports.tsx`:

```tsx
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function Sports() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Sports Picks Coming Soon</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    color: '#888',
  },
});
```

**Step 4: Delete old index file**

Delete `app/index.tsx` (now lives in tabs folder).

**Step 5: Verify app runs with tabs**

Run: `npx expo start`
Expected: App shows with two tabs at bottom, Random Picker works as before.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: convert to tab navigation with Random Picker and Sports Picks tabs"
```

---

### Task 2: Create ESPN API Service

**Files:**
- Create: `services/espn.ts`
- Create: `types/sports.ts`

**Step 1: Create types**

Create `types/sports.ts`:

```tsx
export interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  league: string;
  leagueAbbr: string;
}

export interface Pick {
  game: Game;
  pickedTeam: string;
  opponent: string;
}

export type SportFilter = 'all' | 'nfl' | 'nba' | 'mlb' | 'nhl' | 'soccer';
```

**Step 2: Create ESPN service**

Create `services/espn.ts`:

```tsx
import { Game, SportFilter } from '../types/sports';

const ENDPOINTS: Record<Exclude<SportFilter, 'all'>, { sport: string; league: string; name: string }> = {
  nfl: { sport: 'football', league: 'nfl', name: 'NFL' },
  nba: { sport: 'basketball', league: 'nba', name: 'NBA' },
  mlb: { sport: 'baseball', league: 'mlb', name: 'MLB' },
  nhl: { sport: 'hockey', league: 'nhl', name: 'NHL' },
  soccer: { sport: 'soccer', league: 'eng.1', name: 'Premier League' },
};

async function fetchLeagueGames(sport: string, league: string, leagueName: string): Promise<Game[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const events = data.events || [];

    return events.map((event: any) => {
      const competition = event.competitions?.[0];
      const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away');

      return {
        id: event.id,
        homeTeam: homeTeam?.team?.displayName || 'TBD',
        awayTeam: awayTeam?.team?.displayName || 'TBD',
        startTime: new Date(event.date),
        league: leagueName,
        leagueAbbr: league.toUpperCase(),
      };
    });
  } catch {
    return [];
  }
}

export async function fetchGames(filter: SportFilter): Promise<Game[]> {
  if (filter === 'all') {
    const allGames = await Promise.all(
      Object.entries(ENDPOINTS).map(([_, config]) =>
        fetchLeagueGames(config.sport, config.league, config.name)
      )
    );
    return allGames.flat().sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  const config = ENDPOINTS[filter];
  return fetchLeagueGames(config.sport, config.league, config.name);
}
```

**Step 3: Commit**

```bash
git add types/sports.ts services/espn.ts
git commit -m "feat: add ESPN API service and sports types"
```

---

### Task 3: Create SportFilter Component

**Files:**
- Create: `components/SportFilter.tsx`

**Step 1: Create the component**

Create `components/SportFilter.tsx`:

```tsx
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
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
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e8e8e8',
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
```

**Step 2: Commit**

```bash
git add components/SportFilter.tsx
git commit -m "feat: add SportFilter chip selector component"
```

---

### Task 4: Create GameRow Component

**Files:**
- Create: `components/GameRow.tsx`

**Step 1: Create the component**

Create `components/GameRow.tsx`:

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Game } from '../types/sports';

interface GameRowProps {
  game: Game;
  selected: boolean;
  onToggle: () => void;
}

function formatGameTime(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

export function GameRow({ game, selected, onToggle }: GameRowProps) {
  return (
    <TouchableOpacity
      style={[styles.container, selected && styles.containerSelected]}
      onPress={onToggle}
    >
      <View style={styles.checkbox}>
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={24}
          color={selected ? '#007AFF' : '#ccc'}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.teams}>
          {game.awayTeam} @ {game.homeTeam}
        </Text>
        <Text style={styles.meta}>
          {game.league} · {formatGameTime(game.startTime)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  containerSelected: {
    backgroundColor: '#f0f7ff',
  },
  checkbox: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  teams: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: '#888',
  },
});
```

**Step 2: Commit**

```bash
git add components/GameRow.tsx
git commit -m "feat: add GameRow component with checkbox and time formatting"
```

---

### Task 5: Create SportsPicksModal Component

**Files:**
- Create: `components/SportsPicksModal.tsx`

**Step 1: Create the component**

Create `components/SportsPicksModal.tsx`:

```tsx
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
                <Text style={styles.pickedTeam}>{item.pickedTeam}</Text>
                <Text style={styles.opponent}>vs {item.opponent}</Text>
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
  pickedTeam: {
    fontSize: 18,
    fontWeight: '600',
  },
  opponent: {
    fontSize: 15,
    color: '#666',
    marginTop: 2,
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
```

**Step 2: Commit**

```bash
git add components/SportsPicksModal.tsx
git commit -m "feat: add SportsPicksModal for displaying random picks"
```

---

### Task 6: Implement Sports Screen

**Files:**
- Modify: `app/(tabs)/sports.tsx`

**Step 1: Replace placeholder with full implementation**

Replace `app/(tabs)/sports.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Game, Pick, SportFilter as SportFilterType } from '../../types/sports';
import { fetchGames } from '../../services/espn';
import { SportFilter } from '../../components/SportFilter';
import { GameRow } from '../../components/GameRow';
import { PickButton } from '../../components/PickButton';
import { SportsPicksModal } from '../../components/SportsPicksModal';

export default function Sports() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [filter, setFilter] = useState<SportFilterType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGames = useCallback(async () => {
    const data = await fetchGames(filter);
    setGames(data);
    setSelectedIds(new Set());
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    loadGames().finally(() => setLoading(false));
  }, [loadGames]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  };

  const toggleGame = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePick = () => {
    const selectedGames = games.filter((g) => selectedIds.has(g.id));
    const newPicks = selectedGames.map((game) => {
      const pickHome = Math.random() < 0.5;
      return {
        game,
        pickedTeam: pickHome ? game.homeTeam : game.awayTeam,
        opponent: pickHome ? game.awayTeam : game.homeTeam,
      };
    });
    setPicks(newPicks);
  };

  const selectedCount = selectedIds.size;

  return (
    <SafeAreaView style={styles.container}>
      <SportFilter selected={filter} onSelect={setFilter} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : games.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No upcoming games</Text>
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GameRow
              game={item}
              selected={selectedIds.has(item.id)}
              onToggle={() => toggleGame(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      <PickButton
        onPick={handlePick}
        disabled={selectedCount === 0}
        label={selectedCount > 0 ? `Pick Sides (${selectedCount})` : 'Pick Sides'}
      />

      <SportsPicksModal picks={picks} onClose={() => setPicks(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
  },
});
```

**Step 2: Update PickButton to accept custom label**

Modify `components/PickButton.tsx` to add optional label prop:

```tsx
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface PickButtonProps {
  onPick: () => void;
  disabled: boolean;
  label?: string;
}

export function PickButton({ onPick, disabled, label = 'Pick Random' }: PickButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPick}
      disabled={disabled}
    >
      <Text style={[styles.text, disabled && styles.disabledText]}>
        {label}
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

**Step 3: Verify app runs**

Run: `npx expo start`
Expected: Both tabs work. Sports tab shows games, can select and pick sides.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement Sports Picks screen with game selection and random picks"
```

---

### Task 7: Final Testing and Cleanup

**Step 1: Test all functionality**

Checklist:
- [ ] Tab navigation works
- [ ] Random Picker tab works as before
- [ ] Sports tab loads games
- [ ] Filter chips change displayed games
- [ ] Can select/deselect games
- [ ] Pick Sides button shows count
- [ ] Pick Sides generates random picks
- [ ] Modal shows all picks
- [ ] Pull-to-refresh works
- [ ] Empty state shows when no games

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final cleanup and fixes"
```

---

## Summary

| Task | Files | Purpose |
|------|-------|---------|
| 1 | Tab layout, screens | Convert to tab navigation |
| 2 | types, services | ESPN API integration |
| 3 | SportFilter | Filter chip component |
| 4 | GameRow | Game list item with checkbox |
| 5 | SportsPicksModal | Results modal |
| 6 | Sports screen | Wire everything together |
| 7 | Testing | Verify all functionality |
