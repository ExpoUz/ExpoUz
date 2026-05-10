import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { MatchStatus } from '@fubles-uz/shared';

export type BadgeVariant = 'full' | 'hot' | 'indoor' | 'outdoor' | 'skill' | 'status' | 'custom';

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#00C853', FULL: '#FF5252', IN_PROGRESS: '#F59E0B',
  COMPLETED: '#6B7280', CANCELLED: '#EF4444',
};

export const Badge: React.FC<{ label: string; variant?: BadgeVariant; color?: string }> = ({ label, variant = 'custom', color }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  const isHot = variant === 'hot';
  useEffect(() => {
    if (!isHot) return;
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.5, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])).start();
  }, [isHot, pulse]);
  const bg = color ?? (variant === 'status' ? (STATUS_COLORS[label] ?? '#6B7280') : variant === 'full' ? '#FF5252' : variant === 'hot' ? '#F59E0B' : variant === 'indoor' ? '#3B82F6' : variant === 'outdoor' ? '#10B981' : '#374151');
  return (
    <View style={{ position: 'relative' }}>
      {isHot && <Animated.View style={[styles.ring, { borderColor: bg, transform: [{ scale: pulse }] }]} />}
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={styles.text}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  ring: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 10, borderWidth: 1.5, opacity: 0.5 },
});
