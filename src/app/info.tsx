import {
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppColors, StatusColors, cardShadowSm } from '@/constants/colors';
import { Icon, IconName } from '@/components/icon';
import { Text } from '@/components/typography';
import { PrimaryButton } from '@/components/primary-button';
import { SectionTitle } from '@/components/section-title';
import { i18n } from '@/i18n';
import { localeStore } from '@/state/localeStore';
import { Font, IconSize, LineHeight, Radius, Space, Weight } from '@/constants/tokens';

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
      <SectionTitle icon={icon}>{title}</SectionTitle>
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
    backgroundColor: AppColors.panel,
    borderRadius: Radius.lg,
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
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.lg,
    marginBottom: Space.sm,
    gap: Space.sm,
  },
  title: { fontSize: Font.body, fontWeight: Weight.bold },
  detail: { fontSize: Font.bodySm, color: AppColors.navy, lineHeight: LineHeight.bodySm },
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
        {/* 좌우 폭이 같아야 가운데 타이틀이 실제로 가운데 온다 */}
        <TouchableOpacity
          style={styles.appBarSide}
          onPress={() => router.back()}
          hitSlop={{ top: Space.sm, bottom: Space.sm, left: Space.sm, right: Space.sm }}
        >
          <Icon name="close" size={IconSize.lg} color={AppColors.sub} />
        </TouchableOpacity>
        <Text style={styles.appTitle}>{i18n.t('infoScreenTitle')}</Text>
        <View style={styles.appBarSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card 1: Calculation method */}
        <SectionCard icon="height" title={i18n.t('infoCard1Title')}>
          <Text style={styles.introText}>{i18n.t('infoCard1Intro')}</Text>
          <View style={{ height: Space.md }} />

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
          <View style={{ height: Space.md }} />

          <LawBox
            title={i18n.t('infoLaw1Title')}
            detail={i18n.t('infoLaw1Detail')}
            titleColor={StatusColors.cautionText}
            borderColor={StatusColors.caution}
            bgColor={StatusColors.cautionBg}
          />
          <LawBox
            title={i18n.t('infoLaw2Title')}
            detail={i18n.t('infoLaw2Detail')}
            titleColor={StatusColors.dangerText}
            borderColor={StatusColors.danger}
            bgColor={StatusColors.dangerBg}
          />
          <LawBox
            title={i18n.t('infoLaw3Title')}
            detail={i18n.t('infoLaw3Detail')}
            titleColor={AppColors.navy}
            borderColor={AppColors.borderStrong}
            bgColor={AppColors.panel}
          />
          <Text style={styles.footnoteText}>{i18n.t('infoLawFootnote')}</Text>
        </SectionCard>

        {/* Card 3: Breastfeeding */}
        <SectionCard icon="safe" title={i18n.t('infoCard3Title')} bgColor={StatusColors.infoCardBg}>
          <Text style={[styles.introText, { color: StatusColors.infoCardText }]}>
            {i18n.t('infoCard3Content')}
          </Text>
        </SectionCard>

        {/* Card 4: Disclaimer */}
        <SectionCard icon="warning" title={i18n.t('infoCard4Title')} bgColor={AppColors.chipBg}>
          <Text style={styles.introText}>{i18n.t('infoCard4Content')}</Text>
        </SectionCard>

        {/* Close button */}
        <PrimaryButton label={i18n.t('formulaDialogClose')} onPress={() => router.back()} />

        <View style={{ height: Space.xxxl }} />
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
  appBarSide: { width: Space.xxxl, alignItems: 'flex-start' },
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
    lineHeight: LineHeight.body,
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
    lineHeight: LineHeight.micro,
    marginTop: Space.xs,
  },
});
