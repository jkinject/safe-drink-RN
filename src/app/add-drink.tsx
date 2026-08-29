import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { AppColors, cardShadow, cardShadowSm, dialogShadow } from '@/constants/colors';
import { i18n } from '@/i18n';
import { TimePickerModal } from '@/components/time-picker-sheet';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { Icon } from '@/components/icon';
import { actionSheet, confirm } from '@/components/dialog';
import {
  DrinkIcon,
  DrinkIconName,
  isDrinkIconName,
  resolveDrinkIcon,
} from '@/components/drink-icon';
import { DrinkIconPicker } from '@/components/drink-icon-picker';
import { DrinkIconSelect } from '@/components/drink-icon-select';
import { Text } from '@/components/typography';
import { sessionStore } from '@/state/sessionStore';
import { presetsStore } from '@/state/presetsStore';
import { localeStore } from '@/state/localeStore';
import { DrinkPreset, DrinkRecord } from '@/core/types';
import { estimatedSoberAt } from '@/core/bacCalculator';
import { profileStore } from '@/state/profileStore';
import * as notificationService from '@/services/notifications';
import { Font, IconSize, Radius, Space, Weight } from '@/constants/tokens';

/** 빠른 선택 그리드 열 수 */
const PRESET_COLUMNS = 3;

function formatHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatClock(epochMs: number): string {
  return formatHm(new Date(epochMs));
}

/**
 * 시뮬레이션에서 늘어나는 시간.
 * 한 잔은 보통 1시간 미만이라 "0시간 40분" 이 되지 않게 분 단위를 따로 둔다.
 */
