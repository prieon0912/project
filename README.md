# 문장결

원문의 표현을 보존하면서 목표 글자 수에 맞춘 축약 후보를 비교하는 웹 서비스입니다.

## 현재 구현 상태

- [x] 프론트엔드와 향후 API·DB 연동이 공유할 데이터 계약
- [x] 공백 포함·제외 방식의 Unicode 글자 수 계산
- [x] 원문과 목표 글자 수 입력
- [x] 현재 글자 수, 남은·초과 글자 수, 진행률 표시
- [x] 여러 보호 표현 선택·분류·개별/전체 해제
- [x] 글자 수 우선·조건부 보호·보호 우선의 세 가지 후보 생성
- [x] 직접·외부에서 수정한 현재본과 이전본 비교 및 후보별 보호 표현 우선순위 검증
- [x] 보호 표현 마스킹·원문 복원과 후보별 수정 내역 표시
- [x] 자기소개서 최소 수정 매뉴얼 v1과 목표 글자 수·숫자·상투어 자동 검증
- [x] 검사 실패 후보의 1회 미세 재수정과 남은 경고 표시
- [ ] 최종 편집과 저장
- [ ] 배포 환경의 Gemini API 키 및 Supabase 연동

## 구조

- `lib/contracts.ts`: 프론트·서버·DB 경계에서 사용할 데이터 타입과 요청 검증
- `lib/text-count.ts`: 화면과 테스트가 함께 사용하는 글자 수 계산 로직
- `lib/protected-text.ts`: 보호 표현을 외부 전송용 토큰으로 바꾸고 원문으로 복원
- `lib/text-diff.ts`: 원문과 후보의 삭제·추가 내역 계산
- `lib/self-introduction-manual.ts`: Gemini가 따르는 버전형 자기소개서 편집 매뉴얼
- `lib/candidate-quality.ts`: 생성 후보의 글자 수·숫자·상투어·문장 완결 검사
- `app/api/generate/route.ts`: Gemini API 키를 숨긴 서버 전용 생성 경로
- `app/candidate-comparison.tsx`: 새 축약안 생성 또는 이전본·현재본 비교와 후보 3종 확인 화면
- `app/essay-draft-editor.tsx`: 현재 입력 화면

## Gemini 연결

`.env.example`을 참고해 로컬 환경에 `GEMINI_API_KEY`를 설정합니다. API 키는 브라우저 코드에 넣지 않습니다. 기본 모델은 `gemini-3.8-flash`이며 `GEMINI_MODEL`로 변경할 수 있습니다.

## 확인 명령

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

UI 컴포넌트는 Gemini API 키를 직접 사용하지 않고 `/api/generate` 서버 경로만 호출합니다. Supabase도 같은 방식으로 UI와 저장 구현을 분리합니다.
