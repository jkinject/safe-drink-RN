#!/usr/bin/env python3
"""스토어 스크린샷 합성 — 헤드라인 + 서브 + 둥근 기기 프레임 (1080×1920).

사용법:
  python3 store/compose_screenshots.py en      # store/raw/en/NN-*.png → store/screenshots/en/
  python3 store/compose_screenshots.py ko      # (한국어 재생성 시) store/raw/ko/ → store/screenshots/

원본 캡처는 폴드7 커버 화면(1080×2520) 기준. 하단 3버튼 내비바는 잘라낸다.
캡션은 아래 CAPTIONS 에서 파일 번호(01~06)로 찾는다.
"""
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(ROOT, '..', 'assets', 'fonts')
W, H = 1080, 1920
NAVY = (45, 43, 82)
SUB = (110, 107, 150)
FRAME_X, FRAME_Y, FRAME_W = 183, 262, 714
RADIUS = 44
NAV_BAR_PX = 130          # 폴드7 3버튼 내비바 높이 (1080×2520 기준)

CAPTIONS = {
    'en': {
        '01': ("Time until you're sober", 'Calculated for your height, weight and sex'),
        '02': ('Your BAC over time', 'Watch each drink rise and fade'),
        '03': ('Log a drink in one tap', 'Beer, wine, whisky, cocktails — or your own'),
        '04': ('Look back on past nights', 'Peak BAC, total alcohol and the graph'),
        '05': ('Counts down with the app closed', 'Right in your notification shade'),
        '06': ('Private by design', 'No account. Everything stays on your device'),
    },
    'ko': {
        '01': ('술 깰 때까지 남은 시간', '내 키·몸무게·성별에 맞춘 계산'),
        '02': ('시간에 따른 혈중 알코올 농도', '잔마다 올라가고 서서히 내려가는 곡선'),
        '03': ('한 번의 탭으로 기록', '맥주·소주·와인·하이볼, 그리고 나만의 술'),
        '04': ('지난 술자리 다시 보기', '최고 농도·총 섭취량·그래프까지'),
        '05': ('앱을 켜지 않아도', '알림창에서 1초씩 줄어드는 남은 시간'),
        '06': ('개인정보를 수집하지 않습니다', '회원가입 없음, 기록은 기기 안에만'),
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


def rounded_frame(raw: Image.Image):
    raw = raw.convert('RGB')
    rw, rh = raw.size
    raw = raw.crop((0, 0, rw, rh - NAV_BAR_PX))
    scale = FRAME_W / rw
    fh = round((rh - NAV_BAR_PX) * scale)
    shot = raw.resize((FRAME_W, fh), Image.LANCZOS)
    mask = Image.new('L', shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, FRAME_W - 1, fh - 1), RADIUS, fill=255)
    return shot, mask


def compose(raw_path, headline, sub, out_path):
    canvas = background()
    shot, mask = rounded_frame(Image.open(raw_path))
    # 연보라 그림자
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((FRAME_X, FRAME_Y + 18, FRAME_X + FRAME_W, FRAME_Y + shot.height + 18),
                         RADIUS, fill=(108, 99, 224, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    canvas = Image.alpha_composite(canvas.convert('RGBA'), shadow)
    canvas.paste(shot, (FRAME_X, FRAME_Y), mask)
    # 하단은 캔버스 밖으로 나가므로 자연스럽게 잘린다

    d = ImageDraw.Draw(canvas)
    hf = font('Pretendard-Bold.ttf', 68)
    sf = font('Pretendard-Regular.ttf', 40)
    hw = d.textlength(headline, font=hf)
    sw = d.textlength(sub, font=sf)
    d.text(((W - hw) / 2, 82), headline, font=hf, fill=NAVY)
    d.text(((W - sw) / 2, 172), sub, font=sf, fill=SUB)
    canvas.convert('RGB').save(out_path, optimize=True)
    print('wrote', out_path)


def main():
    lang = sys.argv[1] if len(sys.argv) > 1 else 'en'
    raw_dir = os.path.join(ROOT, 'raw', lang)
    out_dir = os.path.join(ROOT, 'screenshots', lang) if lang != 'ko' else os.path.join(ROOT, 'screenshots')
    os.makedirs(out_dir, exist_ok=True)
    for raw in sorted(glob.glob(os.path.join(raw_dir, '*.png'))):
        num = os.path.basename(raw)[:2]
        if num not in CAPTIONS[lang]:
            print('skip (no caption):', raw); continue
        headline, sub = CAPTIONS[lang][num]
        compose(raw, headline, sub, os.path.join(out_dir, os.path.basename(raw)))


if __name__ == '__main__':
    main()
