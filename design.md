목표:
자산보호 도구 UI를 “3초 안에 현재 상태와 위험 여부를 판단할 수 있는 화면”으로 정리한다.
진입을 유도하는 디자인이 아니라, 리스크와 상태를 빠르게 인식하는 UI가 목적이다.

절대 규칙:

- 기능 수정 금지
- 데이터 구조 수정 금지
- API 수정 금지
- 계산 로직 수정 금지
- server.ts 수정 금지
- Firebase/Auth 수정 금지
- 수정 파일은 AppRoutes.tsx만 대상으로 한다

화면 구조:

1. 상단
   
   - 자산 보호 도구
   - 현재 상태: 정상 / 주의 / 위험

2. 좌측 패널
   
   - 코인 선택
   - 현재 상태
   - 단기 흐름 요약
   - 진입 전 유동성 체크
   - 매수가 / 투입금액 / TP·SL

3. 우측 패널
   
   - 포지션 카드 목록

포지션 카드 구조:
[코인명] [현재가] [수익률]
[상태] [목표가] [평가손익]
[SL/TP] [메모] [종료 버튼]

정보 우선순위:

1. 상태
2. 수익률
3. 평가손익
4. 현재가
5. 목표가 / SL / TP

색상 시스템:

- 손실: text-red-500
- 수익: text-green-600
- 위험: text-orange-500
- 대기/관망: text-gray-500
- 진입 금지: text-gray-800 또는 text-black
- label / 설명 텍스트: text-gray-400

수익/손실 색상 규칙:

- profit > 0 → text-green-600
- profit < 0 → text-red-500
- profit == 0 또는 값 없음 → text-gray-500

카드 강조 규칙:

- 현재가: text-2xl font-bold
- 수익률: text-xl font-semibold
- 평가손익: text-lg font-semibold
- 코인명: text-base font-bold
- 상태: text-sm font-semibold

배경색 규칙:

- 카드 전체를 과하게 칠하지 말 것
- bg-green-50 / bg-red-50 / bg-orange-50은 필요한 강조 구간에만 최소 사용
- 기본 배경은 흰색 또는 연한 회색 유지

레이아웃 규칙:

- 좌측 패널은 현재 구조 유지
- 우측 패널은 포지션 카드가 한눈에 읽히도록 정렬
- 카드 내부 숫자와 텍스트가 겹치지 않게 gap, padding, min-w-0, truncate 적용
- 넓은 화면에서 숫자가 오른쪽 끝으로 과하게 밀리지 않게 한다

작업 방식:

1. 먼저 현재 AppRoutes.tsx 안의 UI 구조를 확인한다.
2. 기능 로직은 건드리지 않고 className과 JSX 배치만 최소 수정한다.
3. 수정 후 npm run build를 실행한다.
4. 변경 파일과 변경 이유를 보고한다.
