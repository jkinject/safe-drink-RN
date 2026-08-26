import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppColors } from '@/constants/colors';
import { Icon } from '@/components/icon';
import { Text } from '@/components/typography';
import { localeStore } from '@/state/localeStore';
import { i18n } from '@/i18n';
import licenseData from '@/constants/licenses.json';
import { Font, IconSize, Space, Weight } from '@/constants/tokens';

/**
 * 오픈소스 라이선스 고지 화면.
 *
 * MIT·BSD·ISC 는 저작권 고지와 라이선스 전문을 배포물에 포함하도록 요구한다.
 * 데이터는 `scripts/generate-licenses.mjs` 가 node_modules 에서 뽑아
 * src/constants/licenses.json 에 넣는다 — 의존성이 바뀌면 다시 돌려야 한다.
 */

interface PackageEntry {
  name: string;
  version: string;
  license: string;
  copyright: string;
}

const packages = licenseData.packages as PackageEntry[];
const licenseTexts = licenseData.licenseTexts as Record<string, string>;

export default function LicensesScreen() {
  const router = useRouter();
  const locale = localeStore(s => s.locale);
  void locale;
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<PackageEntry | null>(null);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of packages) counts.set(p.license, (counts.get(p.license) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, n]) => `${id} ${n}`)
      .join(' · ');
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.appBarSide}
          onPress={() => router.back()}
          hitSlop={{ top: Space.sm, bottom: Space.sm, left: Space.sm, right: Space.sm }}
        >
          <Icon name="close" size={IconSize.lg} color={AppColors.sub} />
        </TouchableOpacity>
        <Text style={styles.appTitle}>{i18n.t('licensesTitle')}</Text>
        <View style={styles.appBarSide} />
      </View>

      <FlatList
        data={packages}
        keyExtractor={item => `${item.name}@${item.version}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        // 700개 가까이 되므로 화면에 보이는 만큼만 그린다
        initialNumToRender={20}
        windowSize={10}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.introText}>{i18n.t('licensesIntro')}</Text>
            <Text style={styles.introMeta}>
              {i18n.t('licensesCount', { n: packages.length })} · {summary}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => setSelected(item)}
          >
            <View style={styles.rowText}>
              <Text style={styles.pkgName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.pkgMeta} numberOfLines={1}>
                {item.version} · {item.license}
              </Text>
            </View>
            <Icon name="chevronRight" size={IconSize.sm} color={AppColors.sub} strokeWidth={2.2} />
          </Pressable>
        )}
      />

      {/* 패키지 하나의 고지 전문 */}
      <Modal
        visible={selected != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
        statusBarTranslucent
      >
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Space.xl + insets.bottom }]}
            onPress={() => {}}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{selected?.name}</Text>
            <Text style={styles.sheetMeta}>
              {selected?.version} · {selected?.license}
            </Text>
            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {!!selected?.copyright && (
                <Text style={styles.copyright}>{selected.copyright}</Text>
              )}
              <Text style={styles.licenseText}>
                {(selected && licenseTexts[selected.license]) ||
                  i18n.t('licensesNoText', { id: selected?.license ?? '' })}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  appBarSide: { width: 40 },
  appTitle: { fontSize: Font.h4, fontWeight: Weight.bold, color: AppColors.navy },
  listContent: { paddingHorizontal: Space.lg, paddingBottom: Space.xxl },
  intro: { paddingVertical: Space.md, gap: Space.xs },
  introText: { fontSize: Font.bodySm, color: AppColors.sub, lineHeight: 20 },
  introMeta: { fontSize: Font.micro, color: AppColors.sub, opacity: 0.8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    marginBottom: Space.xs,
  },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  pkgName: { fontSize: Font.bodySm, color: AppColors.navy, fontWeight: Weight.semibold },
  pkgMeta: { fontSize: Font.micro, color: AppColors.sub },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: AppColors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Space.md,
    paddingHorizontal: Space.xl,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppColors.border,
    marginBottom: Space.lg,
  },
  sheetTitle: { fontSize: Font.h4, fontWeight: Weight.bold, color: AppColors.navy },
  sheetMeta: { fontSize: Font.caption, color: AppColors.sub, marginBottom: Space.md },
  sheetScroll: { flexGrow: 0 },
  copyright: {
    fontSize: Font.caption,
    color: AppColors.navy,
    marginBottom: Space.md,
    fontWeight: Weight.semibold,
  },
  licenseText: {
    fontSize: Font.micro,
    color: AppColors.sub,
    lineHeight: 18,
    marginBottom: Space.lg,
  },
});
