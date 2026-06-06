import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Polygon,
  Rect,
  Circle,
  Line,
  Ellipse,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing as ReEasing,
} from 'react-native-reanimated';
import { IMatchPosition, IUserPublic } from '@playwithus/shared';
import { perspectiveProject } from '@playwithus/shared';
import { PlayerAvatar } from './PlayerAvatar';

const { width: SCREEN_W } = Dimensions.get('window');
const PITCH_W = SCREEN_W;
const PITCH_H = SCREEN_W * 1.3;

interface FormationPitchProps {
  formation: string;
  positions: IMatchPosition[];
  onPositionPress: (position: IMatchPosition) => void;
  currentUserId?: string;
}

const STRIPE_COUNT = 10;

export const FormationPitch: React.FC<FormationPitchProps> = ({
  formation,
  positions,
  onPositionPress,
  currentUserId,
}) => {
  // Build perspective trapezoid points
  const topLeft = perspectiveProject(0.05, 0, 1, 1, PITCH_W, PITCH_H);
  const topRight = perspectiveProject(0.95, 0, 1, 1, PITCH_W, PITCH_H);
  const bottomLeft = perspectiveProject(0, 1, 1, 1, PITCH_W, PITCH_H);
  const bottomRight = perspectiveProject(1, 1, 1, 1, PITCH_W, PITCH_H);

  const pitchPoints = `${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`;

  // Center circle
  const center = perspectiveProject(0.5, 0.5, 1, 1, PITCH_W, PITCH_H);

  // Penalty areas
  const penTop = perspectiveProject(0.5, 0.12, 1, 1, PITCH_W, PITCH_H);
  const penBottom = perspectiveProject(0.5, 0.88, 1, 1, PITCH_W, PITCH_H);

  return (
    <View style={styles.container}>
      <Svg width={PITCH_W} height={PITCH_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1A3A2E" />
            <Stop offset="1" stopColor="#2D5A3F" />
          </SvgLinearGradient>
        </Defs>

        {/* Pitch background */}
        <Polygon points={pitchPoints} fill="url(#pitchGrad)" />

        {/* Alternating stripes */}
        {Array.from({ length: STRIPE_COUNT }).map((_, i) => {
          const y0 = i / STRIPE_COUNT;
          const y1 = (i + 1) / STRIPE_COUNT;
          const sl = perspectiveProject(0, y0, 1, 1, PITCH_W, PITCH_H);
          const sr = perspectiveProject(1, y0, 1, 1, PITCH_W, PITCH_H);
          const el = perspectiveProject(0, y1, 1, 1, PITCH_W, PITCH_H);
          const er = perspectiveProject(1, y1, 1, 1, PITCH_W, PITCH_H);
          return i % 2 === 0 ? null : (
            <Polygon
              key={i}
              points={`${sl.x},${sl.y} ${sr.x},${sr.y} ${er.x},${er.y} ${el.x},${el.y}`}
              fill="rgba(0,0,0,0.07)"
            />
          );
        })}

        {/* Outer boundary */}
        <Polygon points={pitchPoints} fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity={0.6} />

        {/* Halfway line */}
        {(() => {
          const hl = perspectiveProject(0, 0.5, 1, 1, PITCH_W, PITCH_H);
          const hr = perspectiveProject(1, 0.5, 1, 1, PITCH_W, PITCH_H);
          return <Line x1={hl.x} y1={hl.y} x2={hr.x} y2={hr.y} stroke="#FFF" strokeWidth={1} strokeOpacity={0.6} />;
        })()}

        {/* Center circle */}
        <Ellipse
          cx={center.x}
          cy={center.y}
          rx={PITCH_W * 0.12}
          ry={PITCH_H * 0.05}
          fill="none"
          stroke="#FFF"
          strokeWidth={1}
          strokeOpacity={0.6}
        />
        <Circle cx={center.x} cy={center.y} r={3} fill="#FFF" fillOpacity={0.8} />

        {/* Top penalty area */}
        {(() => {
          const tl = perspectiveProject(0.25, 0.0, 1, 1, PITCH_W, PITCH_H);
          const tr = perspectiveProject(0.75, 0.0, 1, 1, PITCH_W, PITCH_H);
          const bl = perspectiveProject(0.25, 0.2, 1, 1, PITCH_W, PITCH_H);
          const br = perspectiveProject(0.75, 0.2, 1, 1, PITCH_W, PITCH_H);
          return <Polygon points={`${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`} fill="none" stroke="#FFF" strokeWidth={1} strokeOpacity={0.5} />;
        })()}

        {/* Bottom penalty area */}
        {(() => {
          const tl = perspectiveProject(0.25, 0.8, 1, 1, PITCH_W, PITCH_H);
          const tr = perspectiveProject(0.75, 0.8, 1, 1, PITCH_W, PITCH_H);
          const bl = perspectiveProject(0.25, 1.0, 1, 1, PITCH_W, PITCH_H);
          const br = perspectiveProject(0.75, 1.0, 1, 1, PITCH_W, PITCH_H);
          return <Polygon points={`${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`} fill="none" stroke="#FFF" strokeWidth={1} strokeOpacity={0.5} />;
        })()}

        {/* Top goal */}
        {(() => {
          const gl = perspectiveProject(0.38, 0.0, 1, 1, PITCH_W, PITCH_H);
          const gr = perspectiveProject(0.62, 0.0, 1, 1, PITCH_W, PITCH_H);
          return <Line x1={gl.x} y1={gl.y} x2={gr.x} y2={gr.y} stroke="#00C853" strokeWidth={3} strokeOpacity={0.9} />;
        })()}

        {/* Bottom goal */}
        {(() => {
          const gl = perspectiveProject(0.38, 1.0, 1, 1, PITCH_W, PITCH_H);
          const gr = perspectiveProject(0.62, 1.0, 1, 1, PITCH_W, PITCH_H);
          return <Line x1={gl.x} y1={gl.y} x2={gr.x} y2={gr.y} stroke="#00C853" strokeWidth={3} strokeOpacity={0.9} />;
        })()}
      </Svg>

      {/* Player positions overlay */}
      {positions.map((pos) => (
        <PositionToken
          key={pos.id}
          position={pos}
          onPress={() => onPositionPress(pos)}
          isCurrentUser={pos.userId === currentUserId}
        />
      ))}
    </View>
  );
};

interface PositionTokenProps {
  position: IMatchPosition;
  onPress: () => void;
  isCurrentUser: boolean;
}

const PositionToken: React.FC<PositionTokenProps> = ({ position, onPress, isCurrentUser }) => {
  const pulseAnim = useSharedValue(1);
  const isEmpty = !position.userId;

  useEffect(() => {
    if (!isEmpty) return;
    pulseAnim.value = withRepeat(
      withTiming(1.4, { duration: 900, easing: ReEasing.inOut(ReEasing.ease) }),
      -1,
      true,
    );
  }, [isEmpty, pulseAnim]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: isEmpty ? 0.6 : 1,
  }));

  // Compute screen position from normalised coords
  // Use position.team to determine half
  const nx = position.team === 'HOME'
    ? (position as any).x ?? 0.5
    : 1 - ((position as any).x ?? 0.5);
  const ny = position.team === 'HOME'
    ? (position as any).y ?? 0.5
    : 1 - ((position as any).y ?? 0.5);

  const projected = perspectiveProject(nx, ny, 1, 1, PITCH_W, PITCH_H);
  const scale = projected.scale;
  const avatarSize = Math.round(32 * scale);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.token,
        {
          left: projected.x - avatarSize / 2,
          top: projected.y - avatarSize / 2,
          width: avatarSize,
          height: avatarSize,
        },
      ]}
    >
      <Animated.View style={[styles.tokenInner, animStyle]}>
        {isEmpty ? (
          <View
            style={[
              styles.emptySlot,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                borderColor: isCurrentUser ? '#FFD700' : '#00C853',
              },
            ]}
          >
            <Text style={{ fontSize: avatarSize * 0.35 }}>➕</Text>
          </View>
        ) : position.user ? (
          <View style={{ alignItems: 'center' }}>
            <PlayerAvatar user={position.user} size="sm" />
            <View style={styles.positionLabel}>
              <Text style={styles.positionLabelText}>{position.position}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.emptySlot, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
            <Text style={{ fontSize: 10 }}>⌛</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: PITCH_W,
    height: PITCH_H,
    position: 'relative',
    overflow: 'hidden',
  },
  token: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  tokenInner: { alignItems: 'center' },
  emptySlot: {
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,200,83,0.1)',
  },
  positionLabel: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 3,
    marginTop: 1,
  },
  positionLabelText: { color: '#FFF', fontSize: 8, fontWeight: '700' },
});
