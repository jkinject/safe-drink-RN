import { StyleSheet, View } from 'react-native';
import { i18n } from '@/i18n';
import { Text } from '@/components/typography';
import { Space, Font } from '@/constants/tokens';
import { StatusColors } from '@/constants/colors';

export function DisclaimerBanner() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{i18n.t('disclaimerText')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: StatusColors.warningBg,
    borderBottomWidth: 1,
    borderBottomColor: StatusColors.warningBorder,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.lg,
  },
  text: {
    fontSize: Font.micro,
    color: StatusColors.warningText,
    textAlign: 'center',
  },
});
