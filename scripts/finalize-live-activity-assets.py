#!/usr/bin/env python3
"""배경 제거된 캐릭터 RGBA 를 Live Activity 에셋으로 마무리한다 (Pillow 만 사용).

파이프라인 (docs: CLAUDE.md "iOS 카운트다운은 Live Activity"):
  1. Codex 이미지 도구로 캐릭터를 순수 초록(#00FF00) 단색 배경에 다시 그린다
     (투명 출력을 지원하지 않는다).
  2. scripts/remove-bg-replicate.py 로 배경을 뺀다 (851-labs/background-remover).
  3. 이 스크립트: 가장자리 초록 번짐(spill) 제거 → 여백 크롭 → 높이 320px 축소 → 저장.

    python3 scripts/finalize-live-activity-assets.py in_rgba.png assets/liveActivity/la_male_dizzy.png [...]

despill 은 알파 가장자리 2px 띠에서만 한다 — 전체에 걸면 소주병 같은 진짜 초록이 죽는다.
"""
import sys
from pathlib import Path

from PIL import Image, ImageFilter

HEIGHT = 320
PADDING = 6
EDGE_BAND = 2  # 가장자리에서 despill 을 적용할 폭(px)


def despill_edges(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    r, g, b, a = im.split()
    # 투명 픽셀을 EDGE_BAND 만큼 불려서 가장자리 띠를 만든다
    eroded = a.filter(ImageFilter.MinFilter(EDGE_BAND * 2 + 1))
    px = im.load()
    band = eroded.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            if band[x, y] == 255:
                continue  # 안쪽: 손대지 않는다
            pr, pg, pb, pa = px[x, y]
            if pa == 0:
                continue
            cap = max(pr, pb)
            if pg > cap:
                px[x, y] = (pr, cap, pb, pa)
    return im


OPAQUE_SNAP = 240  # 배경 제거 모델이 안쪽 알파를 240~254 로 내놓는다 — 이 이상은 완전 불투명으로


def snap_opaque(im: Image.Image) -> Image.Image:
    r, g, b, a = im.split()
    a = a.point(lambda v: 255 if v >= OPAQUE_SNAP else v)
    return Image.merge("RGBA", (r, g, b, a))


def finalize(src: Path, dst: Path) -> None:
    im = snap_opaque(despill_edges(Image.open(src)))
    bbox = im.getbbox()
    if bbox is None:
        raise SystemExit(f"{src}: 전부 투명")
    l, t, r, b = bbox
    im = im.crop((max(0, l - PADDING), max(0, t - PADDING), min(im.width, r + PADDING), min(im.height, b + PADDING)))
    w = round(im.width * HEIGHT / im.height)
    im = im.resize((w, HEIGHT), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, optimize=True)
    a = im.getchannel("A")
    hist = a.histogram()
    total = im.width * im.height
    print(f"{src.name} → {dst} {im.size}  transparent {hist[0] * 100 / total:.1f}%  opaque {hist[255] * 100 / total:.1f}%")


def main(argv: list[str]) -> None:
    if len(argv) < 2 or len(argv) % 2:
        raise SystemExit(__doc__)
    for i in range(0, len(argv), 2):
        finalize(Path(argv[i]), Path(argv[i + 1]))


if __name__ == "__main__":
    main(sys.argv[1:])
