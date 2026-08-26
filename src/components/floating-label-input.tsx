import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  TextInputProps,
  View,
} from 'react-native';
import { AppColors } from '@/constants/colors';
import { Text, TextInput } from '@/components/typography';
import { Space, Radius, Font } from '@/constants/tokens';

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
  const inputRef = useRef<RNTextInput>(null);

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
      {/*
        테두리 상자 전체가 터치 영역이어야 한다.
        TextInput 은 글자 줄 높이(≈20dp)만 차지해서 52dp 상자의 위·아래 절반은
        빈 View 였고, 거기를 누르면 ScrollView 의 keyboardShouldPersistTaps="handled"
        규칙상 "처리되지 않은 탭"이라 키보드가 닫혔다. Pressable 로 감싸 어디를
        눌러도 입력란이 포커스를 잡게 한다.
      */}
      <Pressable
        style={[
          styles.container,
          { borderColor, borderWidth: focused || error ? 2 : 1 },
        ]}
        onPress={() => inputRef.current?.focus()}
        // 상자 자체는 접근성 대상이 아니다 — 안의 TextInput 이 읽힌다
        accessible={false}
      >
        <Animated.Text
          // 라벨은 떠오르기 전에 입력 글자 위에 겹쳐 있다 — 탭을 먹지 않게 한다
          pointerEvents="none"
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
          ref={inputRef}
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
      </Pressable>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Space.md },
  container: {
    borderRadius: Radius.md,
    backgroundColor: AppColors.cardBg,
    paddingHorizontal: Space.lg,
    height: 52,
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    left: 12,
    paddingHorizontal: Space.xs,
    backgroundColor: AppColors.cardBg,
    zIndex: 1,
  },
  input: {
    fontSize: Font.body,
    color: AppColors.navy,
    paddingVertical: 0,
    // 입력란 자체도 상자 높이를 다 차지해야 아무 데나 눌러도 커서가 잡힌다.
    // (Pressable 폴백은 커서를 끝으로 보내지만, 여기를 직접 누르면 그 위치로 간다)
    height: '100%',
    textAlignVertical: 'center', // Android — iOS 는 단일 행이면 알아서 가운데
  },
  errorText: {
    color: '#D93025',
    fontSize: Font.micro,
    marginTop: Space.xs,
    marginLeft: Space.sm,
  },
});
