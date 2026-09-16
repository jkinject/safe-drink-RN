#!/usr/bin/env python3
"""Replicate `851-labs/background-remover` 로 이미지 배경을 투명(RGBA)으로 뺀다.

술 아이콘(docs/DRINK-ICONS.md)과 같은 파이프라인이다 — 생성 모델(gpt-image)은 투명 배경을
못 내므로 단색 배경으로 그린 뒤 ML 배경 제거를 거친다. 색 거리 매팅보다 머리카락·
반투명 가장자리가 훨씬 깨끗하다.

    python3 scripts/remove-bg-replicate.py in.png out.png [in2.png out2.png ...]

토큰은 ~/.replicate_api_token (표준 라이브러리만 사용, `replicate` 패키지 불필요).
"""
import json
import mimetypes
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

MODEL = "851-labs/background-remover"
API = "https://api.replicate.com/v1"


def token() -> str:
    return Path.home().joinpath(".replicate_api_token").read_text().strip()


def request(method: str, url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token()}")
    req.add_header("Content-Type", "application/json")
    # urllib 기본 UA(Python-urllib) 는 Cloudflare 가 403(error code 1010) 으로 막는다
    req.add_header("User-Agent", "safedrink-assets/1.0")
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                return json.load(res)
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            wait = int(e.headers.get("Retry-After") or 0) or 10 * (attempt + 1)
            print(f"429 rate limited — {wait}s 뒤 재시도")
            time.sleep(wait)
    raise SystemExit("unreachable")


def upload(path: Path) -> str:
    """Replicate Files API 로 올리고 입력에 쓸 URL 을 받는다.

    data URI 는 256KB 제한이라 1MB 급 원본은 403 이 난다 — 항상 업로드를 거친다.
    """
    boundary = "----safedrink" + uuid.uuid4().hex
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"content\"; "
        f"filename=\"{path.name}\"\r\nContent-Type: {mime}\r\n\r\n"
    ).encode() + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{API}/files", data=body, method="POST")
    req.add_header("Authorization", f"Bearer {token()}")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    req.add_header("User-Agent", "safedrink-assets/1.0")
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.load(res)["urls"]["get"]


def latest_version() -> str:
    """이 모델은 공식 모델 엔드포인트가 없어(404) 버전 ID 로 /predictions 에 넣어야 한다."""
    return request("GET", f"{API}/models/{MODEL}")["latest_version"]["id"]


def remove_background(src: Path, dst: Path) -> None:
    pred = request(
        "POST",
        f"{API}/predictions",
        {
            "version": latest_version(),
            "input": {"image": upload(src), "background_type": "rgba", "format": "png"},
        },
    )
    url = pred["urls"]["get"]
    while pred["status"] not in ("succeeded", "failed", "canceled"):
        time.sleep(2)
        pred = request("GET", url)
    if pred["status"] != "succeeded":
        raise SystemExit(f"{src.name}: {pred['status']} — {pred.get('error')}")
    out = pred["output"]
    out_url = out[0] if isinstance(out, list) else out
    out_req = urllib.request.Request(out_url, headers={"User-Agent": "safedrink-assets/1.0"})
    with urllib.request.urlopen(out_req, timeout=120) as res:
        dst.write_bytes(res.read())
    print(f"{src.name} → {dst} ({pred.get('metrics', {}).get('predict_time', '?')}s)")


def main(argv: list[str]) -> None:
    if len(argv) < 2 or len(argv) % 2:
        raise SystemExit(__doc__)
    for i in range(0, len(argv), 2):
        remove_background(Path(argv[i]), Path(argv[i + 1]))


if __name__ == "__main__":
    main(sys.argv[1:])
