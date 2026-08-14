import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
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
import { sessionStore } from '@/state/sessionStore';
import { presetsStore } from '@/state/presetsStore';
import { localeStore } from '@/state/localeStore';
import { DrinkPreset } from '@/core/types';
import * as notificationService from '@/services/notifications';

const EMOJI_CANDIDATES = [
  '🍺', '🍻', '🥃', '🍷', '🍶', '🥂',
  '🍸', '🍹', '🍾', '🫗', '🧉', '🍇',
];

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
    borderRadius: 20,
    padding: 24,
    width: 280,
    gap: 16,
    ...cardShadow,
  },
  title: { fontSize: 15, fontWeight: '700', color: AppColors.navy, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  input: {
    width: 72,
    height: 52,
    borderWidth: 2,
    borderColor: AppColors.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.navy,
  },
  colon: { fontSize: 28, fontWeight: '700', color: AppColors.navy },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12,
    borderWidth: 1, borderColor: AppColors.border,
  },
  cancelText: { color: AppColors.sub, fontWeight: '600' },
  confirmBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12,
    backgroundColor: AppColors.accent,
  },
  confirmText: { color: '#fff', fontWeight: '700' },
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
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🍹');
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
      setEmoji(initial?.emoji ?? '🍹');
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
      emoji,
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
        <View style={[dlgStyles.container, { paddingBottom: 24 + insets.bottom }]}>
          <Text style={dlgStyles.title}>{title}</Text>
          <ScrollView
            style={dlgStyles.scroll}
            contentContainerStyle={dlgStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* Emoji picker */}
            <View style={dlgStyles.emojiGrid}>
              {EMOJI_CANDIDATES.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[dlgStyles.emojiBtn, emoji === e && dlgStyles.emojiBtnSelected]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={dlgStyles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
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
    padding: 24,
    gap: 8,
    maxHeight: '85%',
    // 키보드로 공간이 줄면 시트가 같이 줄어들 수 있어야 함
    flexShrink: 1,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { gap: 8, paddingBottom: 4 },
  title: { fontSize: 16, fontWeight: '700', color: AppColors.navy, marginBottom: 8 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  emojiBtnSelected: {
    borderColor: AppColors.accent,
    backgroundColor: AppColors.bg,
  },
  emojiText: { fontSize: 22 },
  input: {
    borderWidth: 1, borderColor: AppColors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    color: AppColors.navy,
  },
  inputError: { borderColor: '#FF3B30' },
  errorText: { fontSize: 11, color: '#FF3B30', marginTop: -4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderRadius: 12, borderWidth: 1, borderColor: AppColors.border,
  },
  cancelText: { color: AppColors.sub, fontWeight: '600' },
  saveBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderRadius: 12, backgroundColor: AppColors.accent,
  },
  saveText: { color: '#fff', fontWeight: '700' },
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
      <Text style={pcStyles.emoji}>{preset.emoji}</Text>
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
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 4,
    ...cardShadowSm,
  },
  cardSelected: {
    borderColor: AppColors.accent,
    borderWidth: 2,
    backgroundColor: '#EAE8FF',
  },
  emoji: { fontSize: 28 },
  label: { fontSize: 11, fontWeight: '600', color: AppColors.navy, textAlign: 'center' },
  detail: { fontSize: 10, color: AppColors.sub },
});

// ── Add preset card ───────────────────────────────────────────────────────────

function AddPresetCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={pcStyles.card} onPress={onPress} activeOpacity={0.8}>
      <Text style={{ fontSize: 28 }}>➕</Text>
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
  const [abvErr, setAbvErr] = useState('');
  const [volErr, setVolErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Time picker
  const [showTimePicker, setShowTimePicker] = useState(false);
  const consumedDate = new Date(consumedAt);

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

  function handleTimePickerConfirm(h: number, m: number) {
    setShowTimePicker(false);
    const d = new Date();
    let dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
    if (dt.getTime() > Date.now()) {
      dt = new Date(dt.getTime() - 86400000);
    }
    setConsumedAt(dt.getTime());
  }

  const title = isEdit ? i18n.t('editRecordTitle') : i18n.t('addDrinkTitle');
  const submitLabel = isEdit ? i18n.t('editRecordSubmit') : i18n.t('addDrinkSubmit');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backBtn}>✕</Text>
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

          {/* Time row (edit mode only) */}
          {isEdit && (
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>{i18n.t('addDrinkTimeLabel')}</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                <Text style={styles.timeValue}>
                  {String(consumedDate.getHours()).padStart(2, '0')}:
                  {String(consumedDate.getMinutes()).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.nowBtn}
                onPress={() => setConsumedAt(Date.now())}
              >
                <Text style={styles.nowBtnText}>🕐 {i18n.t('addDrinkSetNow')}</Text>
              </TouchableOpacity>
            </View>
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
        title={i18n.t('addDrinkTimeLabel')}
        visible={showTimePicker}
        initialHour={consumedDate.getHours()}
        initialMinute={consumedDate.getMinutes()}
        onConfirm={handleTimePickerConfirm}
        onCancel={() => setShowTimePicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  backBtn: { fontSize: 18, color: AppColors.sub, fontWeight: '600', width: 32 },
  appTitle: { fontSize: 18, fontWeight: '700', color: AppColors.navy },
  scrollContent: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: AppColors.navy },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetCell: { width: '31%' },
  divider: { height: 1, backgroundColor: AppColors.border },
  formCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 16,
    padding: 16,
    ...cardShadowSm,
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: AppColors.navy,
    fontWeight: '500',
  },
  inputError: { borderColor: '#FF3B30' },
  errorText: { fontSize: 11, color: '#FF3B30', marginTop: 3 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  timeLabel: { fontSize: 13, color: AppColors.sub },
  timeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.accent,
    paddingHorizontal: 4,
  },
  nowBtn: {
    backgroundColor: AppColors.bg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nowBtnText: { fontSize: 12, color: AppColors.accent, fontWeight: '600' },
  submitBtn: {
    backgroundColor: AppColors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
