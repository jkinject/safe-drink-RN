#!/usr/bin/env python3
"""순수 초록(#00FF00) 배경으로 그린 캐릭터를 크로마키로 투명(RGBA) 처리한다 (Pillow 만 사용).

ML 배경 제거(851-labs/background-remover)는 캐릭터 주변에 떠 있는 물방울·하트를
배경으로 보고 지운다. Codex 이미지 도구가 배경을 완전 단색 초록으로 그려 주므로
초록만 골라 빼면 장식이 그대로 남는다.

    python3 scripts/key-green-characters.py in.png out.png [--height 1024] [in2 out2 ...]

알고리즘 (초록 과잉 e = G − max(R, B), 0~255):
  1. e ≥ HARD 인 픽셀은 어디에 있든 배경(갇힌 영역·거품 안쪽 포함). 소주병 초록은 e≈60 이라 안전.
  2. 배경을 ALPHA_BAND 만큼 불린 띠 안에서만 알파를 부드럽게: a = 1 − clamp((e − LO)/(HI − LO)).
     SPILL_BAND 안의 불투명 픽셀은 초록 물듦(G 과잉)을 깎는다. 안쪽이라도 밝고 연한 초록
     (유리컵에 배경이 비친 것)은 중화한다 — R·B ≥ PALE_SPILL_MIN 조건으로 소주병은 보호.
  3. 반투명 픽셀은 초록 기여분을 되돌린다: R' = R/a, B' = B/a, G' = (G − (1−a)·255)/a.
     이러면 흰 스웨터 가장자리도 회색이 아니라 흰색으로 남는다.
  4. 여백 크롭(+PADDING) → 지정 높이로 LANCZOS 축소 → PNG.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageFilter

HARD = 150        # 이 이상이면 배경(유리컵에 비친 진한 초록도 포함 — 소주병 e≈60~100 은 안전)
LO, HI = 80, 240  # 소프트 알파 구간 (소주병 초록 e≈60 은 LO 아래라 불투명 유지)
ALPHA_BAND = 10   # 배경 주변 이 폭(px) 안에서만 알파를 부드럽게 (렌더의 안티에일리어싱 폭보다 넓게)
SPILL_BAND = 4    # 이 폭 안의 불투명 픽셀은 초록 물듦을 깎는다 (넓히면 소주병 테두리가 탁해진다)
SPILL_TOL = 16    # 허용할 초록 과잉
PALE_SPILL_MIN = 60   # 안쪽 초록 물듦 중화 조건: min(R,B) ≥ 이 값 AND G ≥ PALE_SPILL_G (소주병 G≈120~180 은 제외)
PALE_SPILL_G = 190
PADDING = 8


def key(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    w, h = im.size
    px = im.load()

    # 1. 순수 초록(e ≥ HARD) 은 어디에 있든 배경 — 팔과 머리 사이 같은 갇힌 영역, 거품 안쪽도 포함.
    #    (테두리 연결 조건을 두면 갇힌 초록이 남는다. 소주병 초록은 e≈60 이라 걸리지 않는다.)
    hard = Image.new("L", (w, h), 0)
    hp = hard.load()
    excess = [[0] * w for _ in range(h)]
    for y in range(h):
        row = excess[y]
        for x in range(w):
            r, g, b = px[x, y]
            e = g - max(r, b)
            row[x] = e
            if e >= HARD:
                hp[x, y] = 255

    # 2. 배경 주변 띠: 넓은 띠(ALPHA_BAND)는 알파를 부드럽게, 좁은 띠(SPILL_BAND)는 초록 번짐을 깎는다
    alpha_band = hard.filter(ImageFilter.MaxFilter(ALPHA_BAND * 2 + 1)).load()
    spill_band = hard.filter(ImageFilter.MaxFilter(SPILL_BAND * 2 + 1)).load()

    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if hp[x, y]:
                op[x, y] = (0, 0, 0, 0)
                continue
            if alpha_band[x, y] == 0:
                e = excess[y][x]
                if e > SPILL_TOL and min(r, b) >= PALE_SPILL_MIN and g >= PALE_SPILL_G:
                    # 유리컵처럼 투명한 사물에 초록 배경이 비쳐 연두색으로 물든 부분 —
                    # 밝고 연한(R·B 가 높은) 초록만 중화한다. 소주병은 R·B 가 낮아 그대로.
                    g = max(r, b) + SPILL_TOL
                op[x, y] = (r, g, b, 255)
                continue
            e = excess[y][x]
            a = 1.0 - min(max((e - LO) / (HI - LO), 0.0), 1.0)
            if a <= 0.0:
                op[x, y] = (0, 0, 0, 0)
                continue
            if a >= 1.0:
                if spill_band[x, y] and e > SPILL_TOL:
                    # 불투명한 가장자리에 남은 초록 물듦 — G 를 다른 채널 수준으로 내린다
                    g = max(r, b) + SPILL_TOL
                op[x, y] = (r, g, b, 255)
                continue
            # 3. 반투명 픽셀: 초록 기여분을 되돌린다
            r2 = min(255, round(r / a))
            b2 = min(255, round(b / a))
            g2 = min(255, max(0, round((g - (1 - a) * 255) / a)))
            op[x, y] = (r2, g2, b2, round(a * 255))
    return out


def finalize(src: Path, dst: Path, height: int) -> None:
    im = key(Image.open(src))
    bbox = im.getbbox()
    if bbox is None:
        raise SystemExit(f"{src}: 전부 투명")
    l, t, r, b = bbox
    im = im.crop((max(0, l - PADDING), max(0, t - PADDING), min(im.width, r + PADDING), min(im.height, b + PADDING)))
    if im.height != height:
        im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, optimize=True)
    hist = im.getchannel("A").histogram()
    n = im.width * im.height
    print(f"{src.name} → {dst} {im.size}  transparent {hist[0] * 100 / n:.1f}%  partial {sum(hist[1:255]) * 100 / n:.1f}%  opaque {hist[255] * 100 / n:.1f}%")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("pairs", nargs="+", help="in.png out.png [in2 out2 ...]")
    p.add_argument("--height", type=int, default=1024)
    a = p.parse_args()
    if len(a.pairs) % 2:
        raise SystemExit("in/out 쌍으로 넘겨야 한다")
    for i in range(0, len(a.pairs), 2):
        finalize(Path(a.pairs[i]), Path(a.pairs[i + 1]), a.height)


if __name__ == "__main__":
    main()
