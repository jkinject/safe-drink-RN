import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppColors, cardShadow, cardShadowSm } from '@/constants/colors';
import { i18n } from '@/i18n';
import { TimePickerModal } from '@/components/time-picker-sheet';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { Icon } from '@/components/icon';
import {
  DRINK_ICON_NAMES,
  DrinkIcon,
  DrinkIconName,
  resolveDrinkIcon,
} from '@/components/drink-icon';
import { Text } from '@/components/typography';
import { sessionStore } from '@/state/sessionStore';
import { presetsStore } from '@/state/presetsStore';
import { localeStore } from '@/state/localeStore';
import { DrinkPreset } from '@/core/types';
import * as notificationService from '@/services/notifications';
import { Space, Radius, Font, Weight } from '@/constants/tokens';

function formatHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Time picker modal ─────────────────────────────────────────────────────────


const tpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.xxl,
    width: 280,
    gap: Space.lg,
    ...cardShadow,
  },
  title: { fontSize: Font.body, fontWeight: Weight.bold, color: AppColors.navy, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.sm },
  input: {
    width: 72,
    height: 52,
    borderWidth: 2,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    textAlign: 'center',
    fontSize: Font.h2,
    fontWeight: Weight.bold,
    color: AppColors.navy,
  },
  colon: { fontSize: Font.h1, fontWeight: Weight.bold, color: AppColors.navy },
  actions: { flexDirection: 'row', gap: Space.md },
  cancelBtn: {
    flex: 1, paddingVertical: Space.md, alignItems: 'center', borderRadius: Radius.md,
    borderWidth: 1, borderColor: AppColors.border,
  },
  cancelText: { color: AppColors.sub, fontWeight: Weight.semibold },
  confirmBtn: {
    flex: 1, paddingVertical: Space.md, alignItems: 'center', borderRadius: Radius.md,
    backgroundColor: AppColors.accent,
  },
  confirmText: { color: '#fff', fontWeight: Weight.bold },
});

// ── Custom preset dialog ──────────────────────────────────────────────────────

interface PresetDialogProps {
  visible: boolean;
  initial?: DrinkPreset;
  onSave: (preset: DrinkPreset) => void;
  onCancel: () => void;
  title: string;
}

