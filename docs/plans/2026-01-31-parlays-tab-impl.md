# Parlays Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new Parlays tab that auto-generates parlay recommendations from analyzed games.

**Architecture:** Create a new tab screen that fetches games, runs analysis, then uses a parlay builder service to generate recommendations across different strategies (Lock, Value, Sport, Longshot). Reuse existing ESPN, analysis, and betslip components.

**Tech Stack:** TypeScript, React Native/Expo, expo-router

---

## Task 1: Add ParlayRecommendation Type

**Files:**
- Modify: `types/sports.ts`

**Step 1: Add the type**

Add at the end of the file:

```typescript
export type ParlayCategory = 'lock' | 'value' | 'sport' | 'longshot';

export interface ParlayRecommendation {
  id: string;
  category: ParlayCategory;
  title: string;
  subtitle: string;
  picks: Pick[];
  icon: string;
}
```

**Step 2: Commit**

```bash
git add types/sports.ts
git commit -m "feat: add ParlayRecommendation type"
```

---

## Task 2: Create ParlayCard Component

**Files:**
- Create: `components/ParlayCard.tsx`

**Step 1: Create the component**

```typescript
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ParlayRecommendation } from '../types/sports';

interface ParlayCardProps {
  parlay: ParlayRecommendation;
  onView: () => void;
}

export function ParlayCard({ parlay, onView }: ParlayCardProps) {
  // Build summary of picks (first 3 teams)
  const pickSummary = parlay.picks
    .slice(0, 3)
    .map(p => {
      if (p.pickType === 'draw') return 'Draw';
      if (p.pickType === 'over') return 'Over';
      if (p.pickType === 'under') return 'Under';
      return p.pickType === 'home' ? p.game.homeTeam : p.game.awayTeam;
    })
    .join(', ');

  const moreCount = parlay.picks.length - 3;
  const displaySummary = moreCount > 0
    ? `${pickSummary}, +${moreCount} more`
    : pickSummary;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>{parlay.icon}</Text>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{parlay.title}</Text>
          <Text style={styles.subtitle}>{parlay.subtitle}</Text>
        </View>
      </View>
      <Text style={styles.summary} numberOfLines={1}>{displaySummary}</Text>
      <TouchableOpacity style={styles.viewButton} onPress={onView}>
        <Text style={styles.viewButtonText}>View</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  icon: {
    fontSize: 28,
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  summary: {
    fontSize: 14,
    color: '#444',
    marginBottom: 12,
  },
  viewButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
```

**Step 2: Commit**

```bash
git add components/ParlayCard.tsx
git commit -m "feat: add ParlayCard component"
```

---

## Task 3: Create Parlay Builder Service

**Files:**
- Create: `services/parlayBuilder.ts`

**Step 1: Create the service**

