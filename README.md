# Work Toolkit

<p align="center">
  <img src="./public/logo.svg" width="120" />
</p>

엑셀 형태 UI 기반의 **업무 입력 정확도 훈련 + 보고용 문장 변환 웹 애플리케이션**.

- 배포 링크: <https://work-toolkit-web.vercel.app/>

> 단순 타자 연습이 아니라, 실제 업무에서 반복되는 "이름 · 소속 · 업무 내용"
> 같은 데이터를 그리드에 입력하며 **정확도 · 오류 · 속도** 를 측정하고,
> 자주 쓰는 키워드를 보고용 한 줄 문장으로 즉시 다듬어 주는 워크북 도구입니다.

---

## 프로젝트 배경

행정/사무 업무에서는 **정형 데이터의 빠르고 정확한 입력**과
**짧은 키워드를 보고서 톤의 한 문장으로 다듬는 작업**이 반복됩니다.

- 단순 타자 연습은 실제 업무 입력 패턴(이름·소속·날짜·코드)에는 잘 맞지 않습니다.
- 짧은 키워드("서류 정리")를 보고용 문장("문서 분류 및 정리 업무 수행")으로 다듬는 일은 꼭 필요합니다.

Work Toolkit 은 이 두 가지 작업을 한 화면에서 빠르게 훈련/처리할 수 있도록
**엑셀 스타일 UI + 키보드 중심 흐름 + AI 보조 변환**을 한데 묶었습니다.

---

## 핵심 기능

| 기능 | 설명 |
| --- | --- |
| **엑셀 입력 UI** | 헤더 · 행 번호 · 활성 셀 하이라이트의 익숙한 스프레드시트 인터페이스 |
| **키보드 인터랙션** | `Tab` 오른쪽, `Enter` 같은 열의 아래, `↑/↓` 수직, 마지막 셀 자동 래핑 |
| **고스트 텍스트** | 입력 중에도 다음 입력 값을 연하게 표시하여 긴 문장 입력 시에도 흐름을 잃지 않도록 보조 |
| **오류 관리 UX** | "오류 N건" 클릭으로 오류만 순환 이동, "오류 수정하기" 모드로 첫 오류부터 연속 수정 |
| **모바일 대응** | 단축키 대체 "제출" 버튼, 우측 하단 플로팅 "문장 변환" 버튼 |
| **문장 변환** | `Ctrl + /` 모달로 입력 키워드 → 보고용 한 문장. OpenAI API 우선, 실패/한도 초과 시 템플릿 fallback |
| **다크모드** | 헤더의 Moon/Sun 토글로 즉시 전환, localStorage 에 모드 보존 |
| **시트 확장** | Sheet1(이름/소속/업무), Sheet2(날짜/가격/코드) 두 가지 입력 시나리오를 탭으로 전환 |
| **온보딩 도움말** | 최초 진입 시 자동 안내, 이후에는 헤더의 ? 아이콘으로 언제든 다시 보기 |
| **피드백 진입점** | 우측 하단 텍스트 링크 — 어느 화면에서든 즉시 의견 전달 가능 |

---

## 핵심 구현 포인트

### 1. 시트 단위 상태 격리

각 시트(`Sheet1`, `Sheet2`)는 그리드/활성 셀/시작 시각/완료 플래그까지 모두 **독립 상태**로
관리되어, 탭을 전환해도 상대 시트의 진행도/타이머가 보존됩니다.
이를 `Record<sheetId, SheetState>` 와 `useState` 한 곳으로 묶어 단일 컴포넌트(`App.tsx`)에서
관리합니다.

### 2. 키보드 중심 셀 이동 + 자동 평가

`Enter` / `Tab` / 화살표 입력을 한 곳(`App.move()`)에서 처리하고,
**이동 직전에 셀을 커밋(평가)** 하여 같은 프레임에 완료/오류 탐색 판단까지 끝냅니다.
오류 수정 모드에서는 같은 `Enter` 가 "다음 오류 셀로 점프" 의미로 재해석되어,
사용자는 동일 단축키로 자연스럽게 모드 전환을 체감합니다.

### 3. 정확도 = 정답 / 평가된 셀

비어 있는 셀은 분모에서 제외하여 **시도한 만큼만 평가** 합니다.
입력 한 글자 없는 초기 화면이 정확도 0% 로 표시되는 문제를 피하고,
"맞춘 만큼이 곧 정확도" 라는 직관에 맞춥니다.

### 4. 완료 1회 전이

