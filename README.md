# Figma MCP Plugin for Cursor

Cursor와 Figma를 연결하여 디자인 작업을 효율적으로 진행할 수 있는 MCP 플러그인입니다.

## 사전 요구사항

- [Cursor IDE](https://cursor.sh/) 설치
- [Figma 데스크톱 앱](https://www.figma.com/downloads/) 설치
- [Bun](https://bun.sh/) 런타임 설치

## Bun 설치

터미널에서 다음 명령어를 실행하세요:

```bash
curl -fsSL https://bun.sh/install | bash
```

## 설치 및 설정

1. **프로젝트 설정 실행**

```bash
bun install
bun setup
```

2. **웹소켓 서버 시작**

**방법 1: 공식 패키지 사용 (권장)**
```bash
bunx cursor-talk-to-figma-socket
```

**방법 2: 로컬 서버 사용**
```bash
bun socket
```

서버가 포트 3055에서 시작됩니다.

## Figma 플러그인 연결

1. **Figma에서 Dev Mode MCP Server 활성화**
   - Figma 데스크톱 앱을 엽니다
   - 연동할 디자인 파일을 엽니다
   - 왼쪽 상단의 Figma 로고를 클릭하여 **Preferences**로 이동
   - **Enable Dev Mode MCP Server** 옵션을 체크합니다

2. **Figma 플러그인 설치 및 실행**
   - Figma 커뮤니티에서 **Cursor Talk To Figma MCP Plugin**을 설치합니다
   - Figma에서 해당 플러그인을 실행합니다
   - **Use localhost** 옵션을 활성화합니다

3. **Cursor와 Figma 연결**
   - Figma 플러그인에서 표시되는 녹색 주소를 복사합니다 (예: `ws://localhost:3055`)
   - Cursor의 프롬프트 창에 다음과 같이 입력합니다:
   
   ```
   "ws://localhost:3055" 피그마 연결해서 디자인 작업 시작하자
   ```

## 사용법

연결이 완료되면 Cursor에서 Figma 디자인을 읽고 수정할 수 있습니다.

- Figma 디자인 요소 읽기
- 디자인 수정 요청
- 디자인과 코드 간 동기화

## 문제 해결

### 서버가 시작되지 않는 경우
- 포트 3055가 이미 사용 중인지 확인하세요
- 다른 포트를 사용하려면 `src/socket.ts` 파일의 `PORT` 값을 변경하세요

### Figma 플러그인이 연결되지 않는 경우
- 웹소켓 서버가 실행 중인지 확인하세요 (`bun socket`)
- Figma에서 "Use localhost" 옵션이 활성화되어 있는지 확인하세요
- 방화벽 설정을 확인하세요

## 라이선스

MIT

