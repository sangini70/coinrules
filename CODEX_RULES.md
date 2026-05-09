# CODEX_RULES.md

## 1. Think Before Coding

- 추측 금지

- 불확실하면 먼저 설명

- 여러 방법이 있으면 옵션 제시

- mock/fallback/sample 자동 생성 금지

## 2. Simplicity First

- 최소 수정만 수행

- 새 구조 추가 금지

- 새 상태관리 추가 금지

- 과한 추상화 금지

## 3. Surgical Changes

- 요청 범위 외 수정 금지

- 리팩토링 금지

- UI 임의 수정 금지

- 포맷 변경 금지

- 기존 스타일 유지

## 4. Goal-Driven Execution

작업 전:

- 성공 기준 먼저 정리

작업 후:

- npm run build

- git diff 확인

- git status 확인

## 절대 원칙

- 데이터 없으면 "없음" 처리

- 사용자 데이터 섞임 금지

- uid 기준으로만 저장/로드

- 이전 사용자 상태 fallback 금지

- signals/tradingRules 구조 임의 수정 금지



- build 성공만으로 완료 판단 금지
- 실제 사용자 시나리오로 검증
- 증상 숨기기보다 root cause 제거 우선
- 단, 구조 변경 없이 최소 수정 유지
