import {
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppColors, cardShadow, cardShadowSm } from '@/constants/colors';
import { Icon, IconName } from '@/components/icon';
import { Text } from '@/components/typography';
import { i18n } from '@/i18n';
import { localeStore } from '@/state/localeStore';
import { Space, Radius, Font, Weight } from '@/constants/tokens';

// ── Section card ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  icon: IconName;
  title: string;
  children: React.ReactNode;
  bgColor?: string;
}

function SectionCard({ icon, title, children, bgColor }: SectionCardProps) {
  return (
    <View style={[sectionStyles.card, bgColor ? { backgroundColor: bgColor } : null]}>
      <View style={sectionStyles.header}>
        <Icon name={icon} size={20} color={AppColors.accent} strokeWidth={2.1} />
        <Text style={sectionStyles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.xl,
    ...cardShadowSm,
    gap: 0,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.lg },
  icon: { fontSize: Font.h2 },
  title: { flex: 1, fontSize: Font.h4, fontWeight: Weight.bold, color: AppColors.navy },
});

// ── Formula box ───────────────────────────────────────────────────────────────

interface FormulaBoxProps {
  title: string;
  children: React.ReactNode;
}

function FormulaBox({ title, children }: FormulaBoxProps) {
  return (
    <View style={formulaStyles.box}>
      <Text style={formulaStyles.title}>{title}</Text>
      <View style={formulaStyles.content}>{children}</View>
    </View>
  );
}

const formulaStyles = StyleSheet.create({
  box: {
    backgroundColor: '#F5F4FC',
    borderRadius: Radius.md,
    padding: Space.lg,
    marginBottom: Space.sm,
  },
  title: { fontSize: Font.bodySm, fontWeight: Weight.semibold, color: AppColors.accent, marginBottom: Space.sm },
  content: { gap: Space.xs },
});

// ── Law box ───────────────────────────────────────────────────────────────────

interface LawBoxProps {
  title: string;
  detail: string;
  titleColor: string;
  borderColor: string;
  bgColor: string;
}

function LawBox({ title, detail, titleColor, borderColor, bgColor }: LawBoxProps) {
  return (
    <View style={[lawStyles.box, { backgroundColor: bgColor, borderColor }]}>
      <Text style={[lawStyles.title, { color: titleColor }]}>{title}</Text>
      <Text style={lawStyles.detail}>{detail}</Text>
    </View>
  );
}

const lawStyles = StyleSheet.create({
  box: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    padding: Space.lg,
    marginBottom: Space.sm,
    gap: Space.sm,
  },
  title: { fontSize: Font.body, fontWeight: Weight.bold },
  detail: { fontSize: Font.bodySm, color: AppColors.navy, lineHeight: 18 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function InfoScreen() {
  const router = useRouter();
  const locale = localeStore(s => s.locale);
  void locale;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="close" size={22} color={AppColors.sub} />
        </TouchableOpacity>
        <Text style={styles.appTitle}>{i18n.t('infoScreenTitle')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card 1: Calculation method */}
        <SectionCard icon="height" title={i18n.t('infoCard1Title')}>
          <Text style={styles.introText}>{i18n.t('infoCard1Intro')}</Text>
          <View style={{ height: 12 }} />

          <FormulaBox title={i18n.t('infoFormula1Title')}>
            <Text style={styles.monoText}>{i18n.t('infoFormula1')}</Text>
            <Text style={styles.descText}>{i18n.t('infoFormula1Desc')}</Text>
          </FormulaBox>

          <FormulaBox title={i18n.t('infoFormula2Title')}>
            <Text style={styles.monoText}>{i18n.t('infoFormula2')}</Text>
            <Text style={styles.descText}>{i18n.t('infoFormula2Desc')}</Text>
          </FormulaBox>

          <FormulaBox title={i18n.t('infoFormula3Title')}>
            <Text style={styles.monoText}>{i18n.t('infoFormula3Desc')}</Text>
            <Text style={styles.descText}>{i18n.t('infoFormula3Desc2')}</Text>
          </FormulaBox>

          <FormulaBox title={i18n.t('infoFormula4Title')}>
            <Text style={styles.monoSmText}>{i18n.t('infoFormula4Male')}</Text>
            <Text style={styles.monoSmText}>{i18n.t('infoFormula4Female')}</Text>
            <Text style={[styles.monoSmText, { fontWeight: Weight.semibold }]}>{i18n.t('infoFormula4R')}</Text>
            <Text style={styles.descText}>{i18n.t('infoFormula4Desc')}</Text>
          </FormulaBox>
        </SectionCard>

        {/* Card 2: Law */}
        <SectionCard icon="weight" title={i18n.t('infoCard2Title')}>
          <Text style={styles.subtitleText}>{i18n.t('infoCard2Subtitle')}</Text>
          <View style={{ height: 12 }} />

          <LawBox
            title={i18n.t('infoLaw1Title')}
            detail={i18n.t('infoLaw1Detail')}
            titleColor="#7A4800"
            borderColor="#FF9500"
            bgColor="#FFF8F0"
          />
          <LawBox
            title={i18n.t('infoLaw2Title')}
            detail={i18n.t('infoLaw2Detail')}
            titleColor="#8B1A1A"
            borderColor="#FF3B30"
            bgColor="#FFF0EF"
          />
          <LawBox
            title={i18n.t('infoLaw3Title')}
            detail={i18n.t('infoLaw3Detail')}
            titleColor={AppColors.navy}
            borderColor="#AEA9D2"
            bgColor="#F5F4FC"
          />
          <Text style={styles.footnoteText}>{i18n.t('infoLawFootnote')}</Text>
        </SectionCard>

        {/* Card 3: Breastfeeding */}
        <SectionCard icon="safe" title={i18n.t('infoCard3Title')} bgColor="#EFF6FF">
          <Text style={[styles.introText, { color: '#1A4E8C' }]}>
            {i18n.t('infoCard3Content')}
          </Text>
        </SectionCard>

        {/* Card 4: Disclaimer */}
        <SectionCard icon="warning" title={i18n.t('infoCard4Title')} bgColor="#F0EEFF">
          <Text style={styles.introText}>{i18n.t('infoCard4Content')}</Text>
        </SectionCard>

        {/* Close button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.closeBtnText}>{i18n.t('formulaDialogClose')}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    justifyContent: 'space-between',
  },
  backBtn: { fontSize: Font.h3, color: AppColors.sub, fontWeight: Weight.semibold, width: 32 },
  appTitle: {
    fontSize: Font.h3,
    fontWeight: Weight.bold,
    color: AppColors.navy,
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.xs,
    paddingBottom: Space.xxxl,
    gap: Space.lg,
  },
  introText: {
    fontSize: Font.body,
    color: AppColors.navy,
    lineHeight: 21,
  },
  subtitleText: {
    fontSize: Font.caption,
    color: AppColors.sub,
    fontWeight: Weight.regular,
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: Font.bodySm,
    color: AppColors.navy,
    fontWeight: Weight.regular,
  },
  monoSmText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: Font.caption,
    color: AppColors.navy,
  },
  descText: {
    fontSize: Font.caption,
    color: AppColors.sub,
  },
  footnoteText: {
    fontSize: Font.micro,
    color: AppColors.sub,
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: Space.xs,
  },
  closeBtn: {
    alignSelf: 'center',
    width: 220,
    backgroundColor: AppColors.accent,
    borderRadius: Radius.md,
    paddingVertical: Space.lg,
    alignItems: 'center',
    ...cardShadow,
    shadowOpacity: 0.20,
  },
  closeBtnText: { color: '#fff', fontWeight: Weight.bold, fontSize: Font.body },
});
