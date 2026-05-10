import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  StyleSheet,
} from 'react-native';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { container: object; text: object }> = {
  primary: {
    container: { backgroundColor: '#00C853', borderWidth: 0 },
    text: { color: '#FFFFFF' },
  },
  outline: {
    container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#00C853' },
    text: { color: '#00C853' },
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderWidth: 0 },
    text: { color: '#00C853' },
  },
  danger: {
    container: { backgroundColor: '#EF4444', borderWidth: 0 },
    text: { color: '#FFFFFF' },
  },
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
}) => {
  const { container, text } = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        container,
        isDisabled && styles.disabled,
        fullWidth && styles.fullWidth,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? '#00C853' : '#FFFFFF'}
          size="small"
        />
      ) : (
        <View style={styles.inner}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={[styles.label, text]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  inner: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { marginRight: 8 },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
});