function formatSimDelta(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return i18n.t('addDrinkSimDeltaMinutes', { minutes });
  return i18n.t('addDrinkSimDeltaHours', { hours, minutes });
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
    ...dialogShadow,
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
              <DrinkIconPicker value={icon} onChange={setIcon} />
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
      <DrinkIcon name={resolveDrinkIcon(preset)} size={IconSize.drink} />
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
  /**
   * recordId — 수정 모드.
   * dupAbv/dupVol/dupIcon/dupLabel — "한 잔 더" 복제. 같은 술을 방금 시각으로
   * 새로 기록하는 것이라 수정과 달리 기존 기록을 건드리지 않는다.
   */
  const { recordId, dupAbv, dupVol, dupIcon, dupLabel } = useLocalSearchParams<{
    recordId?: string;
    dupAbv?: string;
    dupVol?: string;
    dupIcon?: string;
    dupLabel?: string;
  }>();
  const locale = localeStore(s => s.locale);
  void locale;

  const records = sessionStore(s => s.records);
  const profile = profileStore(s => s.profile);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  /**
   * 입력란에 포커스가 가면 폼 끝으로 스크롤한다.
   *
   * KeyboardAvoidingView 는 뷰포트를 줄여줄 뿐 스크롤 위치를 옮기지 않아서,
   * 폼이 길어진 뒤로는 용량 칸이 키보드 뒤에 남았다. 도수·용량·시뮬레이션·
   * 버튼이 폼의 마지막 덩어리라 끝으로 보내면 넷 다 키보드 위로 올라온다.
   * 키보드가 올라오는 애니메이션이 끝난 뒤라야 늘어난 높이가 반영된다.
   */
  function scrollToForm() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  }
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
    editRecord ? String(editRecord.abvPercent) : (dupAbv ?? ''),
  );
  const [volText, setVolText] = useState(
    editRecord ? String(Math.round(editRecord.volumeMl)) : (dupVol ?? ''),
  );
  const [consumedAt, setConsumedAt] = useState(
    editRecord?.consumedAt ?? Date.now(),
  );
  // null = 마시는중 (DB 재로드 시 null, 메모리 신규는 undefined이므로 ?? 로 통일)
  const [finishedAt, setFinishedAt] = useState<number | null>(
    editRecord?.finishedAt ?? null,
  );
  /**
   * 술 이름. 이제 모든 기록이 이름을 갖는다 —
   * 예전에는 프리셋과 도수·용량이 정확히 일치할 때만 이름이 붙어서,
   * 숫자를 조금만 고쳐도 목록에 「수동입력」 으로 남았다.
   */
  const [nameText, setNameText] = useState(
    editRecord?.presetLabel ?? dupLabel ?? '',
  );
  const [nameErr, setNameErr] = useState('');
  const [abvErr, setAbvErr] = useState('');
  const [volErr, setVolErr] = useState('');
  const [timeNotice, setTimeNotice] = useState('');
  const [saving, setSaving] = useState(false);

  // 프리셋 그리드 — 실측 폭으로 3열을 정확히 나눈다
  const [gridWidth, setGridWidth] = useState(0);
  const cellStyle = gridWidth
    ? { width: (gridWidth - Space.sm * (PRESET_COLUMNS - 1)) / PRESET_COLUMNS }
    : undefined;

  // Time picker — 시작/종료 중 어느 쪽을 편집 중인지
  const [timeTarget, setTimeTarget] = useState<'start' | 'end' | null>(null);
  const consumedDate = new Date(consumedAt);
  const finishedDate = finishedAt != null ? new Date(finishedAt) : null;
  const pickerDate = timeTarget === 'end' ? (finishedDate ?? new Date()) : consumedDate;

  // Preset selection
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number | null>(null);
  // 프리셋 선택 상태 — 이제 이름은 nameText 가 들고 있고,
  // 이 값들은 빠른 선택 카드의 선택 표시에만 쓰인다
  const [selectedPresetAbv, setSelectedPresetAbv] = useState<number | null>(null);
  const [selectedPresetVol, setSelectedPresetVol] = useState<number | null>(null);
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string | null>(null);

  /**
   * 이 기록에 저장할 아이콘.
   *
   * 수정 모드에서는 저장된 값을 쓰되, v4 이전 기록은 icon 이 없으므로
   * 예전처럼 프리셋 라벨로 되짚어 초기값을 잡는다.
   */
  const [icon, setIcon] = useState<DrinkIconName>(() => {
    if (editRecord?.icon && isDrinkIconName(editRecord.icon)) return editRecord.icon;
    if (editRecord?.presetLabel) {
      const p = presets.find(x => x.label === editRecord.presetLabel);
      if (p) return resolveDrinkIcon(p);
    }
    if (dupIcon && isDrinkIconName(dupIcon)) return dupIcon;
    return 'cup';
  });

  // Preset dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editPresetIdx, setEditPresetIdx] = useState<number | null>(null);
  const editPreset = editPresetIdx != null ? presets[editPresetIdx] : undefined;

  function handlePresetTap(idx: number) {
    const preset = presets[idx];
    setSelectedPresetIdx(idx);
    setSelectedPresetAbv(preset.abvPercent);
    setSelectedPresetVol(preset.volumeMl);
    setSelectedPresetLabel(preset.label);
    // 이름도 같이 채운다 — 빠른 선택으로 넣은 기록이 이름 없이 저장되면 안 된다
    setNameText(preset.label);
    setNameErr('');
    // 프리셋을 고르면 아래 아이콘 선택도 그 술로 따라간다
    setIcon(resolveDrinkIcon(preset));
    setAbvText(
      preset.abvPercent % 1 === 0
        ? String(preset.abvPercent)
        : preset.abvPercent.toFixed(1),
    );
    setVolText(String(Math.round(preset.volumeMl)));
    setAbvErr('');
    setVolErr('');
  }

  async function handlePresetLongPress(idx: number) {
    const preset = presets[idx];
    const picked = await actionSheet({
      title: preset.label,
      actions: [
        { label: i18n.t('customPresetEdit') },
        { label: i18n.t('customPresetDelete'), destructive: true },
      ],
      cancelLabel: i18n.t('customPresetCancel'),
    });
    if (picked === 0) {
      setEditPresetIdx(idx);
      setShowEditDialog(true);
      return;
    }
    if (picked !== 1) return;

    const ok = await confirm({
      message: i18n.t('customPresetDeleteConfirm'),
      confirmLabel: i18n.t('customPresetDelete'),
      cancelLabel: i18n.t('customPresetCancel'),
      destructive: true,
    });
    if (!ok) return;
    const newList = presets.filter((_, i) => i !== idx);
    await savePresets(newList);
    if (selectedPresetIdx === idx) setSelectedPresetIdx(null);
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

  /**
   * "이 술을 지금 마시면" 시뮬레이션 — 추가 전에 용량을 바꿔가며 계획할 수 있게.
   *
   * 직접 β 로 계산하지 않고 estimatedSoberAt 을 두 번 불러 차이를 낸다.
   * 타이머가 쓰는 함수와 같은 걸 써야 여기서 예고한 시간과 실제 타이머가
   * 어긋나지 않는다.
   *
   * 후보 기록은 finishedAt 을 채워 넣는다 — 계산기는 마시는중 기록을
   * 제외하므로(finishedOnly) 비워두면 시뮬레이션이 항상 0 이 된다.
   */
  const simulation = useMemo(() => {
    if (isEdit || !profile) return null;
    const a = parseFloat(abvText);
    const v = parseFloat(volText);
    if (isNaN(a) || a <= 0 || a > 100 || isNaN(v) || v <= 0) return null;

    const now = Date.now();
    const candidate: DrinkRecord = {
      consumedAt: now,
      finishedAt: now,
      abvPercent: a,
      volumeMl: v,
    };
    const after = estimatedSoberAt([...records, candidate], profile);
    if (after == null) return null;

    const before = estimatedSoberAt(records, profile);
    // 진행 중인 세션이 없거나 이미 다 깬 상태면 지금부터 새로 시작하는 셈이다
    const ongoing = before != null && before > now;
    const addedMs = Math.max(0, after - (ongoing ? before : now));

    return { addedMs, soberAt: ongoing ? after : now + addedMs };
  }, [isEdit, profile, abvText, volText, records]);

  function validate(): boolean {
    let ok = true;
    const trimmedName = nameText.trim();
    if (!trimmedName || trimmedName.length > 20) {
      setNameErr(i18n.t('addDrinkNameError')); ok = false;
    } else setNameErr('');
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
          presetLabel: nameText.trim(),
          icon,
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
          presetLabel: nameText.trim(),
          icon,
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
        {/* 좌우 폭이 같아야 가운데 타이틀이 실제로 가운데 온다 */}
        <TouchableOpacity
          style={styles.appBarSide}
          onPress={() => router.back()}
          hitSlop={{ top: Space.sm, bottom: Space.sm, left: Space.sm, right: Space.sm }}
        >
          <Icon name="close" size={IconSize.lg} color={AppColors.sub} />
        </TouchableOpacity>
        <Text style={styles.appTitle}>{title}</Text>
        <View style={styles.appBarSide} />
      </View>

      {/* Android edge-to-edge 에선 adjustResize 로 창이 줄지 않으므로
          두 플랫폼 모두 behavior="padding" 이 필요하다.
          SafeAreaView 가 bottom 인셋을 이미 먹었으니 그만큼 빼야 여백이 두 번 붙지 않는다 */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={-insets.bottom}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
        {/* Preset grid (add mode only) */}
        {!isEdit && (
          <>
            <Text style={styles.sectionTitle}>{i18n.t('addDrinkQuickSelect')}</Text>
            {/* 셀 폭은 퍼센트가 아니라 실측으로 계산한다 — 31%×3 + gap 이면
                딱 떨어지지 않아 오른쪽에만 여백이 남았다 */}
            <View
              style={styles.presetGrid}
              onLayout={e => setGridWidth(e.nativeEvent.layout.width)}
            >
              {presets.map((preset, idx) => (
                <View key={idx} style={[styles.presetCell, cellStyle]}>
                  <PresetCard
                    preset={preset}
                    selected={selectedPresetIdx === idx}
                    onPress={() => handlePresetTap(idx)}
                    onLongPress={() => handlePresetLongPress(idx)}
                  />
                </View>
              ))}
              <View style={[styles.presetCell, cellStyle]}>
                <AddPresetCard onPress={() => setShowAddDialog(true)} />
              </View>
            </View>
            <View style={styles.divider} />
          </>
        )}

        {/* Manual form */}
        <View style={styles.formCard}>
          {/* 아이콘 + 술 이름 한 줄.
              아이콘 그리드를 펼쳐 두면 두 줄을 먹어서 도수·용량이 아래로 밀렸다.
              이름은 필수 — 이제 모든 기록이 이름을 갖는다 (「수동입력」 없음). */}
          <View style={styles.nameRow}>
            <View style={styles.iconSelectCell}>
              <DrinkIconSelect value={icon} onChange={setIcon} />
            </View>
            <View style={styles.nameCell}>
              <FloatingLabelInput
                label={i18n.t('addDrinkNameLabel')}
                value={nameText}
                onChangeText={v => { setNameText(v); setNameErr(''); }}
                onFocus={scrollToForm}
                maxLength={20}
                error={nameErr || null}
              />
            </View>
          </View>

          {/* ABV */}
          <FloatingLabelInput
            label={i18n.t('addDrinkAbvLabel')}
            value={abvText}
            onChangeText={v => { setAbvText(v); setAbvErr(''); }}
            onFocus={scrollToForm}
            keyboardType="numeric"
            error={abvErr || null}
          />

          {/* Volume */}
          <FloatingLabelInput
            label={i18n.t('addDrinkVolumeLabel')}
            value={volText}
            onChangeText={v => { setVolText(v); setVolErr(''); }}
            onFocus={scrollToForm}
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

          {/* 추가 전 시뮬레이션 — 도수·용량을 바꾸면 즉시 다시 계산된다 */}
          {simulation && (
            <View style={styles.simCard}>
              <View style={styles.simHeader}>
                <Icon
                  name="clock"
                  size={IconSize.sm}
                  color={AppColors.accent}
                  strokeWidth={2.1}
                />
                <Text style={styles.simLabel}>{i18n.t('addDrinkSimLabel')}</Text>
              </View>
              <Text style={styles.simDelta}>{formatSimDelta(simulation.addedMs)}</Text>
              <Text style={styles.simSoberAt}>
                {i18n.t('addDrinkSimSoberAt', { time: formatClock(simulation.soberAt) })}
              </Text>
            </View>
          )}

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
      </KeyboardAvoidingView>

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
  appBarSide: { width: Space.xxxl, alignItems: 'flex-start' },
  appTitle: { fontSize: Font.h3, fontWeight: Weight.bold, color: AppColors.navy },
  flex: { flex: 1 },
  scrollContent: { padding: Space.lg, gap: Space.md },
  sectionTitle: { fontSize: Font.h3, fontWeight: Weight.bold, color: AppColors.navy },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  presetCell: {},
  divider: { height: 1, backgroundColor: AppColors.border },
  // 아이콘(좁게) + 이름(남는 폭). FloatingLabelInput 이 아래 여백을 갖고 있어
  // 아이콘 쪽을 위로 맞춰야 두 칸의 윗선이 어긋나지 않는다
  nameRow: { flexDirection: 'row', gap: Space.sm, alignItems: 'flex-start' },
  iconSelectCell: { width: 88 },
  nameCell: { flex: 1 },
  formCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.lg,
    ...cardShadowSm,
  },
  iconField: { marginBottom: Space.lg },
  iconFieldLabel: {
    fontSize: Font.caption,
    color: AppColors.sub,
    marginBottom: Space.sm,
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
  // 흰 카드 안이라 그림자 대신 연보라 채움으로 구분한다
  simCard: {
    backgroundColor: AppColors.bg,
    borderRadius: Radius.md,
    padding: Space.lg,
    marginBottom: Space.md,
    gap: Space.xxs,
  },
  simHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  simLabel: { fontSize: Font.caption, color: AppColors.sub },
  simDelta: {
    fontSize: Font.h3,
    fontWeight: Weight.bold,
    color: AppColors.accent,
  },
  simSoberAt: { fontSize: Font.bodySm, color: AppColors.navy },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: Weight.bold, fontSize: Font.body },
});
