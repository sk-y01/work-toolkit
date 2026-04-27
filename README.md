# Work Toolkit

엑셀 형태 UI 기반의 **업무 입력 정확도 훈련 웹 애플리케이션**.

- 배포 링크: <https://work-toolkitpp.vercel.app/>

> 단순 타자 연습이 아니라, 실제 업무에서 반복되는 "이름 · 소속 · 업무 내용" 같은 데이터를 그리드에 입력하며 **정확도 · 오류 · 속도** 를 측정하고, 틀린 셀만 골라 빠르게 수정하는 워크북 도구입니다.

---

## 주요 기능

- **엑셀 스타일 입력 훈련** — 헤더 · 행 번호 · 활성 셀 하이라이트로 익숙한 스프레드시트 인터페이스를 제공.
- **키보드 기반 셀 이동** — `Tab` 오른쪽, `Enter` 같은 열의 아래 셀, `↑/↓` 수직 이동, 마지막 셀에서 자동 래핑.
- **정확도 및 오류 관리** — 입력을 시도한 셀만 분모로 삼는 정확도 계산, 현재 남은 오류만 카운트.
- **오류 탐색 및 수정 UX** — "오류 N건" 클릭으로 오류 셀만 순환 이동, "오류 수정하기" 모드로 첫 오류부터 연속 수정.
- **업무 문장 변환 기능** — `Ctrl + /` 모달로 입력한 키워드를 보고용 문장으로 변환. 1차로 OpenAI API 를 호출하고, 키 미설정·네트워크 오류 등에서는 템플릿 기반 fallback 결과를 제공.
- **모바일 문장 변환 버튼** — 단축키를 쓰기 어려운 모바일 환경을 위해 우측 하단에 고정된 플로팅 버튼으로 동일 기능 제공.

---

## 기술 스택

- **React** (18) — 컴포넌트와 상태 관리
- **TypeScript** — 정적 타입으로 상태 전이/데이터 모델 검증
- **Vite** (5) — 개발 서버 / HMR / 빌드
- **Vercel** — 정적 호스팅 + `/api/*` 서버리스 함수 (OpenAI 키는 서버에서만 사용)
- **OpenAI API** — 문장 변환 모달의 보고용 표현 변환

---

## 환경변수 안내

OpenAI API 키는 **서버 사이드(`/api/convert`)에서만** 사용합니다. 프론트엔드 번들에는 절대 포함되지 않으며, `import.meta.env.VITE_OPENAI_API_KEY` 같은 방식도 사용하지 않습니다.

### 로컬 개발

프로젝트 루트에 `.env` 파일을 만들고 다음을 추가합니다.

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- `npm run dev` 실행 시 Vite 미들웨어가 `/api/convert` 요청을 받아 `api/convert.js` 핸들러로 연결합니다.
- 키가 없거나 호출이 실패하면 모달은 자동으로 **템플릿 기반 fallback 결과** 를 표시합니다.

### Vercel 배포

`.env` 는 **Git 에 커밋되지 않습니다** (`.gitignore` 에 포함). 배포 시에는 Vercel 대시보드에서 직접 등록합니다.

1. Vercel 프로젝트 → **Settings → Environment Variables**
2. `OPENAI_API_KEY` 키와 값을 등록 (Production / Preview / Development 중 필요한 환경 선택)
3. 재배포

`api/convert.js` 가 자동으로 Vercel Serverless Function 으로 인식되어 `/api/convert` 엔드포인트를 제공합니다.

> 중요: `.env` 파일을 절대 Git 에 올리지 마세요. 이미 `.gitignore` 에 등록되어 있습니다.

---

## 실행 방법

```bash
npm install
npm run dev
```

개발 서버가 `http://localhost:5173` 에서 실행됩니다.

## 빌드 방법

```bash
npm run build
```

빌드 산출물은 `dist/` 에 생성됩니다. 로컬에서 빌드 결과를 확인하려면:

```bash
npm run preview
```

> 참고: `npm run preview` 는 정적 파일만 서빙하므로 `/api/convert` 가 동작하지 않습니다.
> 서버리스 함수까지 로컬에서 테스트하려면 [Vercel CLI](https://vercel.com/docs/cli) 의 `vercel dev` 를 사용하거나, 그냥 `npm run dev` 로 Vite 개발 서버를 사용하세요.

---

## 폴더 구조 (요약)

```text
work_toolkit/
├── api/
│   └── convert.js              # /api/convert 서버리스 함수 (OpenAI 호출)
├── public/
├── src/
│   ├── App.tsx                 # 메인 상태/이동/완료/오류 흐름 + FAB
│   ├── components/
│   │   ├── ConverterModal.tsx  # 문장 변환 모달 (API + fallback)
│   │   ├── PracticeGrid.tsx
│   │   ├── PracticeCell.tsx
│   │   ├── WorkbookHeader.tsx
│   │   ├── StatusBar.tsx
│   │   ├── SummaryBar.tsx
│   │   ├── SheetTabs.tsx
│   │   └── AuthModal.tsx
│   ├── data/                   # sampleData, templates (fallback)
│   ├── hooks/
│   ├── lib/
│   ├── styles/
│   ├── types/
│   └── utils/                  # grid · converter · storage · time
├── vite.config.ts              # /api/* 로컬 dev 미들웨어 포함
├── vercel.json
├── package.json
└── README.md
```

---

## 향후 개선 사항

- [ ] 로그인
- [ ] 사용자별 기록 저장
- [ ] 랭킹
- [ ] 다중 사용자
- [ ] 파일 업로드
