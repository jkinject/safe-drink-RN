import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { create } from 'zustand';
import { AppColors, dialogShadow } from '@/constants/colors';
import { Font, Radius, Space, Weight } from '@/constants/tokens';
import { Text } from '@/components/typography';

/**
 * 앱 공통 다이얼로그.
 *
 * OS 기본 Alert 는 플랫폼마다 생김새가 달라 앱 디자인과 겉돈다.
 * 호출부는 `await confirm({...})` 처럼 쓰고, 그리기는 루트에 한 번 놓은
 * <DialogHost /> 가 맡는다.
 */

interface ActionItem {
  label: string;
  /** 삭제처럼 되돌릴 수 없는 동작은 빨갛게 */
  destructive?: boolean;
}

type Request =
  | {
      kind: 'confirm';
      title?: string;
      message?: string;
      confirmLabel: string;
      cancelLabel: string;
      destructive?: boolean;
    }
  | { kind: 'alert'; title?: string; message: string; confirmLabel: string }
  | {
      kind: 'actions';
      title?: string;
      actions: ActionItem[];
      cancelLabel: string;
    };

interface DialogState {
  request: (Request & { resolve: (v: unknown) => void }) | null;
  open: (req: Request) => Promise<unknown>;
  close: (value: unknown) => void;
}

const dialogStore = create<DialogState>((set, get) => ({
  request: null,
  open: (req) =>
    new Promise((resolve) => {
      set({ request: { ...req, resolve } });
    }),
  close: (value) => {
    const current = get().request;
    set({ request: null });
    current?.resolve(value);
  },
}));

/** 확인/취소 — 확인을 누르면 true */
export function confirm(options: {
  title?: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}): Promise<boolean> {
  return dialogStore.getState().open({ kind: 'confirm', ...options }) as Promise<boolean>;
}

/** 알림 — 확인 버튼 하나 */
export function alert(options: {
  title?: string;
  message: string;
  confirmLabel: string;
}): Promise<void> {
  return dialogStore.getState().open({ kind: 'alert', ...options }) as Promise<void>;
}

/** 동작 선택 — 고른 항목의 인덱스, 취소하면 null */
export function actionSheet(options: {
  title?: string;
  actions: ActionItem[];
  cancelLabel: string;
}): Promise<number | null> {
  return dialogStore.getState().open({ kind: 'actions', ...options }) as Promise<
    number | null
  >;
}

/** 루트 레이아웃에 한 번만 놓는다 */
export function DialogHost() {
  const request = dialogStore(s => s.request);
  const close = dialogStore(s => s.close);
  if (!request) return null;

  const cancelValue = request.kind === 'actions' ? null : false;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => close(cancelValue)}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {!!request.title && <Text style={styles.title}>{request.title}</Text>}
          {request.kind !== 'actions' && !!request.message && (
            <Text style={styles.message}>{request.message}</Text>
          )}

          {request.kind === 'actions' ? (
            <View style={styles.actionList}>
              {request.actions.map((action, i) => (
                <TouchableOpacity
                  key={action.label}
                  style={styles.actionBtn}
                  onPress={() => close(i)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.actionText, action.destructive && styles.destructiveText]}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelAction]}
                onPress={() => close(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>{request.cancelLabel}</Text>
              </TouchableOpacity>
            </View>
          ) : request.kind === 'alert' ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => close(undefined)}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryText}>{request.confirmLabel}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.cancelBtn, styles.rowItem]}
                onPress={() => close(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>{request.cancelLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  styles.rowItem,
                  request.destructive && styles.dangerBtn,
                ]}
                onPress={() => close(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryText}>{request.confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const DANGER = '#FF3B30';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(45,43,82,0.45)',
    justifyContent: 'center',
    padding: Space.xxl,
  },
  container: {
    backgroundColor: AppColors.cardBg,
    borderRadius: Radius.xl,
    padding: Space.xxl,
    gap: Space.md,
    ...dialogShadow,
  },
  title: {
    fontSize: Font.h4,
    fontWeight: Weight.bold,
    color: AppColors.navy,
    textAlign: 'center',
  },
  message: {
    fontSize: Font.body,
    color: AppColors.sub,
    textAlign: 'center',
    lineHeight: 20,
  },
  row: { flexDirection: 'row', gap: Space.md, marginTop: Space.xs },
  // row 안에서 좌우로 나눌 때만 flex 를 준다.
  // 단독으로 쓰는 알림 버튼에 flex 가 붙으면 세로 축에 작용해 높이가 0이 된다
  rowItem: { flex: 1 },
  primaryBtn: {
    paddingVertical: Space.md,
    alignItems: 'center',
    borderRadius: Radius.md,
    backgroundColor: AppColors.accent,
  },
  dangerBtn: { backgroundColor: DANGER },
  primaryText: { color: '#fff', fontWeight: Weight.bold, fontSize: Font.body },
  cancelBtn: {
    paddingVertical: Space.md,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cancelText: { color: AppColors.sub, fontWeight: Weight.semibold, fontSize: Font.body },
  actionList: { gap: Space.sm },
  actionBtn: {
    paddingVertical: Space.md,
    alignItems: 'center',
    borderRadius: Radius.md,
    backgroundColor: AppColors.bg,
  },
  actionText: { color: AppColors.navy, fontWeight: Weight.semibold, fontSize: Font.body },
  destructiveText: { color: DANGER },
  cancelAction: { backgroundColor: 'transparent' },
});
