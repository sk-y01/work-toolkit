import type { ColumnDef } from "../types";

// 한 시트 단위의 정의. 시트별로 컬럼/데이터가 독립적으로 보존되어
// 사용자가 시트 탭을 전환해도 각자의 입력/통계 흐름을 따로 유지할 수 있다.
export type SheetDef = {
  id: string;
  label: string;
  columns: ColumnDef[];
  data: string[][];
};

const SHEET1_COLUMNS: ColumnDef[] = [
  { key: "name", label: "이름", width: 140 },
  { key: "team", label: "소속", width: 180 },
  { key: "task", label: "업무 내용", width: 260 },
];

const SHEET1_DATA: string[][] = [
  ["홍길동", "행정지원팀", "서류 정리"],
  ["김민수", "전략지원팀", "자료 조사"],
  // ["임도현", "운영팀", "데이터 입력"],
  // ["강민지", "홍보지원팀", "영상 자료 제작 보조"],
  // ["이서연", "총무팀", "문서 검토"],
  // ["윤서영", "기획팀", "회의 자료 정리"],
  // ["오세훈", "민원응대팀", "민원 접수"],
  // ["김영희", "교육지원팀", "참석자 명단 정리"],
  // ["서지호", "재무팀", "지출 증빙 자료 확인"],
  // ["한지민", "자료관리팀", "문서 보관 목록 작성"],
];

// Sheet2: 날짜 / 가격 / 영문+숫자 코드. Sheet1과 동일한 입력 그리드 구조이지만
// 정형 포맷 데이터(타입별 입력 훈련) 를 다뤄 다양한 키 조합 연습이 가능하다.
const SHEET2_COLUMNS: ColumnDef[] = [
  { key: "date", label: "날짜", width: 140 },
  { key: "price", label: "금액", width: 140 },
  { key: "code", label: "코드", width: 160 },
];

const SHEET2_DATA: string[][] = [
  ["2024-01-03", "12800", "AX9F-23KQ"],
  ["2024-01-17", "45200", "BZ7L-91MP"],
  ["2024-02-06", "9800", "CQ3X-44TR"],
  ["2024-02-24", "37600", "DV8N-62ZA"],
  ["2024-03-11", "22150", "EM5K-17QW"],
  ["2024-03-29", "60500", "FN2P-83LX"],
  ["2024-04-12", "14300", "GP6R-55VN"],
  ["2024-04-27", "28900", "HQ4T-70BC"],
  ["2024-05-09", "33200", "IR1M-29DF"],
  ["2024-05-23", "17500", "JS8Z-64YU"],
];

export const SHEETS: SheetDef[] = [
  { id: "sheet1", label: "Sheet1", columns: SHEET1_COLUMNS, data: SHEET1_DATA },
  { id: "sheet2", label: "Sheet2", columns: SHEET2_COLUMNS, data: SHEET2_DATA },
];

// 하위 호환 — 기존 import 경로(COLUMNS / SAMPLE_DATA) 를 보존하기 위해 첫 번째 시트를 그대로 노출.
export const COLUMNS = SHEETS[0].columns;
export const SAMPLE_DATA = SHEETS[0].data;
