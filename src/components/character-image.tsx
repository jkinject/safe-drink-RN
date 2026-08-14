import { Image, ImageStyle, StyleProp } from 'react-native';
import { Sex } from '@/core/types';

export type CharacterState = 'greeting' | 'drinking' | 'dizzy';

interface Props {
  sex?: Sex | null;
  state?: CharacterState;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

const IMAGES: Record<string, Record<CharacterState, number>> = {
  male: {
    greeting: require('../../assets/images/character/male_greeting.png'),
    drinking: require('../../assets/images/character/male_drinking.png'),
    dizzy: require('../../assets/images/character/male_dizzy.png'),
  },
  female: {
    greeting: require('../../assets/images/character/female_greeting.png'),
    drinking: require('../../assets/images/character/female_drinking.png'),
    dizzy: require('../../assets/images/character/female_dizzy.png'),
  },
};

export function CharacterImage({
  sex = 'male',
  state = 'greeting',
  size = 120,
  style,
}: Props) {
  const sexKey = sex ?? 'male';
  const source = IMAGES[sexKey][state];
  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
