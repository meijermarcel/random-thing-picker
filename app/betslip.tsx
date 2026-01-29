import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Image, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pick, Confidence } from '../types/sports';

// Helper to get confidence color
function getConfidenceColor(confidence: Confidence): string {
  switch (confidence) {
    case 'high':
      return '#34C759';
    case 'medium':
      return '#FF9500';
    case 'low':
      return '#FF3B30';
  }
}

// Helper to get confidence icon
function getConfidenceIcon(confidence: Confidence): string {
  switch (confidence) {
    case 'high':
      return 'trending-up';
    case 'medium':
      return 'remove';
    case 'low':
      return 'trending-down';
  }
}

export default function BetSlip() {
  const { picks: picksParam } = useLocalSearchParams<{ picks: string }>();
  const picks: Pick[] = picksParam ? JSON.parse(picksParam) : [];
  
  // Check if any picks have analysis
  const hasAnalysis = picks.some(pick => pick.analysis);

  const handleShare = async () => {
    const pickLines = picks.map((pick) => {
      let line = `${pick.game.awayTeam} @ ${pick.game.homeTeam}\n→ ${pick.label}`;
      if (pick.analysis) {
        line += ` (${pick.analysis.confidence} confidence)`;
        if (pick.analysis.reasoning.length > 0) {
          line += `\n  ${pick.analysis.reasoning.join('\n  ')}`;
        }
      }
      return line;
    });
    const parlayText = picks.length > 1 ? `${picks.length}-leg parlay` : 'Straight bet';
    const analysisNote = hasAnalysis ? ' - Analyzed' : '';
    const message = `My Picks (${parlayText}${analysisNote}):\n\n${pickLines.join('\n\n')}`;

    try {
      await Share.share({ message });
    } catch (error) {
      // User cancelled or share failed
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bet Slip</Text>
        <Text style={styles.headerSubtitle}>{picks.length} {picks.length === 1 ? 'pick' : 'picks'}</Text>
      </View>

      <FlatList
        data={picks}
        keyExtractor={(item) => item.game.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.pickCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.league}>{item.game.leagueAbbr}</Text>
              <View style={styles.pickBadge}>
                <Text style={styles.pickLabel}>{item.label}</Text>
              </View>
            </View>
            <View style={styles.teamRow}>
              {item.game.awayLogo && (
                <Image source={{ uri: item.game.awayLogo }} style={styles.logo} />
              )}
              <Text style={styles.teamName}>{item.game.awayTeam}</Text>
            </View>
            <View style={styles.teamRow}>
              {item.game.homeLogo && (
                <Image source={{ uri: item.game.homeLogo }} style={styles.logo} />
              )}
              <Text style={styles.teamName}>{item.game.homeTeam}</Text>
            </View>
            
            {item.analysis && (
              <View style={styles.analysisSection}>
                <View style={styles.confidenceRow}>
                  <Ionicons 
                    name={getConfidenceIcon(item.analysis.confidence) as any}
                    size={16}
                    color={getConfidenceColor(item.analysis.confidence)}
                  />
                  <Text style={[
                    styles.confidenceText,
                    { color: getConfidenceColor(item.analysis.confidence) }
                  ]}>
                    {item.analysis.confidence.charAt(0).toUpperCase() + item.analysis.confidence.slice(1)} Confidence
                  </Text>
                </View>
                {item.analysis.reasoning.map((reason, index) => (
                  <View key={index} style={styles.reasonRow}>
                    <Text style={styles.reasonBullet}>•</Text>
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        ListFooterComponent={() => (
          <View style={styles.footer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryValue}>{picks.length}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.footerRight}>
              <Text style={styles.parlayNote}>
                {picks.length > 1 ? `${picks.length}-leg parlay` : 'Straight'}
              </Text>
              {hasAnalysis && (
                <View style={styles.analyzedBadge}>
                  <Ionicons name="analytics" size={12} color="#007AFF" />
                  <Text style={styles.analyzedText}>Analyzed</Text>
                </View>
              )}
            </View>
          </View>
        )}
      />

      <View style={styles.buttonContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/sports')}>
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  listContent: {
    padding: 12,
  },
  pickCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  league: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  logo: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  teamName: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  pickBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
  },
  pickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  analysisSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reasonRow: {
    flexDirection: 'row',
    paddingLeft: 4,
    marginBottom: 2,
  },
  reasonBullet: {
    fontSize: 12,
    color: '#888',
    marginRight: 6,
  },
  reasonText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  footer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#888',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: '#eee',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  parlayNote: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  analyzedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  analyzedText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  buttonContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  shareButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '700',
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
