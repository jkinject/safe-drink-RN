#!/usr/bin/env python3
"""App Store 스크린샷 합성 — 헤드라인 + 서브 + 둥근 기기 프레임 (6.9인치 1320×2868 / iPad 13인치 2064×2752).

사용법:
  python3 store/compose_screenshots_ios.py ko          # store/raw/ios/ko/NN-*.png → store/screenshots/ios/ko/
  python3 store/compose_screenshots_ios.py en
  python3 store/compose_screenshots_ios.py ko ipad13   # store/raw/ios/ipad13/ → store/screenshots/ios/ipad13/
  python3 store/compose_screenshots_ios.py en ipad13   # store/raw/ios/ipad13-en/ → store/screenshots/ios/ipad13-en/

원본 캡처는 iPhone 17 Pro Max 시뮬레이터(1320×2868, `xcrun simctl io <udid> screenshot`),
iPad 는 iPad Pro 13-inch 시뮬레이터(2064×2752). iPad 원본은 ko `raw/ios/ipad13/`, en `raw/ios/ipad13-en/`.
Play 판(`compose_screenshots.py`)과 같은 스타일이고 크기·캡션(05 = Live Activity)만 다르다.
캡처는 Metro 를 `EXPO_PUBLIC_HIDE_ADS=1` 로 띄워 배너 없이 찍는다(디버그 빌드는 테스트 광고가 뜬다).
"""
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(ROOT, '..', 'assets', 'fonts')
# 기기별 캔버스: (W, H, FRAME_W, FRAME_Y, RADIUS, 헤드라인 크기, 서브 크기)
DEVICES = {
    'iphone': (1320, 2868, 1000, 420, 90, 84, 48),
    'ipad13': (2064, 2752, 1560, 480, 60, 110, 60),
}
# iPad 원본 폴더: ko 는 raw/ios/ipad13, en 은 raw/ios/ipad13-en (같은 캔버스, 캡션만 언어별)
W, H, FRAME_W, FRAME_Y, RADIUS, HEAD_PT, SUB_PT = DEVICES['iphone']
NAVY = (45, 43, 82)
SUB = (110, 107, 150)
HOME_BAR_PX = 0           # iOS 는 홈 인디케이터를 잘라내지 않는다 (배경과 어우러짐)

CAPTIONS = {
    'ko': {
        '01': ('술 깰 때까지 남은 시간', '내 키·몸무게·성별에 맞춘 계산'),
        '02': ('시간에 따른 혈중알코올농도', '잔마다 올라가고 서서히 내려가는 곡선'),
        '03': ('한 번의 탭으로 기록', '맥주·소주·와인·하이볼, 그리고 나만의 술'),
        '04': ('지난 술자리 다시 보기', '최고 농도·총 섭취량·그래프까지'),
        '05': ('앱을 켜지 않아도', '잠금화면과 다이내믹 아일랜드에서 카운트다운'),
        '06': ('개인정보를 수집하지 않습니다', '회원가입 없이 사용, 백업은 원할 때만'),
    },
    'en': {
        '01': ("Time until you're sober", 'Calculated for your height, weight and sex'),
        '02': ('Your BAC over time', 'Watch each drink rise and fade'),
        '03': ('Log a drink in one tap', 'Beer, wine, whisky, cocktails — or your own'),
        '04': ('Look back on past nights', 'Peak BAC, total alcohol and the graph'),
        '05': ('Counts down with the app closed', 'On your Lock Screen and Dynamic Island'),
        '06': ('Private by design', 'No account needed. Backup only if you want it'),
    },
}


def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)


def background():
    bg = Image.new('RGB', (W, H))
    top, bottom = (238, 237, 248), (221, 218, 242)
    px = bg.load()
    for y in range(H):
        t = y / (H - 1)
        c = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = c
    return bg


def rounded(shot: Image.Image, radius: int):
    mask = Image.new('L', shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width - 1, shot.height - 1), radius, fill=255)
    return mask


def paste_with_shadow(canvas, shot, mask, x, y):
    shadow = Image.new('RGBA', (shot.width + 160, shot.height + 160), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((80, 100, 80 + shot.width, 100 + shot.height), RADIUS, fill=(108, 99, 224, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    canvas.paste(shadow, (x - 80, y - 80), shadow)
    canvas.paste(shot, (x, y), mask)


def compose(raw_path, headline, sub, out_path):
    raw = Image.open(raw_path).convert('RGB')
    if HOME_BAR_PX:
        raw = raw.crop((0, 0, raw.width, raw.height - HOME_BAR_PX))
    scale = FRAME_W / raw.width
    shot = raw.resize((FRAME_W, round(raw.height * scale)), Image.LANCZOS)
    mask = rounded(shot, round(RADIUS * FRAME_W / W * 1.3))
    canvas = background()
    d = ImageDraw.Draw(canvas)
    hf = font('Pretendard-Bold.ttf', HEAD_PT)
    sf = font('Pretendard-Regular.ttf', SUB_PT)
    hw = d.textlength(headline, font=hf)
    d.text(((W - hw) / 2, FRAME_Y * 120 // 420), headline, font=hf, fill=NAVY)
    sw = d.textlength(sub, font=sf)
    d.text(((W - sw) / 2, FRAME_Y * 240 // 420), sub, font=sf, fill=SUB)
    paste_with_shadow(canvas, shot, mask, (W - FRAME_W) // 2, FRAME_Y)
    canvas.save(out_path, optimize=True)
    print(out_path)


def main():
    global W, H, FRAME_W, FRAME_Y, RADIUS, HEAD_PT, SUB_PT
    lang = sys.argv[1] if len(sys.argv) > 1 else 'ko'
    device = sys.argv[2] if len(sys.argv) > 2 else 'iphone'
    W, H, FRAME_W, FRAME_Y, RADIUS, HEAD_PT, SUB_PT = DEVICES[device]
    sub_dir = lang if device == 'iphone' else (device if lang == 'ko' else f'{device}-{lang}')
    raw_dir = os.path.join(ROOT, 'raw', 'ios', sub_dir)
    out_dir = os.path.join(ROOT, 'screenshots', 'ios', sub_dir)
    os.makedirs(out_dir, exist_ok=True)
    for raw in sorted(glob.glob(os.path.join(raw_dir, '*.png'))):
        num = os.path.basename(raw)[:2]
        headline, sub = CAPTIONS[lang][num]
        compose(raw, headline, sub, os.path.join(out_dir, os.path.basename(raw)))


if __name__ == '__main__':
    main()
