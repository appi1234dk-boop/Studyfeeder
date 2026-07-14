# Web dashboard instructions

이 디렉토리는 Studyfeeder 웹 대시보드의 독립 Git 저장소다. 상위 `AGENTS.md`의 제품·데이터 규칙을 함께 따른다.

## 기술 스택과 구조

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4
- 페이지와 API: `src/app/`
- UI 컴포넌트: `src/components/`
- Google Sheets, 인증, 타입, 임베드 유틸: `src/lib/`

## 작업 규칙

- UI나 API 동작을 바꾸기 전에 `../docs/prd/`와 `../docs/정책서.md`의 웹 대시보드 항목을 확인한다.
- Google Sheets를 사실상 데이터베이스로 사용하므로 API 필드와 시트 열 매핑을 함께 확인한다.
- 편집 권한과 잠금 처리는 `src/lib/auth.ts`, `/api/me`, `/api/unlock` 흐름을 우회하지 않는다.
- 메모 자동 저장을 수정할 때 debounce, 커서 유지, 화면 점프 방지 동작을 보존한다.
- `.env.local`과 인증 정보는 출력하거나 커밋하지 않는다.

## 검증

변경 범위에 맞춰 아래 명령을 실행한다.

```bash
npm run lint
npm run build
```

웹 관련 Git 명령은 이 디렉토리에서만 실행한다. 커밋·push·배포는 사용자가 명시적으로 요청한 경우에만 수행한다.

