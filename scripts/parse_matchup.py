#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
나무위키 영웅 문서 텍스트 덤프 -> matchups.csv + review.md
모델 호출 없음. 전부 결정론적 파싱.
사용법: parse_matchup.py <파일|디렉터리> [영웅명]
"""
import re, sys, json, csv, os
from collections import Counter

HEROES = {
 "탱커": ["D.Mon","D.Va","도미나","둠피스트","해저드","정커퀸","마우가","오리사",
        "라마트라","라인하르트","로드호그","시그마","윈스턴","레킹볼","자리야"],
 "딜러": ["안란","애쉬","바스티온","캐서디","에코","엠레","프레야","겐지","한조","정크랫",
        "메이","파라","리퍼","시온","시에라","소전","솔저: 76","솜브라","시메트라",
        "토르비욘","트레이서","벤데타","벤처","위도우메이커"],
 "힐러": ["아나","바티스트","브리기테","일리아리","제트팩 캣","주노","키리코","라이프위버",
        "루시우","메르시","미즈키","모이라","우양","젠야타"],
}
ALL = {h: r for r, hs in HEROES.items() for h in hs}
HERO_ID = json.loads(open(os.path.join(os.path.dirname(__file__),"..","data","build","heroes.json"),encoding="utf-8").read()) if os.path.exists(os.path.join(os.path.dirname(__file__),"..","data","build","heroes.json")) else {}
HERO_ID = {h["name_ko"]: h["id"] for h in HERO_ID}

# 파일명 표기 흔들림 흡수 (콜론/공백/마침표는 윈도우 파일명에서 자주 깨짐)
def norm_key(x):
    return re.sub(r"[\s:.\-_·]", "", x).lower()
ALIAS = {norm_key(h): h for h in ALL}
ALIAS.update({norm_key(k): v for k, v in {
    "솔저76":"솔저: 76","솔저":"솔저: 76","soldier76":"솔저: 76",
    "dva":"D.Va","디바":"D.Va","dmon":"D.Mon","디몬":"D.Mon",
    "젯팩캣":"제트팩 캣","제트팩캣":"제트팩 캣","위도우":"위도우메이커",
    # 실제 업로드에서 관측된 표기 변형
    "솔져":"솔저: 76","솔져76":"솔저: 76","soldier":"솔저: 76",
    "정크렛":"정크랫","정크랏":"정크랫",
    # 흔한 축약/이표기
    "시메":"시메트라","트레":"트레이서","라인":"라인하르트","레킹":"레킹볼",
    "돼지":"로드호그","호그":"로드호그","윈스":"윈스턴","맥크리":"캐서디",
    "바티":"바티스트","브리":"브리기테","젠야":"젠야타","루시오":"루시우",
}.items()})

# ── 등급: 7단계, -3 ~ +3 ───────────────────────────────────
GRADE_SCORE = {
    "매우 유리": 3, "유리": 2, "약간 유리": 1, "중립": 0,
    "약간 불리": -1, "불리": -2, "매우 불리": -3,
    "유동적": 0,          # 원문 표현. 중립과 구분하기 위해 항상 검토 플래그
}
FLUID = {"유동적"}
# 최장일치 우선 ("매우 유리" 전에 "유리"가 잡히면 안 됨)
GRADE_RE = re.compile("(" + "|".join(sorted(map(re.escape, GRADE_SCORE), key=len, reverse=True))
                      + r")\s*(?:\(([^)]*)\))?")

# ── 조건 일반성 순위 (낮을수록 우선 채택) ──────────────────
RANK_KW = {
    0: ["팀파이트", "팀전", "한타", "다인전"],              # 사용자 지정 최우선
    2: ["평상시", "상시", "일반", "기본", "대체로", "평소", "그 외", "그외",
        "수색", "옴닉"],                                  # 일반 상황 + 영웅 기본 형태
    3: ["대인전", "1대1", "일대일", "단독", "근접", "원거리", "중거리", "장거리",
        "근거리", "교전", "공격", "수비"],                  # 공/수는 양쪽 다 발생 -> 동순위 평균
    4: ["특전", "궁극기", "용검", "운영", "사용", "발동", "각성", "화상", "방벽",
        "변신", "장전", "강습", "네메시스", "포진"],          # 일시적/전환 상태
}
RANK_NAME = {0:"팀파이트", 1:"무조건", 2:"일반상황", 3:"특정교전", 4:"조건부"}

def cond_rank(cond):
    """조건 문자열 -> (순위, 미등록여부)"""
    if not cond: return 1, False              # 조건 없음 = 무조건
    for r in (0, 2, 3, 4):
        if any(k in cond for k in RANK_KW[r]): return r, False
    return 3, True                            # 미등록 -> 특정교전으로 추정 + 플래그

SECTION_RE = re.compile(r"^\d+(?:\.\d+)?\.\s*(상성|궁합|돌격|공격|지원)\s*\[편집\]")
ROLE_MAP = {"돌격":"탱커","공격":"딜러","지원":"힐러"}
_N = "|".join(sorted(map(re.escape, ALL), key=len, reverse=True))
_G = "|".join(sorted(map(re.escape, GRADE_SCORE), key=len, reverse=True))
# 1) "영웅명 - 등급" / "vs 영웅명 - 등급"  2) 대시 없는 "영웅명 등급" (등급 즉시 시작만 허용)
HEADER_DASH   = re.compile(rf"^\s*(?:vs\.?\s*)?({_N})\s*[-–—]\s*(.+?)\s*$")
HEADER_NODASH = re.compile(rf"^\s*(?:vs\.?\s*)?({_N})\s+((?:{_G}).*?)\s*$")
def HEADER_MATCH(s):
    return HEADER_DASH.match(s) or HEADER_NODASH.match(s)
class _HR:
    match = staticmethod(HEADER_MATCH)
HEADER_RE = _HR()

def collapse(grades):
    """등급이 여러 개면 그냥 전부 평균. 조건 우선순위 규칙 없음."""
    score = sum(g["score"] for g in grades) / len(grades)
    notes = []
    # 정보가 '유동적' 하나뿐이면 등급 근거가 사실상 없음 -> 그것만 표시
    if all(g["label"] in FLUID for g in grades):
        notes.append("원문이 '유동적'뿐 → 0점 기본값. 원하면 직접 지정")
    info = ""
    if len(grades) > 1:
        info = f'{len(grades)}개 평균 = ' + " , ".join(
            f'{g["label"]}({g["score"]:+d})' + (f'@{g["cond"]}' if g["cond"] else "")
            for g in grades)
    rule = "single" if len(grades) == 1 else f"avg{len(grades)}"
    return round(score, 2), rule, notes, info

def detect_hero(path, lines):
    """1행이 영웅명이면 그것을, 아니면 파일명을 사용"""
    if lines:
        c = ALIAS.get(norm_key(lines[0].strip()))
        if c: return c, "1행"
    c = ALIAS.get(norm_key(os.path.splitext(os.path.basename(path))[0]))
    if c: return c, "파일명"
    return None, None

def parse(path, forced=None):
    lines = open(path, encoding="utf-8").read().splitlines()
    hero, how = (forced, "지정") if forced else detect_hero(path, lines)
    if not hero:
        return None, [], {}, [f"{os.path.basename(path)}: 영웅명 식별 실패 (1행·파일명 모두 미인식)"]
    rows, descs, warns, block, role = [], {}, [], None, None
    seen = set()
    for i, line in enumerate(lines):
        s = line.strip()
        m = SECTION_RE.match(s)
        if m:
            k = m.group(1)
            if k in ("상성", "궁합"): block = k
            else: role = ROLE_MAP[k]
            continue
        h = HEADER_RE.match(s)
        if not h: continue
        vs, tail = h.group(1), h.group(2)
        if vs == hero: continue
        found = GRADE_RE.findall(tail)
        if not found: continue
        b = block or "상성"
        if (b, vs) in seen:
            warns.append(f"{hero} vs {vs}: {b} 중복 항목 (line {i+1}) → 첫 항목 유지")
            continue
        seen.add((b, vs))
        grades = [{"label": g, "cond": (c or "").strip(), "score": GRADE_SCORE[g]}
                  for g, c in found]
        score, rule, notes, info = collapse(grades)
        desc = lines[i+1].strip() if i+1 < len(lines) else ""
        rows.append({
            # ── CSV로 나가는 6컬럼 ──
            "source_hero": hero, "vs_hero": vs, "block": b,
            "vs_role": ALL.get(vs, role or ""),
            "score": score, "grade_raw": tail,
            # ── review.md 생성용 (CSV 미포함, _ 접두) ──
            "_spread": max(g["score"] for g in grades) - min(g["score"] for g in grades),
            "_review": int(bool(notes)), "_basis": info,
            "_comment": " / ".join(notes), "_line": i + 1,
        })
        if desc and not HEADER_RE.match(desc) and not SECTION_RE.match(desc):
            descs[f"{hero}|{b}|{vs}"] = desc
    # 커버리지 경고
    for b in {r["block"] for r in rows}:
        got = {r["vs_hero"] for r in rows if r["block"] == b}
        miss = sorted(set(ALL) - {hero} - got)
        if miss:
            warns.append(f"{hero} [{b}] 미기재 {len(miss)}명: {', '.join(miss)}")
    return hero, rows, descs, warns

if __name__ == "__main__":
    target = sys.argv[1]
    forced = sys.argv[2] if len(sys.argv) > 2 else None
    files = ([os.path.join(target, f) for f in sorted(os.listdir(target)) if f.endswith(".txt")]
             if os.path.isdir(target) else [target])
    rows, descs, warns, done = [], {}, [], []
    for f in files:
        h, r, d, w = parse(f, forced if len(files) == 1 else None)
        if h: done.append((h, len(r)))
        rows += r; descs.update(d); warns += w
        print(f"  {(h or os.path.basename(f)):<12} {len(r):>4}행" + (" ⚠" if w else ""))
        if h and not r:   # 0행이면 포맷 진단용으로 등급 라벨 줄 샘플 출력
            import itertools
            samp = [l.strip()[:70] for l in open(f, encoding="utf-8")
                    if GRADE_RE.search(l) and len(l.strip()) < 60]
            for x in itertools.islice(samp, 3): print(f"       ? {x}")

    os.makedirs("data/build", exist_ok=True)
    CSV_COLS = ["source_hero", "vs_hero", "block", "vs_role", "score", "grade_raw"]

    # 엑셀에서 한글이 깨지지 않도록 BOM 포함(utf-8-sig)
    with open("data/build/matchups.csv", "w", newline="", encoding="utf-8-sig") as fp:
        w_ = csv.DictWriter(fp, fieldnames=CSV_COLS, extrasaction="ignore")
        w_.writeheader(); w_.writerows(rows)

    # 앱용: { source_id: { vs_id: score } }
    app = {}
    for r in rows:
        if r["block"] != "상성": continue
        app.setdefault(HERO_ID[r["source_hero"]], {})[HERO_ID[r["vs_hero"]]] = r["score"]
    json.dump(app, open("data/build/matchups.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1, sort_keys=True)

    json.dump(descs, open("data/build/descriptions.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    rev = [r for r in rows if r["_review"]]
    with open("data/build/review.md", "w", encoding="utf-8") as fp:
        fp.write(f"# 특이사항 — {len(rev)} / {len(rows)}행 ({len(rev)/max(len(rows),1)*100:.1f}%)\n\n")
        fp.write("matchups.csv의 `score`를 수정한 뒤 `python3 scripts/csv_to_json.py`로 앱용 JSON에 반영합니다.\n\n")
        fp.write("| 영웅 | 구분 | 상대 | 점수 | 원문 | 채택기준 | 사유 |\n|---|---|---|---|---|---|---|\n")
        for r in sorted(rev, key=lambda x: (-x["_spread"], x["source_hero"])):
            fp.write(f"| {r['source_hero']} | {r['block']} | {r['vs_hero']} | **{r['score']:+g}** "
                     f"| `{r['grade_raw']}` | {r['_basis']} | {r['_comment']} |\n")
        if warns:
            fp.write(f"\n## 파일 단위 경고 ({len(warns)})\n\n")
            for w in warns: fp.write(f"- {w}\n")

    print(f"\n총 {len(rows)}행 / 문서 {len(done)}개 / 특이사항 {len(rev)}건 / 경고 {len(warns)}건")
    print(f"  data/build/matchups.csv   ({len(CSV_COLS)}컬럼)")
    print(f"  data/build/matchups.json  (앱용)")
    print(f"  data/build/review.md      (특이사항)")