`isAllAttempted` 가 만족되는 순간, 시트별 `completionSaved` 플래그를 검사하여
완료 카드 표시와 통계 저장(`appendRecord`) 을 **딱 한 번만** 실행합니다.
완료 후 사용자가 셀을 다시 수정해 오류가 발생하면 카드 자체는 유지되고
표기만 "오류 수정 중" 으로 바뀝니다. 데이터 저장은 다시 일어나지 않습니다.

### 5. AI 변환 + 템플릿 fallback + 일일 한도

문장 변환은 `/api/convert` 서버리스 함수를 통해 **서버에서만** OpenAI API 키를 사용합니다.
프론트는 `localStorage` 에 하루 단위 사용 횟수(`work_toolkit_ai_usage`) 를 기록하며,
한도(5회)를 넘으면 **API 호출 자체를 건너뛰고** 템플릿 기반 fallback 결과만 보여줍니다.
이 한도는 보안용이 아니라 MVP UX 가드(과다 호출 방지) 역할이며, 실제 키 보호와 호출 제한은
서버 환경변수 + OpenAI 측에서 수행합니다.

### 6. 다크모드 = CSS 토큰 재정의

라이트/다크 팔레트를 모두 **동일한 변수 토큰**(`--bg`, `--panel`, `--text` …) 위에 작성해,
`<html data-theme="dark">` 한 줄로 전체 UI 가 일관되게 전환됩니다.
`useDarkMode` 훅이 토글/저장(localStorage)/DOM 반영을 한꺼번에 담당합니다.

### 7. 모바일 / PC 안내 분기

`useIsMobile` 훅(`max-width: 900px` 미디어 쿼리)으로 도움말 본문을 분기하고,
모바일에서만 상단 "제출" 버튼과 우측 하단 플로팅 변환 버튼을 노출합니다.
PC 에서만 의미 있는 단축키 안내(모달 하단)는 모바일에서 CSS 만으로 깔끔하게 숨깁니다.

---

## 기술 스택

- **React 18** — 함수형 컴포넌트 + `useState` / `useEffect` / `useMemo` / `useCallback`
- **TypeScript** — 정확도/이동/완료 상태 전이를 모두 타입으로 검증
- **Vite 5** — 개발 서버, HMR, 빌드, 로컬 `/api/*` 미들웨어
- **Vercel** — 정적 호스팅 + Serverless Functions (`api/convert.js`)
- **OpenAI API** (`gpt-4o-mini`) — 보고용 문장 변환
- **Supabase** *(옵션)* — 향후 사용자 인증/기록 저장 확장에 대비한 베이스 구성
- **lucide-react** — 헤더 도움말/테마 토글 아이콘
- **CSS Modules** — 컴포넌트 단위 스타일 격리, 다크모드는 CSS 변수 재정의 한 곳에서 관리

---

## 폴더 구조

```text
work_toolkit/
├── api/
│   └── convert.js              # /api/convert 서버리스 함수 (OpenAI 호출)
├── public/
│   ├── logo.svg
│   └── favicon.png
├── src/
│   ├── App.tsx                 # 메인 상태/이동/완료/오류 흐름, 시트 전환, 모달 관리
│   ├── App.module.css
│   ├── main.tsx
│   ├── components/
│   │   ├── WorkbookHeader.tsx  # 로고/도움말/다크모드/계정
│   │   ├── StatusBar.tsx       # 셀·시간·정확도 + 초기화/제출(모바일)
│   │   ├── PracticeGrid.tsx    # 그리드 + 키보드 핸들러
│   │   ├── PracticeCell.tsx    # ghost 텍스트 오버레이 셀
│   │   ├── SummaryBar.tsx      # 완료 행/오류/완료율/최고 정확도
│   │   ├── SheetTabs.tsx       # Sheet1 / Sheet2 / +
│   │   ├── ConverterModal.tsx  # 문장 변환 (API + fallback + 일일 한도)
│   │   ├── HelpModal.tsx       # 온보딩/도움말 (PC·모바일 분기)
│   │   └── AuthModal.tsx       # 로그인/회원가입 (Supabase)
│   ├── data/
│   │   ├── sampleData.ts       # SHEETS — Sheet1·Sheet2 컬럼/데이터
│   │   └── templates.ts        # 변환 fallback 템플릿
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useDarkMode.ts
│   │   └── useIsMobile.ts
│   ├── lib/
│   │   ├── supabase/
│   │   └── api/
│   ├── styles/
│   │   └── index.css           # 토큰(라이트/다크) + 공용 버튼/kbd
│   ├── types/
│   └── utils/
│       ├── grid.ts             # 정확도/오류/완료 판정/셀 평가
│       ├── converter.ts        # 템플릿 매칭 fallback
│       ├── storage.ts          # 통계 localStorage
│       ├── aiUsage.ts          # AI 변환 일일 한도 (localStorage)
│       └── time.ts
├── vite.config.ts              # /api/* 로컬 dev 미들웨어 포함
├── vercel.json
├── tsconfig.json
├── package.json
└── README.md
```

