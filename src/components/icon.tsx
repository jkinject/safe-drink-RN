import {
  BookOpen,
  Cake,
  Check,
  ChevronDown,
  ChevronRight,
  ChartColumn,
  ClipboardList,
  Copy,
  CircleAlert,
  Clock,
  Droplets,
  Globe,
  Info,
  Mars,
  Pencil,
  Plus,
  RotateCcw,
  Ruler,
  Scale,
  Settings,
  ShieldCheck,
  Timer,
  Trash2,
  TriangleAlert,
  User,
  Venus,
  X,
} from 'lucide-react-native';
import { AppColors } from '@/constants/colors';

/**
 * 앱에서 쓰는 아이콘은 전부 여기를 거친다.
 *
 * 화면 코드는 의미 이름(`name="delete"`)만 알고, 어떤 세트를 쓰는지는 모른다.
 * 나중에 아이콘 세트를 통째로 갈아끼워도 이 파일만 고치면 된다.
 */
const ICONS = {
  timer: Timer,
  plan: ChartColumn,
  settings: Settings,
  delete: Trash2,
  profile: User,
  language: Globe,
  restore: RotateCcw,
  clock: Clock,
  guide: BookOpen,
  history: ClipboardList,
  copy: Copy,
  add: Plus,
  close: X,
  check: Check,
  water: Droplets,
  edit: Pencil,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  safe: ShieldCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  info: Info,
  height: Ruler,
  weight: Scale,
  birthYear: Cake,
  male: Mars,
  female: Venus,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** 강조가 필요한 곳은 2.25, 보조 정보는 1.75 정도가 보기 좋다 */
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 20,
  color = AppColors.navy,
  strokeWidth = 2,
}: IconProps) {
  const Component = ICONS[name];
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
}
