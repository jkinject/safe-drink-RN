import { forwardRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  TextProps,
  TextStyle,
} from 'react-native';

/**
 * Pretendard 적용 래퍼.
 *
 * RN 은 한 fontFamily 안에서 weight 를 자동으로 골라주지 않는다 (Android 특히).
 * 그래서 weight 별로 별도 패밀리를 등록하고, style 의 fontWeight 를 읽어
 * 알맞은 패밀리로 바꿔준다. 화면 코드는 기존처럼 fontWeight 만 쓰면 된다.
 *
 * 사용법: `import { Text } from '@/components/typography'` — react-native 의
 * Text 대신 이걸 쓴다.
 */

export const FONTS = {
  regular: 'Pretendard-Regular',
  semiBold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
} as const;

/** fontWeight → Pretendard 패밀리 */
export function familyForWeight(weight: TextStyle['fontWeight']): string {
  switch (weight) {
    case '600':
    case 'semibold':
      return FONTS.semiBold;
    case '700':
    case '800':
    case '900':
    case 'bold':
      return FONTS.bold;
    default:
      return FONTS.regular;
  }
}

/**
 * style 을 평탄화해 fontWeight 에 맞는 fontFamily 를 주입한다.
 *
 * 이때 fontWeight 는 반드시 지운다 — 굵기를 패밀리로 이미 표현했는데
 * fontWeight 까지 남기면 Android 가 가짜 굵게를 덧입혀 실제 렌더 폭이
 * 측정 폭보다 넓어지고, 그만큼 문장 끝이 잘린다.
 */
function withFont(style: TextStyle | TextStyle[] | undefined) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  // 호출부가 fontFamily 를 직접 지정했다면 존중한다
  if (flat.fontFamily) return flat;
  const { fontWeight, ...rest } = flat;
  return { ...rest, fontFamily: familyForWeight(fontWeight) };
}

export const Text = forwardRef<RNText, TextProps>(function Text(
  { style, ...rest },
  ref,
) {
  return <RNText ref={ref} style={withFont(style as TextStyle)} {...rest} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  function TextInput({ style, ...rest }, ref) {
    return (
      <RNTextInput ref={ref} style={withFont(style as TextStyle)} {...rest} />
    );
  },
);
