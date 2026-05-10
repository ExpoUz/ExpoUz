import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, G } from 'react-native-svg';

// Simple deterministic QR-like visual (actual QR requires a library)
export const QRDisplay: React.FC<{ value: string; size?: number }> = ({ value, size = 200 }) => {
  const cells = 21;
  const cellSize = size / cells;
  // Generate a deterministic pattern from value
  const grid = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      const idx = (r * cells + c) % value.length;
      return value.charCodeAt(idx) % 2 === 0;
    })
  );
  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFF" />
        <G>
          {grid.map((row, r) =>
            row.map((filled, c) =>
              filled ? <Rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill="#000" /> : null
            )
          )}
        </G>
      </Svg>
      <Text style={styles.value} numberOfLines={1}>{value.substring(0, 16)}…</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderRadius: 16 },
  value: { marginTop: 8, color: '#374151', fontSize: 12, fontFamily: 'monospace' },
});
