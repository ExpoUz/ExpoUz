import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { IUserPublic } from '@fubles-uz/shared';

export type AvatarSize = 'sm' | 'md' | 'lg';

const SIZES: Record<AvatarSize, number> = { sm: 32, md: 48, lg: 72 };
const ELO_FONT: Record<AvatarSize, number> = { sm: 8, md: 10, lg: 13 };

interface PlayerAvatarProps {
  user: IUserPublic;
  size?: AvatarSize;
  showElo?: boolean;
  showCrown?: boolean;
}

function reliabilityColor(elo: number): string {
  if (elo >= 1200) return '#00C853';
  if (elo >= 1000) return '#F59E0B';
  return '#EF4444';
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  user,
  size = 'md',
  showElo = false,
  showCrown = false,
}) => {
  const dim = SIZES[size];
  const ringColor = reliabilityColor(user.eloRating);

  return (
    <View style={[styles.wrapper, { width: dim, height: dim }]}>
      {/* Reliability ring */}
      <View
        style={[
          styles.ring,
          {
            width: dim + 4,
            height: dim + 4,
            borderRadius: (dim + 4) / 2,
            borderColor: ringColor,
            top: -2,
            left: -2,
          },
        ]}
      />

      {/* Avatar */}
      {user.avatarUrl ? (
        <Image
          source={{ uri: user.avatarUrl }}
          style={[styles.avatar, { width: dim, height: dim, borderRadius: dim / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: '#2D5A3F' },
          ]}
        >
          <Text style={[styles.initialsText, { fontSize: dim * 0.35 }]}>{initials(user.name)}</Text>
        </View>
      )}

      {/* ELO badge */}
      {showElo && (
        <View style={[styles.eloBadge, { bottom: -4 }]}>
          <Text style={[styles.eloText, { fontSize: ELO_FONT[size] }]}>{user.eloRating}</Text>
        </View>
      )}

      {/* Crown for host */}
      {showCrown && (
        <View style={styles.crown}>
          <Text style={{ fontSize: dim * 0.3 }}>👑</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2.5, zIndex: 0 },
  avatar: {},
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: '#00C853', fontWeight: '700' },
  eloBadge: {
    position: 'absolute',
    backgroundColor: '#1A3A2E',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#00C853',
  },
  eloText: { color: '#00C853', fontWeight: '700' },
  crown: { position: 'absolute', top: -8, alignSelf: 'center' },
});
