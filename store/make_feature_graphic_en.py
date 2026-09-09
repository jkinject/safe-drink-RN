#!/usr/bin/env python3
"""한국어 피처 그래픽의 왼쪽 텍스트 영역을 배경 그라디언트로 메우고 영어 문구를 얹는다.
캐릭터 원본(투명 배경)이 없어서 기존 1024×500 을 재활용한다."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(ROOT, '..', 'assets', 'fonts')
src = Image.open(os.path.join(ROOT, 'graphics', 'feature-graphic-1024x500.png')).convert('RGB')
px = src.load()
# 텍스트 영역(x 60~470, y 150~350): 위(y=130)와 아래(y=380) 행의 색을 세로로 보간해 덮는다
for x in range(60, 480):
    top, bot = px[x, 130], px[x, 380]
    for y in range(140, 370):
        t = (y - 130) / 250
        px[x, y] = tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3))

d = ImageDraw.Draw(src)
f = lambda n, s: ImageFont.truetype(os.path.join(FONT_DIR, n), s)
d.text((75, 148), 'safedrink', font=f('Pretendard-Bold.ttf', 74), fill=(255, 255, 255))
d.text((77, 248), "Know when you'll be sober", font=f('Pretendard-SemiBold.ttf', 38), fill=(255, 255, 255))
d.text((78, 306), 'A BAC timer tuned to your body', font=f('Pretendard-Regular.ttf', 27), fill=(226, 224, 250))
out = os.path.join(ROOT, 'graphics', 'feature-graphic-en-1024x500.png')
src.save(out, optimize=True); print('wrote', out)