```typescript
import { Game, Pick, PickAnalysis, ParlayRecommendation, Confidence } from '../types/sports';
import { getAnalyzedPickLabel } from './analysis';

interface AnalyzedGame {
  game: Game;
  analysis: PickAnalysis;
}

// Generate all parlay recommendations from analyzed games
export function generateParlays(
  games: Game[],
  analyses: Map<string, PickAnalysis>
): ParlayRecommendation[] {
  // Build analyzed games list
  const analyzedGames: AnalyzedGame[] = games
    .filter(g => analyses.has(g.id))
    .map(g => ({ game: g, analysis: analyses.get(g.id)! }));

  if (analyzedGames.length < 2) {
    return [];
  }

  const parlays: ParlayRecommendation[] = [];

  // Lock of the Day - high confidence only
  const lockParlay = buildLockParlay(analyzedGames);
  if (lockParlay) parlays.push(lockParlay);

  // Best Value - biggest edge
  const valueParlay = buildValueParlay(analyzedGames);
  if (valueParlay) parlays.push(valueParlay);

  // Sport Specials - only if 15+ games
  if (analyzedGames.length >= 15) {
    const sportParlays = buildSportParlays(analyzedGames);
    parlays.push(...sportParlays);
  }

  // Longshot - only if 5+ games
  if (analyzedGames.length >= 5) {
    const longshotParlay = buildLongshotParlay(analyzedGames);
    if (longshotParlay) parlays.push(longshotParlay);
  }

  return parlays;
}

function buildLockParlay(games: AnalyzedGame[]): ParlayRecommendation | null {
  const highConfidence = games
    .filter(g => g.analysis.confidence === 'high')
    .sort((a, b) => b.analysis.differential - a.analysis.differential);

  if (highConfidence.length < 2) return null;

  const selected = highConfidence.slice(0, 3);
  const picks = selected.map(g => toPick(g));

  return {
    id: 'lock',
    category: 'lock',
    title: 'Lock of the Day',
    subtitle: `${picks.length} legs • High confidence`,
    picks,
    icon: '🔒',
  };
}

function buildValueParlay(games: AnalyzedGame[]): ParlayRecommendation | null {
  const qualified = games
    .filter(g => g.analysis.confidence !== 'low')
    .sort((a, b) => {
      // Sort by differential (edge) descending
      return b.analysis.differential - a.analysis.differential;
    });

  if (qualified.length < 3) return null;

  const selected = qualified.slice(0, 4);
  const picks = selected.map(g => toPick(g));

  return {
    id: 'value',
    category: 'value',
    title: 'Best Value',
    subtitle: `${picks.length} legs • Strong edge`,
    picks,
    icon: '💎',
  };
}

function buildSportParlays(games: AnalyzedGame[]): ParlayRecommendation[] {
  const parlays: ParlayRecommendation[] = [];

  // Group by sport
  const bySport = new Map<string, AnalyzedGame[]>();
  for (const g of games) {
    const sport = g.game.sport;
    if (!bySport.has(sport)) {
      bySport.set(sport, []);
    }
    bySport.get(sport)!.push(g);
  }

  // Sport name mapping
  const sportNames: Record<string, { name: string; icon: string }> = {
    'basketball': { name: 'NBA', icon: '🏀' },
    'football': { name: 'NFL', icon: '🏈' },
    'hockey': { name: 'NHL', icon: '🏒' },
    'baseball': { name: 'MLB', icon: '⚾' },
    'soccer': { name: 'Soccer', icon: '⚽' },
  };

  for (const [sport, sportGames] of bySport) {
    if (sportGames.length < 3) continue;

    const sorted = sportGames
      .filter(g => g.analysis.confidence !== 'low')
      .sort((a, b) => b.analysis.differential - a.analysis.differential);

    if (sorted.length < 3) continue;

    const selected = sorted.slice(0, 5);
    const picks = selected.map(g => toPick(g));
    const info = sportNames[sport] || { name: sport, icon: '🎯' };

    parlays.push({
      id: `sport-${sport}`,
      category: 'sport',
      title: `${info.name} Special`,
      subtitle: `${picks.length} legs • All ${info.name.toLowerCase()}`,
      picks,
      icon: info.icon,
    });
  }

  return parlays;
}

function buildLongshotParlay(games: AnalyzedGame[]): ParlayRecommendation | null {
  // Use medium+ confidence, variety of sports
  const qualified = games
    .filter(g => g.analysis.confidence !== 'low')
    .sort((a, b) => b.analysis.differential - a.analysis.differential);

  if (qualified.length < 5) return null;

  // Try to get variety - different sports
  const selected: AnalyzedGame[] = [];
  const usedSports = new Set<string>();

  // First pass: one per sport
  for (const g of qualified) {
    if (!usedSports.has(g.game.sport) && selected.length < 6) {
      selected.push(g);
      usedSports.add(g.game.sport);
    }
  }

  // Second pass: fill remaining spots
  for (const g of qualified) {
    if (selected.length >= 6) break;
    if (!selected.includes(g)) {
      selected.push(g);
    }
  }

  if (selected.length < 5) return null;

  const picks = selected.map(g => toPick(g));

  return {
    id: 'longshot',
    category: 'longshot',
    title: 'Longshot',
    subtitle: `${picks.length} legs • High risk/reward`,
    picks,
    icon: '🎰',
  };
}

function toPick(ag: AnalyzedGame): Pick {
  return {
    game: ag.game,
    pickType: ag.analysis.pickType,
    label: getAnalyzedPickLabel(ag.game, ag.analysis),
    analysis: ag.analysis,
  };
}
```

