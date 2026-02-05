# Spread Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new "Spread" tab that displays optimized spread picks for games, shown immediately without user interaction.

**Architecture:** New tab reusing existing API and filtering to games with spread odds, displaying V7-optimized spread picks.

**Tech Stack:** React Native, Expo Router, existing API service

---

## Task 1: Create SpreadPickCard Component

**Files:**
- Create: `components/SpreadPickCard.tsx`

**Step 1: Write the component**

```typescript
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SpreadPickCardProps {
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  spreadPick: 'home' | 'away';
  spreadConfidence: 'low' | 'medium' | 'high';
  spread: number;
  projectedMargin: number;
  gameTime: Date;
  league: string;
}

function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high': return '#34C759';
    case 'medium': return '#FF9500';
    case 'low': return '#FF3B30';
    default: return '#FF9500';
  }
}

function formatGameTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function SpreadPickCard({
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  spreadPick,
  spreadConfidence,
  spread,
  projectedMargin,
  gameTime,
  league,
}: SpreadPickCardProps) {
  // Calculate the spread line for the picked team
  const pickTeam = spreadPick === 'home' ? homeTeam : awayTeam;
  const pickLogo = spreadPick === 'home' ? homeLogo : awayLogo;
  const pickSpread = spreadPick === 'home' ? spread : -spread;

  // Calculate cover margin
  const homeMargin = projectedMargin; // positive = home wins by X
  const expectedCover = homeMargin + spread;
  const coverMargin = spreadPick === 'home' ? expectedCover : -expectedCover;

  const confidenceColor = getConfidenceColor(spreadConfidence);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.league}>{league}</Text>
        <Text style={styles.gameTime}>{formatGameTime(gameTime)}</Text>
        <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor + '20' }]}>
          <Text style={[styles.confidenceText, { color: confidenceColor }]}>
            {spreadConfidence.charAt(0).toUpperCase() + spreadConfidence.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.teamsRow}>
        <View style={styles.teamBlock}>
          {awayLogo && <Image source={{ uri: awayLogo }} style={styles.logo} />}
          <Text style={[styles.teamName, spreadPick === 'away' && styles.pickedTeam]}>
            {awayTeam}
          </Text>
        </View>
        <Text style={styles.atSymbol}>@</Text>
        <View style={styles.teamBlock}>
          {homeLogo && <Image source={{ uri: homeLogo }} style={styles.logo} />}
          <Text style={[styles.teamName, spreadPick === 'home' && styles.pickedTeam]}>
            {homeTeam}
          </Text>
        </View>
      </View>

      <View style={styles.pickSection}>
        <Text style={styles.pickLabel}>Take {pickTeam} {pickSpread > 0 ? '+' : ''}{pickSpread.toFixed(1)}</Text>
        {coverMargin > 0 && (
          <Text style={styles.coverMargin}>Covers by {coverMargin.toFixed(1)}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  league: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  gameTime: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  teamBlock: {
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 40,
    height: 40,
    marginBottom: 4,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  pickedTeam: {
    color: '#007AFF',
    fontWeight: '700',
  },
  atSymbol: {
    fontSize: 14,
    color: '#999',
    marginHorizontal: 12,
  },
  pickSection: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  pickLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  coverMargin: {
    fontSize: 13,
    color: '#34C759',
    fontWeight: '600',
    marginTop: 4,
  },
});
```

**Step 2: Verify the component compiles**

Run: `cd /Users/marcelmeijer/Documents/RTP-dev/rtp && npx tsc --noEmit`

---

## Task 2: Create Spread Tab Screen

**Files:**
- Create: `app/(tabs)/spread.tsx`

**Step 1: Write the spread tab**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { fetchGames as fetchGamesFromAPI, APIGameWithPick } from '../../services/api';
import { SportFilter } from '../../components/SportFilter';
import { DateSelector } from '../../components/DateSelector';
import { SpreadPickCard } from '../../components/SpreadPickCard';
import { SportFilter as SportFilterType } from '../../types/sports';

export default function Spread() {
  const [spreadGames, setSpreadGames] = useState<APIGameWithPick[]>([]);
  const [filter, setFilter] = useState<SportFilterType>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGames = useCallback(async () => {
    const sport = filter === 'all' ? undefined : filter;
    const data = await fetchGamesFromAPI(selectedDate, sport);

    // Filter to only games with spread odds AND spread pick
    const withSpreads = data.filter(g =>
      g.game.espn_data?.odds?.spread != null &&
      g.pick?.analysis_factors?.spread_pick != null
    );

    setSpreadGames(withSpreads);
  }, [filter, selectedDate]);

  useEffect(() => {
    setLoading(true);
    loadGames().finally(() => setLoading(false));
  }, [loadGames]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <SportFilter selected={filter} onSelect={setFilter} />
      <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : spreadGames.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No spread picks available</Text>
        </View>
      ) : (
        <FlatList
          data={spreadGames}
          keyExtractor={(item) => item.game.id}
          renderItem={({ item }) => {
            const spread = item.game.espn_data?.odds?.spread || 0;
            const spreadPick = item.pick?.analysis_factors?.spread_pick as 'home' | 'away';
            const spreadConfidence = (item.pick?.analysis_factors?.spread_confidence || 'medium') as 'low' | 'medium' | 'high';
            const projection = item.pick?.analysis_factors?.projection;
            const projectedMargin = projection?.projected_winner === 'home'
              ? projection?.projected_margin || 0
              : -(projection?.projected_margin || 0);

            return (
              <SpreadPickCard
                homeTeam={item.home_team?.name || 'Home'}
                awayTeam={item.away_team?.name || 'Away'}
                homeLogo={item.home_team?.logo_url || undefined}
                awayLogo={item.away_team?.logo_url || undefined}
                spreadPick={spreadPick}
                spreadConfidence={spreadConfidence}
                spread={spread}
                projectedMargin={projectedMargin}
                gameTime={new Date(item.game.scheduled_at)}
                league={item.game.espn_data?.league || item.game.sport}
              />
            );
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
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
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  listContent: {
    paddingVertical: 8,
  },
});
```

---

## Task 3: Add Spread Tab to Navigation

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

**Step 1: Add the Spread tab between Sports and Parlays**

Add this after the Sports tab and before the Parlays tab:

```typescript
<Tabs.Screen
  name="spread"
  options={{
    title: 'Spread',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="analytics-outline" size={size} color={color} />
    ),
  }}
/>
```

---

## Task 4: Test the Implementation

**Step 1: Start the app**

Run: `cd /Users/marcelmeijer/Documents/RTP-dev/rtp && npx expo start`

**Step 2: Verify:**
- [ ] Spread tab appears between Sports and Parlays
- [ ] Games with spreads are displayed
- [ ] Games without spreads are hidden
- [ ] Spread pick shows correct team and line
- [ ] Confidence badge displays correctly
- [ ] Cover margin is calculated correctly
- [ ] Pull-to-refresh works
- [ ] Sport filter works
- [ ] Date selector works

---

## Summary

- **3 tasks** to implement
- Creates 2 new files, modifies 1
- Reuses existing components (SportFilter, DateSelector)
- No backend changes needed (V7 spread picks already in API)
