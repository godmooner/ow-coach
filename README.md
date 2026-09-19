# OW Coach

내 역할군(탱커·딜러·힐러)을 고르고 상대 탱커 1명·딜러 2명·힐러 2명을 선택하면, 선택한 역할의 상위 3명을 보여주는 MVP 0.4입니다. 역할을 바꿔도 상대 선택은 유지됩니다. 영웅 53명의 초상화를 포함합니다.

## 바로 사용하기

전달된 `OW_Coach.html`을 내려받아 Chrome 또는 Edge에서 열면 됩니다. 설치와 인터넷 연결이 필요하지 않습니다. 초상화를 눌러 선택하고 다시 누르거나 위쪽 선택 슬롯을 누르면 해제됩니다. 5명이 모두 선택되면 결과가 자동으로 나타납니다.

## 개발 실행

Node.js 24와 npm을 설치한 환경에서 프로젝트 폴더를 열고 실행합니다.

```sh
npm ci
npm run dev
```

터미널에 표시된 주소를 브라우저로 엽니다. 다음 AI는 이 파일과 `STATE.md`, 수정할 실제 파일부터 읽으면 됩니다.

## 수정할 파일

| 파일 | 역할 |
|---|---|
| `src/App.tsx`, `src/style.css` | 화면과 선택 동작 |
| `src/recommend.ts` | 소수 점수 합산, 미입력 0점, 동점 정렬 |
| `data/build/heroes.json` | 영웅 ID·이름·역할·초상화 경로 |
| `data/build/matchups.json` | 앱이 직접 사용하는 상성표 |
| `data/build/matchups.csv` | 사람이 표로 편집하는 상성표 |
| `public/portraits/` | 53명 초상화 |
| `data/build/portrait_sources.json` | 공식 초상화 출처와 ID 대응 |

간단한 점수 수정은 `data/build/matchups.json`에서 합니다. 구조는 `{영웅id: {상대id: 점수}}`입니다. **0.4에서 JSON만 53명·2,754개 관계로 교체했습니다. 기존 CSV·XLSX·원문/파서는 0.3 자료이므로, 새 데이터와 동기화하기 전에는 아래 변환 및 원문 재생성을 실행하지 마세요.** 동기화된 CSV를 편집한 경우 다음 명령으로 JSON에 적용할 수 있습니다.

```sh
npm run data:from-csv
```

JSON 직접 편집과 CSV 편집을 동시에 진행하지 마세요. CSV 변환은 JSON을 다시 만듭니다. XLSX는 참고 자료이며, XLSX만 고치면 앱에는 반영되지 않습니다. 표로 편집하려면 CSV의 `score`를 수정한 뒤 위 명령을 사용합니다.

원문에서 다시 생성할 때는 `python3 scripts/parse_matchup.py data/raw`를 실행합니다. 원문 재생성은 수동으로 수정한 점수를 덮어씁니다. 기존 원문과 파서는 보존했습니다.

## 계산 규칙

매우 유리 +3 / 유리 +2 / 약간 유리 +1 / 중립 0 / 약간 불리 −1 / 불리 −2 / 매우 불리 −3. `유동적`은 0점이며 조건부 평균으로 만들어진 소수 점수를 그대로 사용합니다. 점수는 후보 영웅이 상대를 만났을 때 기준입니다.

원문에 없는 관계와 같은 영웅 관계는 계산할 때 0점입니다. 누락 때문에 후보를 제외하지 않습니다. 동점은 같은 순위로 표시하고 `heroes.json`의 순서로 나열합니다. 내가 탱커일 때만 상대 탱커 항을 3배로 계산하며, 딜러·힐러는 단순 합산합니다. 맵·아군 보정은 포함하지 않습니다.

영웅 ID는 내부 식별자이므로 공식 URL과 같을 필요가 없습니다. `freya` → 공식 `freja`, `sion` → 공식 `shion` 등은 초상화 다운로드 단계에서 대응합니다. 기존 JSON·CSV 연결은 유지했습니다.

## 확인과 배포 파일 생성

```sh
npm test
npm run build
npm run portable
```

`dist/`에는 웹 배포용 파일이, `release/OW_Coach.html`에는 더블클릭 실행용 단일 파일이 생성됩니다. 점수나 코드를 바꾸면 다시 생성해야 합니다. 테스트는 계산 규칙과 0.3 기준 결과를 확인합니다. 실제 데이터를 갱신할 때에는 `STATE.md`의 회귀 기준과 신규 데이터 기준 결과도 함께 검토하세요.

## GitHub Pages

1. 프로젝트 내용을 GitHub 저장소의 `main` 브랜치에 올립니다. `node_modules`, `dist`, `release`는 제외합니다.
2. Settings → Pages → Source에서 GitHub Actions를 선택합니다.
3. 이후 `main`에 변경을 올리면 포함된 `.github/workflows/deploy.yml`이 검사·빌드·배포합니다.

기존 0.3은 [GitHub Pages](https://godmooner.github.io/ow-coach/)에 배포되어 있습니다. 0.4의 검증·반영 상태는 `STATE.md`를 참고하세요. 파일 경로는 저장소 하위 경로에도 맞게 상대 경로로 처리합니다. [Vite 배포 안내](https://vite.dev/guide/static-deploy#github-pages)

상성 데이터는 제공된 나무위키 추출 자료이며, 초상화는 [오버워치 공식 영웅 페이지](https://overwatch.blizzard.com/en-us/heroes/)에서 확보했습니다. 비공식 팬 도구이며 영웅 이미지 권리는 Blizzard Entertainment에 있습니다.

화면 글꼴은 Noto Sans KR의 필요한 글자를 포함한 버전이며, SIL Open Font License는 `public/licenses/OFL_NotoSansKR.txt`에 있습니다.
