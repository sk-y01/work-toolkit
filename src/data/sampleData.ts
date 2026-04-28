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
  ["김민수", "민원응대팀", "자료 조사"],
  ["이서연", "총무팀", "문서 검토"],
  ["박지훈", "기획지원팀", "회의 참석"],
  ["최유진", "운영지원팀", "엑셀 입력"],
  ["정하늘", "행정팀", "자료 정리"],
  ["한지민", "총무팀", "문서 분류"],
  ["오세훈", "지원팀", "민원 접수"],
  ["윤서영", "행정지원팀", "회의 자료 정리"],
  ["임도현", "운영팀", "데이터 입력"],
  ["강민지", "기획팀", "문서 작성 및 검토"],
  ["서지호", "지원팀", "업무 보조"],
  ["김영희", "지원팀", "영상 제작 업무 보조"],
  ["박철수", "지원팀", "민원 접수 업무 보조"],
];

// Sheet2: 날짜 / 가격 / 영문+숫자 코드. Sheet1과 동일한 입력 그리드 구조이지만
// 정형 포맷 데이터(타입별 입력 훈련) 를 다뤄 다양한 키 조합 연습이 가능하다.
const SHEET2_COLUMNS: ColumnDef[] = [
  { key: "date", label: "날짜", width: 140 },
  { key: "price", label: "가격", width: 140 },
  { key: "code", label: "코드", width: 160 },
];

const SHEET2_DATA: string[][] = [
  ["2024-01-01", "12000", "AB1234"],
  ["2024-01-15", "25500", "CD2045"],
  ["2024-02-03", "8900", "EF7821"],
  ["2024-02-21", "44000", "GH3390"],
  ["2024-03-08", "15750", "IJ4128"],
  ["2024-03-22", "61200", "KL5567"],
  ["2024-04-05", "9300", "MN6890"],
  ["2024-04-19", "27800", "OP7345"],
  ["2024-05-02", "33450", "QR8112"],
  ["2024-05-18", "10500", "ST9456"],
  ["2024-06-04", "52000", "UV0238"],
  ["2024-06-21", "18900", "WX1672"],
  ["2024-07-09", "7600", "YZ4093"],
  ["2024-07-25", "29900", "AC5184"],
];

export const SHEETS: SheetDef[] = [
  { id: "sheet1", label: "Sheet1", columns: SHEET1_COLUMNS, data: SHEET1_DATA },
  { id: "sheet2", label: "Sheet2", columns: SHEET2_COLUMNS, data: SHEET2_DATA },
];

// 하위 호환 — 기존 import 경로(COLUMNS / SAMPLE_DATA) 를 보존하기 위해 첫 번째 시트를 그대로 노출.
export const COLUMNS = SHEETS[0].columns;
export const SAMPLE_DATA = SHEETS[0].data;
