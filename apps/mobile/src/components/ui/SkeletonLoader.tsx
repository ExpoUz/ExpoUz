import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
type SkeletonVariant = 'card' | 'list' | 'profile';

export const SkeletonLoader: React.FC<{ variant?: SkeletonVariant; count?: number }> = ({ variant = 'card', count = 3 }) => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: true })).start();
  }, [shimmer]);
  const translateX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });
  const Shine = () => (
    <Animated.View style={[StyleSheet.absoluteFill, styles.shine, { transform: [{ translateX }] }]} />
  );
  if (variant === 'card') return (
    <>{Array.from({ length: count }).map((_, i) => (
      <View key={i} style={styles.card}><Shine /><View style={styles.cardImg} /><View style={styles.cardBody}><View style={[styles.line, { width: '70%' }]} /><View style={[styles.line, { width: '50%' }]} /><View style={[styles.line, { width: '40%' }]} /></View></View>
    ))}</>
  );
  if (variant === 'list') return (
    <>{Array.from({ length: count }).map((_, i) => (
      <View key={i} style={styles.listItem}><Shine /><View style={styles.avatar} /><View style={{ flex: 1 }}><View style={[styles.line, { width: '60%' }]} /><View style={[styles.line, { width: '40%' }]} /></View></View>
    ))}</>
  );
  return (
    <View style={styles.profile}><Shine /><View style={styles.profileAvatar} /><View style={[styles.line, { width: '50%', alignSelf: 'center' }]} /><View style={[styles.line, { width: '35%', alignSelf: 'center' }]} /></View>
  );
};

const styles = StyleSheet.create({
  shine: { backgroundColor: 'rgba(255,255,255,0.07)' },
  card: { backgroundColor: '#1E1E1E', borderRadius: 16, marginHorizontal: 16, marginVertical: 6, overflow: 'hidden' },
  cardImg: { height: 140, backgroundColor: '#2A2A2A' },
  cardBody: { padding: 12 },
  line: { height: 12, backgroundColor: '#2A2A2A', borderRadius: 6, marginBottom: 8 },
  listItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#1E1E1E', marginBottom: 1, overflow: 'hidden' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2A2A2A', marginRight: 12 },
  profile: { alignItems: 'center', padding: 24, backgroundColor: '#1E1E1E', overflow: 'hidden' },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2A2A2A', marginBottom: 12 },
});
