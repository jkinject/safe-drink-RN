import { StyleSheet, View } from 'react-native';
import { i18n } from '@/i18n';
import { Text } from '@/components/typography';
import { Space, Font } from '@/constants/tokens';

export function DisclaimerBanner() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{i18n.t('disclaimerText')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF8E1',
    borderBottomWidth: 1,
    borderBottomColor: '#FFD97D',
    paddingVertical: Space.sm,
    paddingHorizontal: Space.lg,
  },
  text: {
    fontSize: Font.micro,
    color: '#7A6000',
    textAlign: 'center',
  },
});
