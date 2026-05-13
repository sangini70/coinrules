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

## 5. React Render Safety

- JSX child에는 string, number, boolean 처리 결과, null, undefined, ReactNode만 넣는다.
- object/array 가능성이 있는 값은 JSX에 직접 넣지 않는다.
- raw object를 JSX에 직접 넣는 수정은 금지한다.

금지:

- <div>{value}</div>
- <div>{object}</div>
- <div>{array}</div>
- <div>{signals[coin]}</div>
- <div>{marketAnalysis}</div>
- <div>{reason}</div>

허용:

- <div>{toDisplayText(value)}</div>
- Array.isArray(items) ? items.map(...) : null
- object는 JSON.stringify(value) 또는 명시적 필드만 출력한다.

필수 helper:

- 화면 출력 전용 값은 반드시 toDisplayText(), renderText(), renderList() 같은 helper를 거친다.
- 이유 목록, signal 분석값, marketAnalysis, entryAnalysis, safeSignal, reasons, failReasons는 직접 렌더링 금지.

## 6. PositionForm Safety

- PositionForm.tsx 대형화 금지
- 카드별 컴포넌트 분리
- 신호 계산부와 JSX 렌더부 분리
- 한 파일이 500~800줄을 넘기 시작하면 분리 검토
- JSX 수정 시 object/array 직접 출력 여부를 먼저 검사한다.

## 7. Production Render Check

production 배포 전 필수:

- npm run build
- git diff --check
- git status --short
- 로컬 preview 또는 production DevTools console 확인
- React31 / 흰 화면 / object child 에러 없을 때만 push

## 8. ErrorBoundary Debug Rule

ErrorBoundary에는 가능하면 아래 정보를 남긴다.

- componentStack
- selectedCoin
- entryState
- actionSignal
- 최근 렌더 값 타입
- object keys

## 9. React Error Prevention Rule

React 오류는 사후 추적 대상이 아니라 사전 차단 대상이다.  

모든 JSX 수정 전 반드시 확인한다.  

1. JSX child에 object/array 가능성이 있는 값 금지  
2. useEffect dependency에 렌더마다 새로 생성되는 array/object 금지  
3. useEffect 내부 setState는 기존 값과 비교 후 변경 시에만 실행  
4. Zustand selector는 새 object/array를 직접 반환하지 않는다  
5. map 렌더는 key와 primitive 출력 여부를 먼저 확인한다  
6. PositionForm.tsx에 대형 JSX 추가 금지  
7. 동적 렌더 추가 시 build 전 코드 검색으로 raw child 후보 확인  

금지:  

- 추측으로 JSX 복원  
- “일단 optional chaining 추가”  
- “일단 helper 추가”  
- “일단 전체 복원”  
- 렌더 중 state/store 변경

## 10. useEffect Safety

useEffect dependency에는 렌더마다 새로 생성되는 값 사용 금지.  

주의 대상:  

- Object.entries(...)  
- Object.values(...)  
- Object.keys(...)  
- array.map(...)  
- array.filter(...)  
- inline object  
- inline array  

useEffect 내부에서 setState를 호출할 경우,  
기존 state와 비교 후 실제 변경이 있을 때만 setState 한다.

## 11. Commit Scope Rule

한 작업의 commit에는 실제 수정 대상 파일만 포함한다.  

예:  

- AppRoutes 수정 작업이면 AppRoutes.tsx만 add  
- PositionForm 수정 작업이면 PositionForm.tsx만 add  
- CODEX_RULES.md는 별도 작업일 때만 commit  

작업 중 우연히 변경된 파일은 commit 금지.

## 12. Recovery Isolation Rule

React 오류 발생 시:  

- 먼저 return null 또는 최소 정적 JSX로 안전지대 확보  
- 원인 확인 전 전체 JSX 복원 금지  
- 한 번에 하나의 블록만 복원  
- build + production console 확인 후 다음 블록 진행  

금지:  

- 여러 후보 동시 수정  
- 대량 복원  
- 추측 기반 복원



## 13. React Child Normalization Rule

children passthrough 금지:

금지:

- return children;
- <>{children}</>
- {children}

허용:

- normalizedChildren
- renderable child filtering 후 출력

필수:

- ReactElement 검사
- primitive 검사
- plain object 제거

wrapper/boundary/AppShell에서는 children normalization 없이 passthrough 금지.



## 절대 원칙

- 사용자 데이터 섞임 금지

- uid 기준으로만 저장/로드

- 이전 사용자 상태 fallback 금지

- signals/tradingRules 구조 임의 수정 금지
