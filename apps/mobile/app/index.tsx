import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { useAuthStore } from '@/store/auth.store';
import { useAppStore } from '@/store/app.store';
import { Button } from '@/components/ui/Button';

const { width } = Dimensions.get('window');

const ONBOARDING = [
  { emoji: '⚽', title: 'Find Your Game', body: 'Browse open matches near you and join in seconds.' },
  { emoji: '🏟️', title: 'Book a Pitch', body: 'Reserve top-rated pitches across Uzbekistan.' },
  { emoji: '🏆', title: 'Climb the Rankings', body: 'Play, get rated, and improve your ELO.' },
];

export default function IndexScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { language, setLanguage } = useAppStore();
  const [slide, setSlide] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const titleOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  useEffect(() => {
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 800 }));
    taglineOpacity.value = withDelay(700, withTiming(1, { duration: 800 }));
    buttonsOpacity.value = withDelay(1100, withTiming(1, { duration: 600 }));
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/(tabs)/games');
  }, [isLoading, isAuthenticated, router]);

  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value, transform: [{ translateY: (1 - titleOpacity.value) * 30 }] }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const buttonsStyle = useAnimatedStyle(() => ({ opacity: buttonsOpacity.value, transform: [{ translateY: (1 - buttonsOpacity.value) * 20 }] }));

  if (showOnboarding) {
    return (
      <LinearGradient colors={['#1A3A2E', '#0D0D0D']} style={styles.flex}>
        <View style={styles.onboardingWrap}>
          <Text style={styles.onboardEmoji}>{ONBOARDING[slide].emoji}</Text>
          <Text style={styles.onboardTitle}>{ONBOARDING[slide].title}</Text>
          <Text style={styles.onboardBody}>{ONBOARDING[slide].body}</Text>
          <View style={styles.dots}>
            {ONBOARDING.map((_, i) => <View key={i} style={[styles.dot, i === slide && styles.dotActive]} />)}
          </View>
          <View style={styles.onboardButtons}>
            {slide < 2 ? (
              <Button title="Next →" onPress={() => setSlide(s => s + 1)} />
            ) : (
              <Button title="Get Started" onPress={() => setShowOnboarding(false)} />
            )}
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1A3A2E', '#2D5A3F', '#0D0D0D']} locations={[0, 0.4, 1]} style={styles.flex}>
      {/* Language selector */}
      <View style={styles.langRow}>
        {(['uz', 'ru', 'en'] as const).map((l) => (
          <TouchableOpacity key={l} onPress={() => setLanguage(l)} style={[styles.langBtn, language === l && styles.langActive]}>
            <Text style={[styles.langText, language === l && styles.langTextActive]}>{l.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.hero}>
        <Animated.View style={titleStyle}>
          <Text style={styles.logo}>FUBLES UZ</Text>
          <View style={styles.divider} />
        </Animated.View>
        <Animated.Text style={[styles.tagline, taglineStyle]}>
          Your game. Your city. Your pitch.
        </Animated.Text>
      </View>

      <Animated.View style={[styles.buttons, buttonsStyle]}>
        <Button title="Sign In with Phone 📱" onPress={() => router.push('/auth/phone')} variant="primary" />
        <View style={{ height: 12 }} />
        <Button title="Browse as Guest" onPress={() => router.replace('/(tabs)/games')} variant="ghost" />
        <TouchableOpacity onPress={() => setShowOnboarding(true)} style={styles.howLink}>
          <Text style={styles.howText}>How does it work?</Text>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  langRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, paddingTop: 56 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 5, marginLeft: 6, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  langActive: { borderColor: '#00C853', backgroundColor: 'rgba(0,200,83,0.1)' },
  langText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  langTextActive: { color: '#00C853' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { color: '#00C853', fontSize: 64, fontWeight: '900', letterSpacing: 6, textAlign: 'center' },
  divider: { height: 3, backgroundColor: '#00C853', marginHorizontal: 40, marginTop: 8, borderRadius: 2 },
  tagline: { color: '#D1D5DB', fontSize: 16, marginTop: 16, letterSpacing: 0.5, textAlign: 'center' },
  buttons: { padding: 24, paddingBottom: 48 },
  howLink: { alignItems: 'center', marginTop: 16 },
  howText: { color: '#6B7280', fontSize: 13 },
  onboardingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  onboardEmoji: { fontSize: 80, marginBottom: 24 },
  onboardTitle: { color: '#FFF', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  onboardBody: { color: '#9CA3AF', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  dots: { flexDirection: 'row', marginTop: 32, marginBottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#374151', marginHorizontal: 4 },
  dotActive: { backgroundColor: '#00C853', width: 24 },
  onboardButtons: { width: '100%' },
});