---

## 실행 방법

```bash
npm install
npm run dev
```

개발 서버는 기본적으로 `http://localhost:5173` 에서 실행됩니다.
Vite 미들웨어가 `/api/convert` 요청을 받아 `api/convert.js` 핸들러로 전달하므로,
별도의 백엔드 실행 없이도 변환 모달이 동작합니다.

### 빌드 / 미리보기

```bash
npm run build
npm run preview
```

빌드 산출물은 `dist/` 에 생성됩니다.
`npm run preview` 는 정적 서빙만 수행하므로 `/api/convert` 는 동작하지 않습니다.
서버리스 함수까지 로컬에서 시뮬레이션하려면 `npm run dev` 또는 [Vercel CLI](https://vercel.com/docs/cli) 의 `vercel dev` 를 사용하세요.

---

## 환경변수 안내

OpenAI API 키는 **서버 사이드(`/api/convert`) 에서만** 사용합니다.
프론트엔드 번들에는 절대 포함되지 않으며, `import.meta.env.VITE_OPENAI_API_KEY` 같은 노출 방식도 사용하지 않습니다.

### 로컬 개발

프로젝트 루트의 `.env` (Git 제외) 에 다음 항목을 추가합니다.

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# (선택) 로그인/기록 저장 확장 시
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=ey...
```

키가 없거나 호출이 실패하면 변환 모달은 자동으로 **템플릿 기반 fallback** 결과를 표시합니다.

### Vercel 배포

`.env` 는 Git 에 커밋되지 않으므로, 배포 환경에서는 Vercel 대시보드의
**Settings → Environment Variables** 에 직접 등록한 뒤 재배포합니다.

`api/convert.js` 가 자동으로 Vercel Serverless Function 으로 인식되어
`/api/convert` 엔드포인트로 노출됩니다.

> 중요: `.env` 파일을 절대 Git 에 올리지 마세요. 이미 `.gitignore` 에 등록되어 있습니다.

---

## AI 변환 일일 한도

`localStorage` 키 `work_toolkit_ai_usage` 에 다음 형태로 기록됩니다.

```json
{ "date": "2026-04-29", "count": 0 }
```

- 하루 5회까지 OpenAI API 를 호출하고, 성공한 호출만 카운트합니다.
- 한도 초과 시 API 를 호출하지 않고 안내 문구와 함께 템플릿 fallback 결과를 보여줍니다.
- 날짜가 바뀌면 자동으로 카운트가 0 으로 초기화됩니다.

> 이 한도는 **보안용이 아닌 MVP UX 용 가드** 입니다.
> 실제 키 보호와 호출 제한은 서버 환경변수 + OpenAI 측에서 수행합니다.

---

## 확장 계획

- **Supabase 기반 사용자별 한도** — 디바이스 단위(localStorage) 가 아닌 계정 단위로 관리
- **데이터 저장** — 시트별 입력 기록과 정확도/속도 추이를 사용자 계정에 누적 저장
- **랭킹** — 누적 기록 기반의 부서/팀 단위 입력 정확도/속도 보드
- **시트 추가/편집** — 현재 "+" 버튼은 안내만 노출, 사용자 정의 시트 생성 지원/파일 업로드 기반 입력 훈련

---

## 업데이트 내역

### v1.0
- Supabase 기반 로그인 기능 구현 (Google 인증)
- OpenAI 기반 업무 문장 변환 기능 적용
- 엑셀 형태 입력 UI 및 키보드 기반 이동 로직 구현
- 입력 정확도 및 오류 처리 기능 구현

### v1.1 (현재)
- 모바일 환경에서 사용성을 개선하기 위해 제출 버튼 추가
- 라이트 / 다크 모드 전환 기능 추가 (설정 유지)
- 처음 사용자 안내를 위한 온보딩 도움말 모달 추가(PC/Mobile)
- 새로고침 시 선택된 시트 상태 유지 기능 추가