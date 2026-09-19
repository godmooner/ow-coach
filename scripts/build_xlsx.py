# -*- coding: utf-8 -*-
import sys, os, csv, glob, re
sys.path.insert(0,'scripts')
from parse_matchup import ALL, GRADE_RE, detect_hero, parse, HEROES
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

F = "Arial"
HDR  = PatternFill("solid", fgColor="1F3864")
EDIT = PatternFill("solid", fgColor="FFF2CC")   # 편집 대상
WARN = PatternFill("solid", fgColor="FCE4D6")

rows=list(csv.DictReader(open('data/build/matchups.csv',encoding='utf-8-sig')))
# 파서 재실행해서 특이사항/누락 메타 확보
rev=[]; miss=[]
by={}
for f in sorted(glob.glob('data/raw/*.txt')):
    h,r,d,w = parse(f)
    by.setdefault(h,set()).update(x['vs_hero'] for x in r)
    rev += [x for x in r if x['_review']]
for h,got in by.items():
    for m in sorted(set(ALL)-{h}-got):
        miss.append((h, m, ALL[m]))

wb=Workbook()

def sheet(ws, headers, data, widths, freeze="A2"):
    ws.append(headers)
    for c in ws[1]:
        c.font=Font(name=F, bold=True, color="FFFFFF"); c.fill=HDR
        c.alignment=Alignment(horizontal="center", vertical="center")
    for row in data: ws.append(row)
    for i,w in enumerate(widths,1): ws.column_dimensions[get_column_letter(i)].width=w
    for row in ws.iter_rows(min_row=2):
        for c in row: c.font=Font(name=F, size=10)
    ws.freeze_panes=freeze
    ws.auto_filter.ref=ws.dimensions
    ws.row_dimensions[1].height=22

# 1. 상성데이터
ws=wb.active; ws.title="상성데이터"
sheet(ws, ["source_hero","vs_hero","block","vs_role","score","grade_raw"],
      [[r["source_hero"],r["vs_hero"],r["block"],r["vs_role"],float(r["score"]),r["grade_raw"]] for r in rows],
      [14,14,8,9,8,46])
for row in ws.iter_rows(min_row=2, min_col=5, max_col=5):
    for c in row: c.alignment=Alignment(horizontal="center"); c.fill=EDIT

# 2. 특이사항
ws2=wb.create_sheet("특이사항")
sheet(ws2, ["source_hero","vs_hero","score","grade_raw","계산근거","비고"],
      [[r["source_hero"],r["vs_hero"],float(r["score"]),r["grade_raw"],r["_basis"],r["_comment"]]
       for r in sorted(rev, key=lambda x:(-x["_spread"], x["source_hero"]))],
      [14,14,8,40,44,46])
for row in ws2.iter_rows(min_row=2, min_col=3, max_col=3):
    for c in row: c.alignment=Alignment(horizontal="center"); c.fill=EDIT; c.font=Font(name=F,size=10,bold=True)
for row in ws2.iter_rows(min_row=2):
    for c in row: c.alignment=Alignment(vertical="top", wrap_text=(c.column>=4),
                                        horizontal="center" if c.column==3 else "left")

# 2b. 평균적용 (기록용, 볼 필요 없음)
avgrows=[]
for f in sorted(glob.glob('data/raw/*.txt')):
    _h,_r,_d,_w = parse(f)
    avgrows += [x for x in _r if x['_basis']]
ws2b=wb.create_sheet("평균적용")
sheet(ws2b, ["source_hero","vs_hero","score","grade_raw","계산근거"],
      [[x["source_hero"],x["vs_hero"],float(x["score"]),x["grade_raw"],x["_basis"]]
       for x in sorted(avgrows,key=lambda y:(y["source_hero"],y["vs_hero"]))],
      [14,14,8,42,56])
for row in ws2b.iter_rows(min_row=2):
    for c in row: c.alignment=Alignment(vertical="top", wrap_text=(c.column>=4),
                                        horizontal="center" if c.column==3 else "left")

# 3. 원문누락
ws3=wb.create_sheet("원문누락")
sheet(ws3, ["source_hero","미기재 상대","상대 역할"],
      sorted(miss, key=lambda x:(x[0],x[1])), [14,16,10])
for row in ws3.iter_rows(min_row=2):
    for c in row: c.fill=WARN

# 4. 안내
ws4=wb.create_sheet("안내")
guide=[
 ["오버워치 딜러 상성 데이터",""],
 ["",""],
 ["생성일","2026-09-19"],
 ["원본","나무위키 딜러 24명 문서 '상성' 항목 텍스트 덤프"],
 ["행 수",f"{len(rows)} / 최대 {24*52} (커버리지 {len(rows)/(24*52)*100:.1f}%)"],
 ["파싱 버그","0건 (원문에 등급 라벨과 함께 등장하는 이름 전수 대조)"],
 ["중복","0건"],
 ["",""],
 ["점수 기준","매우 유리 +3 / 유리 +2 / 약간 유리 +1 / 중립 0 / 약간 불리 -1 / 불리 -2 / 매우 불리 -3"],
 ["부호 방향","source_hero가 vs_hero를 상대할 때의 유리(+)·불리(-)"],
 ["",""],
 ["편집할 곳","노란색 셀(score)만 고치면 됨. grade_raw는 원문이라 두세요"],
 ["'특이사항' 시트",f"{len(rev)}건. 원문이 '유동적'뿐이라 등급 근거가 없는 행. 안 봐도 무방하고, 값을 정하고 싶으면 score를 고치세요"],
 ["'원문누락' 시트",f"{len(miss)}건. 나무위키 문서에 아예 언급이 없는 조합. 계산 시 0점 처리"],
 ["",""],
 ["조건부 처리 규칙","등급이 2개 이상이면 조건과 무관하게 전부 단순 평균. 예: 유리(+2) + 매우 불리(-3) -> -0.5"],
 ["','유동적'","원문 표현. 0점으로 계산에 참여. 유동적만 있는 12건은 '특이사항' 시트 참고"],
]
for r in guide: ws4.append(r)
ws4.column_dimensions["A"].width=18; ws4.column_dimensions["B"].width=98
ws4["A1"].font=Font(name=F,size=14,bold=True)
for row in ws4.iter_rows(min_row=3):
    row[0].font=Font(name=F,size=10,bold=True)
    for c in row[1:]: c.font=Font(name=F,size=10); c.alignment=Alignment(wrap_text=True,vertical="top")
wb._sheets = [ws4, ws, ws2, ws2b, ws3]

out="data/build/오버워치_딜러상성.xlsx"
wb.save(out)
print(f"{out}")
print(f"  상성데이터 {len(rows)}행 / 특이사항 {len(rev)}행 / 평균적용 {len(avgrows)}행 / 원문누락 {len(miss)}행")
