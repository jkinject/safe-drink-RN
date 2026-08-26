/**
 * 입력란 터치 영역 회귀 테스트
 *
 * 배경: TextInput 은 글자 줄 높이만 차지해서 52dp 테두리 상자의 위·아래가
 * 빈 View 였다. 거기를 누르면 ScrollView 의 keyboardShouldPersistTaps="handled"
 * 규칙상 "처리되지 않은 탭"이라 키보드가 닫혔다 — "분명 맞게 눌렀는데
 * 포커스를 잃는" 증상. 상자 전체가 탭을 받아 포커스를 넘겨야 한다.
 *
 * 실제 포커스 이동은 네이티브 동작이라 여기서 확인할 수 없다. 이 테스트가
 * 지키는 건 구조다 — 상자에 onPress 가 살아 있고, 라벨이 탭을 삼키지 않는 것.
 */
import TestRenderer, { act } from 'react-test-renderer';
import { FloatingLabelInput } from '../floating-label-input';

function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <FloatingLabelInput label="술 이름" value="" onChangeText={() => {}} />,
    );
  });
  return tree;
}

describe('FloatingLabelInput', () => {
  // 라벨 애니메이션(Animated.timing) 이 테스트 종료 후에도 타이머를 물고 있어
  // 환경이 내려간 뒤 터진다 — 가짜 타이머로 붙잡고 언마운트한다
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('테두리 상자 전체가 탭을 받는다 (높이 52 컨테이너에 onPress)', () => {
    const tree = render();

    // Pressable 은 memo/forwardRef 라 findByType 으로 못 잡는다 —
    // onPress 를 들고 있으면서 상자 높이를 가진 노드를 찾는다
    const boxes = tree.root.findAll(n => {
      if (typeof n.props?.onPress !== 'function') return false;
      const flat = ([] as any[]).concat(n.props.style ?? []).flat();
      return flat.some(s => s && s.height === 52);
    });

    expect(boxes.length).toBeGreaterThan(0);
    // 눌러도 터지지 않아야 한다 (ref 가 비어 있어도 옵셔널 체이닝으로 방어)
    act(() => boxes[0].props.onPress());
    act(() => tree.unmount());
  });

  it('떠 있는 라벨은 탭을 가로채지 않는다', () => {
    const tree = render();
    // 라벨은 position:absolute 로 입력 글자 위에 겹친다 —
    // pointerEvents 를 빼면 라벨을 누른 탭이 그대로 삼켜진다
    const labels = tree.root.findAll(
      n => n.props?.pointerEvents === 'none' && n.props?.children === '술 이름',
    );
    expect(labels.length).toBeGreaterThan(0);
    act(() => tree.unmount());
  });
});