function PresetDialog({ visible, initial, onSave, onCancel, title }: PresetDialogProps) {
  const [icon, setIcon] = useState<DrinkIconName>(
    initial ? resolveDrinkIcon(initial) : 'cup',
  );
  const [name, setName] = useState(initial?.label ?? '');
  const [abv, setAbv] = useState(initial ? String(initial.abvPercent) : '');
  const [vol, setVol] = useState(initial ? String(Math.round(initial.volumeMl)) : '');
  const [nameErr, setNameErr] = useState('');
  const [abvErr, setAbvErr] = useState('');
  const [volErr, setVolErr] = useState('');
  // Android edge-to-edge에선 시트가 내비게이션 바 아래까지 그려져 버튼이 잘린다
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setIcon(initial ? resolveDrinkIcon(initial) : 'cup');
      setName(initial?.label ?? '');
      setAbv(initial ? String(initial.abvPercent) : '');
      setVol(initial ? String(Math.round(initial.volumeMl)) : '');
      setNameErr(''); setAbvErr(''); setVolErr('');
    }
  }, [visible, initial]);

  function validate(): boolean {
    let ok = true;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 20) {
      setNameErr(i18n.t('customPresetNameError')); ok = false;
    } else setNameErr('');
    const a = parseFloat(abv);
    if (isNaN(a) || a <= 0 || a > 100) {
      setAbvErr(i18n.t('customPresetAbvError')); ok = false;
    } else setAbvErr('');
    const v = parseFloat(vol);
    if (isNaN(v) || v <= 0 || v > 2000) {
      setVolErr(i18n.t('customPresetVolumeMaxError')); ok = false;
    } else setVolErr('');
    return ok;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      icon,
      label: name.trim(),
      abvPercent: parseFloat(abv),
      volumeMl: parseFloat(vol),
      isCustom: true,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      {/* Android edge-to-edge에선 adjustResize로 창이 줄지 않으므로
          두 플랫폼 모두 behavior="padding"이 필요하다 (기기 확인 완료) */}
      <KeyboardAvoidingView
        style={dlgStyles.overlay}
        behavior="padding"
        // 키보드가 뜨면 내비게이션 바 인셋만큼은 회피량에서 빼야 여백이 두 번 붙지 않는다
        keyboardVerticalOffset={-insets.bottom}
      >
        <View style={[dlgStyles.container, { paddingBottom: Space.xxl + insets.bottom }]}>
          <Text style={dlgStyles.title}>{title}</Text>
          <ScrollView
            style={dlgStyles.scroll}
            contentContainerStyle={dlgStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* Icon picker */}
            <View style={dlgStyles.iconGrid}>
              {DRINK_ICON_NAMES.map(n => {
                const selected = icon === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[dlgStyles.iconBtn, selected && dlgStyles.iconBtnSelected]}
                    onPress={() => setIcon(n)}
                  >
                    {/* 아이콘 자체가 컬러라 선택 상태는 테두리로만 표시한다 */}
                    <DrinkIcon name={n} size={30} />
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Name */}
            <FloatingLabelInput
              label={i18n.t('customPresetNameLabel')}
              value={name}
              onChangeText={setName}
              maxLength={20}
              error={nameErr || null}
            />
            {/* ABV */}
            <FloatingLabelInput
              label={i18n.t('addDrinkAbvLabel')}
              value={abv}
              onChangeText={setAbv}
              keyboardType="numeric"
              error={abvErr || null}
            />
            {/* Volume */}
            <FloatingLabelInput
              label={i18n.t('addDrinkVolumeLabel')}
              value={vol}
              onChangeText={setVol}
              keyboardType="numeric"
              error={volErr || null}
            />
          </ScrollView>
          {/* Actions — 키보드가 올라와도 항상 보이도록 스크롤 밖에 고정 */}
          <View style={dlgStyles.actions}>
            <TouchableOpacity onPress={onCancel} style={dlgStyles.cancelBtn}>
              <Text style={dlgStyles.cancelText}>{i18n.t('customPresetCancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={dlgStyles.saveBtn}>
              <Text style={dlgStyles.saveText}>{i18n.t('customPresetSave')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const dlgStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: AppColors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Space.xxl,
    gap: Space.sm,
    maxHeight: '85%',
    // 키보드로 공간이 줄면 시트가 같이 줄어들 수 있어야 함
    flexShrink: 1,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { gap: Space.sm, paddingBottom: Space.xs },
  title: { fontSize: Font.h4, fontWeight: Weight.bold, color: AppColors.navy, marginBottom: Space.sm },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginBottom: Space.sm },
  iconBtn: {
    width: 44, height: 44, borderRadius: Radius.xl,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  iconBtnSelected: {
    borderColor: AppColors.accent,
    backgroundColor: AppColors.bg,
  },
  input: {
    borderWidth: 1, borderColor: AppColors.border, borderRadius: Radius.md,
    paddingHorizontal: Space.lg, paddingVertical: Space.md, fontSize: Font.body,
    color: AppColors.navy,
  },
  inputError: { borderColor: '#FF3B30' },
  errorText: { fontSize: Font.micro, color: '#FF3B30', marginTop: -4 },
  actions: { flexDirection: 'row', gap: Space.md, marginTop: Space.sm },
  cancelBtn: {
    flex: 1, paddingVertical: Space.md, alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1, borderColor: AppColors.border,
  },
  cancelText: { color: AppColors.sub, fontWeight: Weight.semibold },
  saveBtn: {
    flex: 1, paddingVertical: Space.md, alignItems: 'center',
    borderRadius: Radius.md, backgroundColor: AppColors.accent,
  },
  saveText: { color: '#fff', fontWeight: Weight.bold },
});

// ── Preset card ───────────────────────────────────────────────────────────────

interface PresetCardProps {
  preset: DrinkPreset;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function PresetCard({ preset, selected, onPress, onLongPress }: PresetCardProps) {
  return (
    <TouchableOpacity
      style={[pcStyles.card, selected && pcStyles.cardSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.8}
    >
      <DrinkIcon name={resolveDrinkIcon(preset)} size={30} />
      <Text style={pcStyles.label} numberOfLines={2}>{preset.label}</Text>
      <Text style={pcStyles.detail}>
        {preset.abvPercent % 1 === 0 ? preset.abvPercent : preset.abvPercent.toFixed(1)}% · {Math.round(preset.volumeMl)}ml
      </Text>
    </TouchableOpacity>
  );
}

const pcStyles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: Space.xs,
    // 같은 줄의 카드끼리 높이를 맞춘다 (추가 카드는 줄 수가 적어 짧아짐)
    flex: 1,
    ...cardShadowSm,
  },
  cardCentered: { justifyContent: 'center' },
  cardSelected: {
    borderColor: AppColors.accent,
    borderWidth: 2,
    backgroundColor: '#EAE8FF',
  },
  label: { fontSize: Font.micro, fontWeight: Weight.semibold, color: AppColors.navy, textAlign: 'center' },
  detail: { fontSize: Font.micro, color: AppColors.sub },
});

// ── Add preset card ───────────────────────────────────────────────────────────

function AddPresetCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[pcStyles.card, pcStyles.cardCentered]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Icon name="add" size={28} color={AppColors.navy} strokeWidth={2.2} />
      <Text style={pcStyles.label}>{i18n.t('customPresetAddCard')}</Text>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AddDrinkScreen() {
  const router = useRouter();
  const { recordId } = useLocalSearchParams<{ recordId?: string }>();
  const locale = localeStore(s => s.locale);
  void locale;

  const records = sessionStore(s => s.records);
  const addRecord = sessionStore(s => s.addRecord);
  const updateRecord = sessionStore(s => s.updateRecord);
  const presets = presetsStore(s => s.presets);
  const savePresets = presetsStore(s => s.save);
  const updatePresetAt = presetsStore(s => s.updateAt);

  const isEdit = !!recordId;
  const editRecord = isEdit
    ? records.find(r => String(r.id) === recordId)
    : undefined;

  // Form state
  const [abvText, setAbvText] = useState(
    editRecord ? String(editRecord.abvPercent) : '',
  );
  const [volText, setVolText] = useState(
    editRecord ? String(Math.round(editRecord.volumeMl)) : '',
  );
  const [consumedAt, setConsumedAt] = useState(
    editRecord?.consumedAt ?? Date.now(),
  );
  // null = 마시는중 (DB 재로드 시 null, 메모리 신규는 undefined이므로 ?? 로 통일)
  const [finishedAt, setFinishedAt] = useState<number | null>(
    editRecord?.finishedAt ?? null,
  );
  const [abvErr, setAbvErr] = useState('');
  const [volErr, setVolErr] = useState('');
  const [timeNotice, setTimeNotice] = useState('');
  const [saving, setSaving] = useState(false);

  // Time picker — 시작/종료 중 어느 쪽을 편집 중인지
  const [timeTarget, setTimeTarget] = useState<'start' | 'end' | null>(null);
  const consumedDate = new Date(consumedAt);
  const finishedDate = finishedAt != null ? new Date(finishedAt) : null;
  const pickerDate = timeTarget === 'end' ? (finishedDate ?? new Date()) : consumedDate;

  // Preset selection
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number | null>(null);
  const [selectedPresetAbv, setSelectedPresetAbv] = useState<number | null>(null);
  const [selectedPresetVol, setSelectedPresetVol] = useState<number | null>(null);
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string | null>(null);

  // Preset dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editPresetIdx, setEditPresetIdx] = useState<number | null>(null);
  const editPreset = editPresetIdx != null ? presets[editPresetIdx] : undefined;

  function effectivePresetLabel(): string | undefined {
    if (!selectedPresetLabel || selectedPresetAbv == null || selectedPresetVol == null) return undefined;
    const a = parseFloat(abvText);
    const v = parseFloat(volText);
    if (isNaN(a) || isNaN(v)) return undefined;
    if (Math.abs(a - selectedPresetAbv) < 0.001 && Math.abs(v - selectedPresetVol) < 0.001) {
      return selectedPresetLabel;
    }
    return undefined;
  }

  function handlePresetTap(idx: number) {
    const preset = presets[idx];
    setSelectedPresetIdx(idx);
    setSelectedPresetAbv(preset.abvPercent);
    setSelectedPresetVol(preset.volumeMl);
    setSelectedPresetLabel(preset.label);
    setAbvText(
      preset.abvPercent % 1 === 0
        ? String(preset.abvPercent)
        : preset.abvPercent.toFixed(1),
    );
    setVolText(String(Math.round(preset.volumeMl)));
    setAbvErr('');
    setVolErr('');
  }

  function handlePresetLongPress(idx: number) {
    const preset = presets[idx];
    Alert.alert(preset.label, undefined, [
      { text: i18n.t('customPresetEdit'), onPress: () => { setEditPresetIdx(idx); setShowEditDialog(true); } },
      {
        text: i18n.t('customPresetDelete'),
        style: 'destructive',
        onPress: () => {
          Alert.alert('', i18n.t('customPresetDeleteConfirm'), [
            { text: i18n.t('customPresetCancel'), style: 'cancel' },
            {
              text: i18n.t('customPresetDelete'),
              style: 'destructive',
              onPress: async () => {
                const newList = presets.filter((_, i) => i !== idx);
                await savePresets(newList);
                if (selectedPresetIdx === idx) setSelectedPresetIdx(null);
              },
            },
          ]);
        },
      },
      { text: i18n.t('customPresetCancel'), style: 'cancel' },
    ]);
  }

  async function handleAddPreset(preset: DrinkPreset) {
    const newList = [...presets, preset];
    await savePresets(newList);
    setShowAddDialog(false);
  }

  async function handleEditPreset(preset: DrinkPreset) {
    if (editPresetIdx == null) return;
    await updatePresetAt(editPresetIdx, preset);
    setShowEditDialog(false);
    setEditPresetIdx(null);
  }

  function validate(): boolean {
    let ok = true;
    const a = parseFloat(abvText);
    if (isNaN(a) || a <= 0 || a > 100) {
      setAbvErr(i18n.t('addDrinkAbvError')); ok = false;
    } else setAbvErr('');
    const v = parseFloat(volText);
    if (isNaN(v) || v <= 0) {
      setVolErr(i18n.t('addDrinkVolumeError')); ok = false;
    } else setVolErr('');
    return ok;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const abv = parseFloat(abvText);
      const vol = parseFloat(volText);

      if (isEdit && editRecord) {
        await updateRecord({
          ...editRecord,
          consumedAt,
          finishedAt: finishedAt ?? undefined,
          abvPercent: abv,
          volumeMl: vol,
        });
      } else {
        // New record: 10+ min in past → immediately finished
        const now = Date.now();
        const isPast = consumedAt < now - 10 * 60 * 1000;
        const isFirst = records.length === 0;

        await addRecord({
          consumedAt: now,
          abvPercent: abv,
          volumeMl: vol,
          presetLabel: effectivePresetLabel(),
          finishedAt: isPast ? consumedAt : undefined,
        });

        if (isFirst) {
          await notificationService.requestPermissions();
        }
      }

      router.back();
    } finally {
      setSaving(false);
    }
  }

  /** h:m 을 "오늘 그 시각, 미래면 어제" 로 해석한다 (자정 넘긴 음주 대응) */
  function resolveTime(h: number, m: number): number {
    const d = new Date();
    let dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
    if (dt.getTime() > Date.now()) {
      dt = new Date(dt.getTime() - 86400000);
    }
    return dt.getTime();
  }

  /**
   * 시작·종료를 함께 반영한다.
   * 불변식: 종료는 시작보다 빠를 수 없다 — 위반하면 종료를 지우고 마시는중으로 되돌린다.
   */
  function applyTimes(nextStart: number, nextEnd: number | null) {
    setConsumedAt(nextStart);
    if (nextEnd != null && nextEnd < nextStart) {
      setFinishedAt(null);
      setTimeNotice(i18n.t('editRecordEndCleared'));
    } else {
      setFinishedAt(nextEnd);
      setTimeNotice('');
    }
  }

  function handleTimePickerConfirm(h: number, m: number) {
    const target = timeTarget;
    setTimeTarget(null);
    const picked = resolveTime(h, m);
    if (target === 'end') applyTimes(consumedAt, picked);
    else applyTimes(picked, finishedAt);
  }

  const title = isEdit ? i18n.t('editRecordTitle') : i18n.t('addDrinkTitle');
  const submitLabel = isEdit ? i18n.t('editRecordSubmit') : i18n.t('addDrinkSubmit');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="close" size={22} color={AppColors.sub} />
        </TouchableOpacity>
        <Text style={styles.appTitle}>{title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Preset grid (add mode only) */}
        {!isEdit && (
          <>
            <Text style={styles.sectionTitle}>{i18n.t('addDrinkQuickSelect')}</Text>
            <View style={styles.presetGrid}>
              {presets.map((preset, idx) => (
                <View key={idx} style={styles.presetCell}>
                  <PresetCard
                    preset={preset}
                    selected={selectedPresetIdx === idx}
                    onPress={() => handlePresetTap(idx)}
                    onLongPress={() => handlePresetLongPress(idx)}
                  />
                </View>
              ))}
              <View style={styles.presetCell}>
                <AddPresetCard onPress={() => setShowAddDialog(true)} />
              </View>
            </View>
            <View style={styles.divider} />
          </>
        )}

        {/* Manual form */}
        <View style={styles.formCard}>
          {/* ABV */}
          <FloatingLabelInput
            label={i18n.t('addDrinkAbvLabel')}
            value={abvText}
            onChangeText={v => { setAbvText(v); setAbvErr(''); }}
            keyboardType="numeric"
            error={abvErr || null}
          />

          {/* Volume */}
          <FloatingLabelInput
            label={i18n.t('addDrinkVolumeLabel')}
            value={volText}
            onChangeText={v => { setVolText(v); setVolErr(''); }}
            keyboardType="numeric"
            error={volErr || null}
          />

          {/* Time rows (edit mode only) — 시작·종료를 각각 편집 */}
          {isEdit && (
            <>
              {/* 시작 */}
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>{i18n.t('editRecordStartLabel')}</Text>
                <TouchableOpacity onPress={() => setTimeTarget('start')}>
                  <Text style={styles.timeValue}>{formatHm(consumedDate)}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={styles.nowBtn}
                  onPress={() => applyTimes(Date.now(), finishedAt)}
                >
                  <Icon name="clock" size={13} color={AppColors.accent} strokeWidth={2.2} />
                  <Text style={styles.nowBtnText}>{i18n.t('addDrinkSetNow')}</Text>
                </TouchableOpacity>
              </View>

              {/* 종료 — 마시는중이면 시각이 없고, "현재시간으로"를 누르면 다마심이 된다 */}
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>{i18n.t('editRecordEndLabel')}</Text>
                {finishedDate ? (
                  <TouchableOpacity onPress={() => setTimeTarget('end')}>
                    <Text style={styles.timeValue}>{formatHm(finishedDate)}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.drinkingText}>{i18n.t('drinkingBadge')}</Text>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={styles.nowBtn}
                  onPress={() => applyTimes(consumedAt, Date.now())}
                >
                  <Icon name="clock" size={13} color={AppColors.accent} strokeWidth={2.2} />
                  <Text style={styles.nowBtnText}>{i18n.t('addDrinkSetNow')}</Text>
                </TouchableOpacity>
              </View>

              {/* 상태 되돌리기 — 완료 기록에서만 */}
              {finishedDate && (
                <View style={styles.timeRowRight}>
                  <TouchableOpacity
                    style={styles.revertBtn}
                    onPress={() => { setFinishedAt(null); setTimeNotice(''); }}
                  >
                    <Icon name="restore" size={13} color={AppColors.sub} strokeWidth={2.2} />
                    <Text style={styles.revertBtnText}>{i18n.t('editRecordMarkDrinking')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!!timeNotice && <Text style={styles.timeNoticeText}>{timeNotice}</Text>}
            </>
          )}

          <View style={{ height: 12 }} />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>{submitLabel}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Dialogs */}
      <PresetDialog
        visible={showAddDialog}
        onSave={handleAddPreset}
        onCancel={() => setShowAddDialog(false)}
        title={i18n.t('customPresetAddCard')}
      />
      <PresetDialog
        visible={showEditDialog}
        initial={editPreset}
        onSave={handleEditPreset}
        onCancel={() => { setShowEditDialog(false); setEditPresetIdx(null); }}
        title={i18n.t('customPresetEdit')}
      />
      <TimePickerModal
        title={
          timeTarget === 'end'
            ? i18n.t('editRecordEndLabel')
            : i18n.t('editRecordStartLabel')
        }
        visible={timeTarget != null}
        initialHour={pickerDate.getHours()}
        initialMinute={pickerDate.getMinutes()}
        onConfirm={handleTimePickerConfirm}
        onCancel={() => setTimeTarget(null)}
      />
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
  appTitle: { fontSize: Font.h3, fontWeight: Weight.bold, color: AppColors.navy },
  scrollContent: { padding: Space.lg, gap: Space.md },
  sectionTitle: { fontSize: Font.h3, fontWeight: Weight.bold, color: AppColors.navy },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  presetCell: { width: '31%' },
  divider: { height: 1, backgroundColor: AppColors.border },
  formCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.lg,
    ...cardShadowSm,
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    fontSize: Font.body,
    color: AppColors.navy,
    fontWeight: Weight.regular,
  },
  inputError: { borderColor: '#FF3B30' },
  errorText: { fontSize: Font.micro, color: '#FF3B30', marginTop: Space.xs },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.md,
    gap: Space.sm,
  },
  timeLabel: { fontSize: Font.bodySm, color: AppColors.sub },
  drinkingText: { fontSize: Font.body, fontWeight: Weight.bold, color: AppColors.sub, paddingHorizontal: Space.xs },
  timeRowRight: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Space.sm },
  revertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
  },
  revertBtnText: { fontSize: Font.caption, color: AppColors.sub, fontWeight: Weight.semibold },
  timeNoticeText: { fontSize: Font.micro, color: AppColors.sub, marginTop: Space.sm },
  timeValue: {
    fontSize: Font.body,
    fontWeight: Weight.bold,
    color: AppColors.accent,
    paddingHorizontal: Space.xs,
  },
  nowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    backgroundColor: AppColors.bg,
    borderRadius: Radius.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
  },
  nowBtnText: { fontSize: Font.caption, color: AppColors.accent, fontWeight: Weight.semibold },
  submitBtn: {
    backgroundColor: AppColors.accent,
    borderRadius: Radius.md,
    paddingVertical: Space.lg,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: Weight.bold, fontSize: Font.body },
});
