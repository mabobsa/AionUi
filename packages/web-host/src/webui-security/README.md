# WebUI 세션 경계

WebUI 정적 서버를 통과하는 API와 WebSocket은 Core의 `GET /api/auth/webui-session`이 204를 반환할 때만 허용한다. 이 경로는 기존 JWT 인증 미들웨어의 서명·만료·블랙리스트·활성 사용자·세션 세대 검증을 재사용한다. Local 백엔드는 일반 API를 기본 사용자로 실행하므로 검증 경로도 `system_default_user` 세션만 허용한다. 결과를 캐시하지 않으며 401·403은 그대로 거부하고, Core 오류·구버전의 404·예상 밖 응답은 502로 거부한다.

로그인 과정의 프록시 인증 예외는 다음 메서드와 경로의 정확한 조합뿐이다. 각 경로의 Core 자체 검증과 속도 제한은 유지된다.

- `POST /login`
- `POST /logout`
- `GET /api/auth/status`
- `POST /api/auth/qr-login`
- `POST /api/auth/refresh`

`GET /qr-login`과 정적 페이지는 공개된다. `/api/auth/user`와 `/api/ws-token`에는 세션이 필요하다. `/api/webui/*`와 `internal` 경로 구간이 있는 API는 로그인해도 403이며 내부 API 예외는 없다. 따라서 `/api/internal/*`, `/api/auth/internal/*`, `/api/cron/internal/*`도 차단된다. MnP 화면의 일반 `/api/integrations/mindnprogress/conversations/*`는 로그인 후 사용할 수 있다.

데스크톱 `requestHandler`보다 먼저 검사하므로 모바일 푸시도 같은 경계를 따른다. 모바일 푸시 자체의 사용자 확인·CSRF 검사는 유지된다. 일반 브라우저의 상태 변경 요청과 WebSocket에는 현재 WebUI 주소와 같은 `Origin`이 필요하다. 다른 출처의 `Origin`은 거부한다. `Origin` 없는 자동화 클라이언트는 명시적 Authorization을 사용해야 하며 그 JWT도 Core가 검증한다. 기존 렌더러가 Core CSRF 토큰 전달을 구현하지 않아 이 경계에서는 Origin을 검사한다. 루프백 Core의 인증·CORS·CSRF 정책은 변경하지 않는다.

WebSocket은 전체 헤더와 세션을 확인한 뒤 업그레이드 요청만 전송한다. Core의 101 응답 이후에만 양방향 전송을 시작하여, 실패한 업그레이드 뒤에 붙인 HTTP 요청이 Local 백엔드에 도달하지 않게 한다. Bun의 수신 HTTP upgrade 소켓 문제를 피하려고 공개 수신부는 기존 TCP 소켓을 유지한다. 거부 상태 코드와 기존 Core 인증 로그로 확인할 수 있으므로 인증정보를 포함하는 별도 로그는 추가하지 않는다.

## 집중 검증

Core worktree:

```powershell
cargo test -p aionui-auth
cargo clippy -p aionui-auth --all-targets -- -D warnings
cargo fmt --all --check
cargo build -p aionui-auth --example webui_session_fixture
```

UI worktree:

```powershell
$env:AIONUI_WEBUI_AUTH_FIXTURE='D:/Git/AionUi/AionCore-webui-auth/target/debug/examples/webui_session_fixture.exe'
bun run test packages/web-host/src/webui-security packages/web-host/src/trusted-client-address tests/unit/process/startup/bootstrap/mobile-push
bunx tsc --noEmit
```

통합 fixture는 실제 인증 라우터와 메모리 DB를 사용하고 루프백 임시 포트만 연다. Node와 Bun 호스트를 각각 검증한다. fixture의 WebSocket은 전송 검증용 반향 응답이며 실제 대화·STT·에이전트를 실행하지 않는다. 환경변수가 없으면 이 통합 테스트만 건너뛴다. 서버는 테스트 종료 시 표준입력 신호로 종료한다.

## 메인 PC 적용

두 저장소의 기능 브랜치를 검토한 뒤 사용자가 정한 시점에 반영한다. Core를 먼저 빌드할 수 있지만, 실행 중인 앱의 UI 작업 트리를 병합하기 전에는 앱을 종료해야 한다. 권장 순서는 다음과 같다.

1. 위임·AI 실행을 마무리하고 AionUi를 종료한다. 연결된 대화와 WebUI 연결이 중단된다.
2. 양쪽 기능 브랜치를 각 main에 병합한다.
3. AionCore에서 `cargo build --release --bin aioncore`를 실행한다.
4. 상위 폴더의 `apply-aioncore.bat`으로 빌드 결과를 launcher에 반영한다.
5. `run-aionui-dev-no-sentry.bat`으로 앱을 시작한다.
6. 다른 기기에서 7777 무인증 요청 거부, 비밀번호·QR 로그인, 대화 조회·전송, MnP 대화 열기·위임·세션 메시지, Runner, 모바일 푸시를 확인한다.

UI만 적용하고 구버전 Core를 유지하면 보호 API는 502로 거부된다. 두 변경은 함께 배포해야 한다. 기존 앱을 실행한 채 이 파일들을 라이브 작업 트리에 복사하지 않는다. HTTPS는 이 작업 범위 밖이며 사내망 HTTP 전송의 잔여 위험은 유지된다.
