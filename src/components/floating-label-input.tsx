import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  TextInputProps,
  View,
} from 'react-native';
import { AppColors } from '@/constants/colors';
import { Text, TextInput } from '@/components/typography';

interface FloatingLabelInputProps extends Omit<TextInputProps, 'placeholder'> {
  label: string;
  error?: string | null;
}

/**
 * Flutter의 OutlineInputBorder + labelText를 재현한 입력 필드.
 * 비어 있으면 라벨이 placeholder 위치에, 포커스/입력 시 테두리 위로 떠오른다.
 */
export function FloatingLabelInput({
  label,
  error,
  value,
  onFocus,
  onBlur,
  style,
  ...rest
}: FloatingLabelInputProps) {
  const [focused, setFocused] = useState(false);
  const floated = focused || !!(value && value.length > 0);
  const anim = useRef(new Animated.Value(floated ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: floated ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [floated, anim]);

  const labelTop = anim.interpolate({ inputRange: [0, 1], outputRange: [15, -9] });
  const labelSize = anim.interpolate({ inputRange: [0, 1], outputRange: [15, 12] });

  const borderColor = error
    ? '#D93025'
    : focused
      ? AppColors.accent
      : '#D6D2F0';

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          { borderColor, borderWidth: focused || error ? 2 : 1 },
        ]}
      >
        <Animated.Text
          style={[
            styles.label,
            {
              top: labelTop,
              fontSize: labelSize,
              color: error ? '#D93025' : focused ? AppColors.accent : AppColors.sub,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
        <TextInput
          {...rest}
          value={value}
          style={[styles.input, style]}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  container: {
    borderRadius: 14,
    backgroundColor: AppColors.cardBg,
    paddingHorizontal: 14,
    height: 52,
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    left: 12,
    paddingHorizontal: 4,
    backgroundColor: AppColors.cardBg,
    zIndex: 1,
  },
  input: {
    fontSize: 15,
    color: AppColors.navy,
    paddingVertical: 0,
  },
  errorText: {
    color: '#D93025',
    fontSize: 11,
    marginTop: 4,
    marginLeft: 6,
  },
});