**Step 2: Commit**

```bash
git add services/parlayBuilder.ts
git commit -m "feat: add parlay builder service"
```

---

## Task 4: Create Parlays Tab Screen

**Files:**
- Create: `app/(tabs)/parlays.tsx`

**Step 1: Create the screen**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Game, ParlayRecommendation } from '../../types/sports';
import { fetchGames } from '../../services/espn';
import { analyzeGames } from '../../services/analysis';
import { generateParlays } from '../../services/parlayBuilder';
import { DateSelector } from '../../components/DateSelector';
import { ParlayCard } from '../../components/ParlayCard';

export default function Parlays() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [parlays, setParlays] = useState<ParlayRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gameCount, setGameCount] = useState(0);
  const [analyzingCount, setAnalyzingCount] = useState(0);

  const loadParlays = useCallback(async () => {
    // Fetch all games
    const games = await fetchGames('all', selectedDate);
    setGameCount(games.length);

    if (games.length === 0) {
      setParlays([]);
      return;
    }

    setAnalyzingCount(games.length);

    // Analyze all games
    const analyses = await analyzeGames(games);

    // Generate parlays
    const recommendations = generateParlays(games, analyses);
    setParlays(recommendations);
  }, [selectedDate]);

  useEffect(() => {
    setLoading(true);
    setAnalyzingCount(0);
    loadParlays().finally(() => setLoading(false));
  }, [loadParlays]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadParlays();
    setRefreshing(false);
  };

  const handleViewParlay = (parlay: ParlayRecommendation) => {
    router.push({
      pathname: '/betslip',
      params: { picks: JSON.stringify(parlay.picks) },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          {analyzingCount > 0 && (
            <Text style={styles.loadingText}>Analyzing {analyzingCount} games...</Text>
          )}
        </View>
      ) : gameCount === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No games on this date</Text>
        </View>
      ) : parlays.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Not enough data to build parlays</Text>
          <Text style={styles.emptySubtext}>{gameCount} games found, but need more high-confidence picks</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <Text style={styles.headerText}>
            {parlays.length} parlay{parlays.length !== 1 ? 's' : ''} from {gameCount} games
          </Text>
          {parlays.map((parlay) => (
            <ParlayCard
              key={parlay.id}
              parlay={parlay}
              onView={() => handleViewParlay(parlay)}
            />
          ))}
        </ScrollView>
      )}
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
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  headerText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
  },
});
```

**Step 2: Commit**

```bash
git add app/\(tabs\)/parlays.tsx
git commit -m "feat: add Parlays tab screen"
```

---

## Task 5: Add Parlays Tab to Navigation

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

**Step 1: Add the tab**

Replace the entire file:

```typescript
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
          title: 'RTP',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="dice" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sports"
        options={{
          title: 'Sports',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="football" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="parlays"
        options={{
          title: 'Parlays',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="layers" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

**Step 2: Commit**

```bash
git add app/\(tabs\)/_layout.tsx
git commit -m "feat: add Parlays tab to navigation"
```

---

## Task 6: TypeScript Check & Final Commit

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve any TypeScript issues"
```

---

## Task 7: Manual Testing

**Step 1: Start the app**

```bash
npx expo start
```

**Step 2: Test checklist**

- [ ] Parlays tab appears in bottom navigation
- [ ] Date selector works (change dates, tap to go to today)
- [ ] Loading state shows "Analyzing X games..."
- [ ] Parlay cards display with correct categories
- [ ] Tapping "View" opens betslip with picks
- [ ] Empty state shows when no games
- [ ] Pull to refresh works
