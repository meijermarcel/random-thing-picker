import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Image, Share, Modal, Pressable } from 'react-native';
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
  const [showConfidenceInfo, setShowConfidenceInfo] = useState(false);

  // Check if any picks have analysis with projections
  const hasAnalysis = picks.some(pick => pick.analysis?.projection);

  const handleShare = async () => {
    const pickLines = picks.map((pick) => {
      let line = `${pick.game.awayTeam} @ ${pick.game.homeTeam}`;
      
      if (pick.analysis?.projection) {
        const p = pick.analysis.projection;
        line += `\nProjected: ${pick.game.awayTeam} ${p.awayPoints} - ${pick.game.homeTeam} ${p.homePoints}`;
        line += `\nTotal: ${p.totalPoints} | Margin: ${p.projectedWinner === 'home' ? pick.game.homeTeam : pick.game.awayTeam} by ${Math.abs(p.projectedMargin)}`;
        line += `\nConfidence: ${pick.analysis.confidence}`;
      } else {
        line += `\n→ ${pick.label}`;
      }
      
      return line;
    });
    
    const message = `Game Projections:\n\n${pickLines.join('\n\n')}`;

    try {
      await Share.share({ message });
    } catch (error) {
      // User cancelled or share failed
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{hasAnalysis ? 'Game Projections' : 'Bet Slip'}</Text>
        <Text style={styles.headerSubtitle}>{picks.length} {picks.length === 1 ? 'game' : 'games'}</Text>
      </View>

      <FlatList
        data={picks}
        keyExtractor={(item) => item.game.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const projection = item.analysis?.projection;
          const odds = item.game.odds;
          
          return (
            <View style={styles.pickCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.league}>{item.game.leagueAbbr}</Text>
                {item.analysis && (
                  <TouchableOpacity
                    onPress={() => setShowConfidenceInfo(true)}
                    style={[
                      styles.confidenceBadge,
                      { backgroundColor: getConfidenceColor(item.analysis.confidence) + '20' }
                    ]}
                  >
                    <Ionicons
                      name={getConfidenceIcon(item.analysis.confidence) as any}
                      size={12}
                      color={getConfidenceColor(item.analysis.confidence)}
                    />
                    <Text style={[
                      styles.confidenceBadgeText,
                      { color: getConfidenceColor(item.analysis.confidence) }
                    ]}>
                      {item.analysis.confidence.charAt(0).toUpperCase() + item.analysis.confidence.slice(1)}
                    </Text>
                    <Ionicons name="information-circle-outline" size={12} color={getConfidenceColor(item.analysis.confidence)} />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Projected Score Display */}
              {projection ? (
                <View style={styles.projectionSection}>
                  <View style={styles.scoreRow}>
                    <View style={styles.teamScoreBlock}>
                      {item.game.awayLogo && (
                        <Image source={{ uri: item.game.awayLogo }} style={styles.scoreLogo} />
                      )}
                      <Text style={styles.scoreTeamName}>{item.game.awayTeam}</Text>
                      <Text style={[
                        styles.projectedScore,
                        item.analysis?.pickType !== 'draw' && projection.projectedWinner === 'away' && styles.winningScore
                      ]}>
                        {projection.awayPoints}
                      </Text>
                    </View>
                    <Text style={[styles.vsText, item.analysis?.pickType === 'draw' && styles.drawText]}>
                      {item.analysis?.pickType === 'draw' ? 'DRAW' : 'vs'}
                    </Text>
                    <View style={styles.teamScoreBlock}>
                      {item.game.homeLogo && (
                        <Image source={{ uri: item.game.homeLogo }} style={styles.scoreLogo} />
                      )}
                      <Text style={styles.scoreTeamName}>{item.game.homeTeam}</Text>
                      <Text style={[
                        styles.projectedScore,
                        item.analysis?.pickType !== 'draw' && projection.projectedWinner === 'home' && styles.winningScore
                      ]}>
                        {projection.homePoints}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Projection Summary */}
                  <View style={styles.projectionStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Total</Text>
                      <Text style={styles.statValue}>{projection.totalPoints}</Text>
                      {odds?.overUnder && (
                        <Text style={styles.lineComparison}>
                          Line: {odds.overUnder}
                        </Text>
                      )}
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>{item.analysis?.pickType === 'draw' ? 'Prediction' : 'Margin'}</Text>
                      <Text style={styles.statValue}>
                        {item.analysis?.pickType === 'draw'
                          ? 'Draw'
                          : `${projection.projectedWinner === 'home' ? item.game.homeTeam : item.game.awayTeam} by ${Math.abs(projection.projectedMargin)}`
                        }
                      </Text>
                      {odds?.spread && item.analysis?.pickType !== 'draw' && (
                        <Text style={styles.lineComparison}>
                          Line: {odds.spread > 0 ? '+' : ''}{odds.spread}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ) : (
                <>
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
                  <View style={styles.pickBadge}>
                    <Text style={styles.pickLabel}>{item.label}</Text>
                  </View>
                </>
              )}
              
              {/* Reasoning */}
              {item.analysis && item.analysis.reasoning.length > 0 && (
                <View style={styles.reasoningSection}>
                  {item.analysis.reasoning.map((reason, index) => (
                    <View key={index} style={styles.reasonRow}>
                      <Text style={styles.reasonBullet}>•</Text>
                      <Text style={styles.reasonText}>{reason}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        }}
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
          <TouchableOpacity style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Confidence Explanation Modal */}
      <Modal
        visible={showConfidenceInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfidenceInfo(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowConfidenceInfo(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confidence Levels</Text>
              <TouchableOpacity onPress={() => setShowConfidenceInfo(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalIntro}>
              Confidence is based on how much the analysis factors agree on a pick.
            </Text>

            <View style={styles.confidenceRow}>
              <View style={[styles.confidenceIndicator, { backgroundColor: '#34C759' }]} />
              <View style={styles.confidenceInfo}>
                <Text style={styles.confidenceTitle}>High Confidence</Text>
                <Text style={styles.confidenceDesc}>
                  Score differential {'>'} 15 points. Multiple factors strongly favor one team: better record, home advantage, rest edge, favorable H2H, and/or opponent injuries.
                </Text>
              </View>
            </View>

            <View style={styles.confidenceRow}>
              <View style={[styles.confidenceIndicator, { backgroundColor: '#FF9500' }]} />
              <View style={styles.confidenceInfo}>
                <Text style={styles.confidenceTitle}>Medium Confidence</Text>
                <Text style={styles.confidenceDesc}>
                  Score differential 5-15 points. One team has a clear edge, but some factors are neutral or conflicting.
                </Text>
              </View>
            </View>

            <View style={styles.confidenceRow}>
              <View style={[styles.confidenceIndicator, { backgroundColor: '#FF3B30' }]} />
              <View style={styles.confidenceInfo}>
                <Text style={styles.confidenceTitle}>Low Confidence</Text>
                <Text style={styles.confidenceDesc}>
                  Score differential {'<'} 5 points. Teams are evenly matched. This is essentially a toss-up - proceed with caution.
                </Text>
              </View>
            </View>

            <View style={styles.factorsSection}>
              <Text style={styles.factorsTitle}>Factors Analyzed:</Text>
              <Text style={styles.factorsList}>
                • Advanced stats (20%) - shooting %, efficiency{'\n'}
                • Win percentage (15%){'\n'}
                • Home/away splits (15%){'\n'}
                • Recent form & streaks (15%){'\n'}
                • Rest & schedule (10%){'\n'}
                • Head-to-head history (10%){'\n'}
                • Scoring margin (10%){'\n'}
                • Injuries (5%)
              </Text>
            </View>
          </View>
        </Pressable>
      </Modal>
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
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  pickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  projectionSection: {
    marginTop: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
  },
  teamScoreBlock: {
    flex: 1,
    alignItems: 'center',
  },
  scoreLogo: {
    width: 32,
    height: 32,
    marginBottom: 4,
  },
  scoreTeamName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  projectedScore: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  winningScore: {
    color: '#007AFF',
  },
  vsText: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: '600',
    marginHorizontal: 8,
  },
  drawText: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: '700',
  },
  projectionStats: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  lineComparison: {
    fontSize: 11,
    color: '#007AFF',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 10,
  },
  reasoningSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  modalIntro: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  confidenceRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  confidenceIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  confidenceInfo: {
    flex: 1,
  },
  confidenceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  confidenceDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  factorsSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  factorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  factorsList: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
});
