import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { IMatch, MatchStatus } from '@expouz/shared';
import { formatUZS } from '@expouz/shared';
import { Badge } from './Badge';

interface MatchCardProps {
  match: IMatch & { pitchImageUrl?: string; pitchName?: string };
  onPress: () => void;
  onLongPress?: () => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onPress, onLongPress }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fillRatio = match.maxPlayers > 0 ? match.currentPlayers / match.maxPlayers : 0;
  const isHot = fillRatio >= 0.8 && match.status === MatchStatus.OPEN;
  const isFull = match.status === MatchStatus.FULL;
  const isCancelled = match.status === MatchStatus.CANCELLED;

  useEffect(() => {
    if (!isHot) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isHot, pulseAnim]);

  const scheduledDate = new Date((match as any).startTime ?? match.scheduledAt);
  const timeStr = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = scheduledDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
      style={[styles.card, isCancelled && styles.cancelled]}
    >
      {/* Hero image */}
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: match.pitchImageUrl ?? 'https://placehold.co/400x200/1A3A2E/00C853?text=Pitch' }}
          style={styles.image}
          resizeMode="cover"
        />
        {isFull && (
          <View style={styles.fullOverlay}>
            <Text style={styles.fullText}>FULL</Text>
          </View>
        )}
        {isHot && (
          <View style={styles.hotBadge}>
            <Animated.View style={[styles.hotPulse, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.hotText}>🔥 HOT</Text>
          </View>
        )}
        <View style={styles.sportBadge}>
          <Text style={styles.sportText}>{match.sport}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, isCancelled && styles.strikethrough]} numberOfLines={1}>
          {match.title}
        </Text>

        <View style={styles.row}>
          <Text style={styles.meta}>📅 {dateStr} · {timeStr}</Text>
          <Badge label={match.status} variant="status" />
        </View>

        <View style={styles.row}>
          <Text style={styles.meta}>⏱ {match.durationMinutes}min</Text>
          <Text style={styles.meta}>{match.city}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.players}>
            <Text style={styles.playerCount}>
              👥 {match.currentPlayers}/{match.maxPlayers}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(fillRatio * 100, 100)}%` as any },
                  isFull && { backgroundColor: '#FF5252' },
                  isHot && { backgroundColor: '#F59E0B' },
                ]}
              />
            </View>
          </View>
          <Text style={styles.price}>{formatUZS(match.pricePerPlayer)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  cancelled: { opacity: 0.5 },
  imageWrap: { height: 140, position: 'relative' },
  image: { width: '100%', height: '100%' },
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,82,82,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullText: { color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: 4 },
  hotBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#F59E0B',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hotPulse: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    opacity: 0.4,
  },
  hotText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  sportBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sportText: { color: '#00C853', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  content: { padding: 12 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  strikethrough: { textDecorationLine: 'line-through', color: '#888' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  meta: { color: '#9CA3AF', fontSize: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  players: { flex: 1, marginRight: 12 },
  playerCount: { color: '#D1D5DB', fontSize: 12, marginBottom: 4 },
  progressBar: { height: 4, backgroundColor: '#374151', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#00C853', borderRadius: 2 },
  price: { color: '#00C853', fontSize: 14, fontWeight: '700' },
});
