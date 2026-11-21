# Trip Insurance

Trip Insurance는 여행 일정이 틀어지면 보장금을 자동으로 받는 단발성 여행 보험 PoC다. 여행자는 비용 NFT로 예약을 증명해 보험을 요청하고, 투자자는 지분 100개를 오름 입찰로 나눠 맡으며, 판정과 지급은 컨트랙트가 오라클 서명으로 한다.

새 세션에서 맥락을 잡으려면 AGENTS.md를 먼저 읽는다. 요구사항은 docs/prd.html, 구성과 trade-off는 docs/tech.html에 있다.

## 요구 사항

로컬 실행에는 Foundry와 Node 20 이상이 필요하다.

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
git submodule update --init --recursive
npm install
```

## 테스트

컨트랙트 테스트는 PRD 요구사항 번호(G · A · J · S)별로 나뉘고, `vm.warp`로 마감과 판정 시간을 옮긴다. e2e는 1초 블록 anvil에 배포하고 Mock 서버를 띄워 시나리오 8종을 실제 트랜잭션으로 검증한다.

```bash
forge test
npm run e2e
```

## 로컬 실행

스택은 anvil, 서비스(Mock 발급사 · Mock 오라클), 화면용 정적 서버로 이루어진다.

```bash
./script/local-up.sh                           # anvil(12초 블록) + 배포 + 서비스
python3 -m http.server 8099 --bind 127.0.0.1   # 레포 루트에서
```

```text
구매자   http://127.0.0.1:8099/ui/buyer.html      예약(Mock) · 보험 가입 · 보험료 돌려받기 · 출금
투자자   http://127.0.0.1:8099/ui/investor.html   입찰 · 청구 · 출금
발표자   http://127.0.0.1:8099/ui/oracle.html     정상 · 지연 판정, 시간 이동
```

화면 주소에 `?wallet=temp`를 붙이면 브라우저가 임시 지갑을 만든다. 잔액이 모자라면 "테스트 ETH 받기"로 한 번 받는다.

## API

```text
GET  :8787/cases        예약 상품 3종과 기본 조건
GET  :8787/config       컨트랙트 주소 · 오라클 주소
POST :8787/bookings     { to, case } → 비용 NFT 발급
POST :8787/faucet       { to } → 테스트 ETH, 지갑당 1회
POST :8788/report       { policyId, outcome: "normal" | "delay" } → 판정 기간이 열리면 서명해 제출
POST :8788/time         { to } → 로컬 체인 시각 이동
```

오라클 API(8788)는 같은 호스트의 요청만 받는다.

## 테스트넷 배포 (예정)

Sepolia 같은 공개 테스트넷에는 아직 배포하지 않았다. 배포 구조는 준비되어 있다. 로컬 체인이 아니면 서비스는 테스트 키를 쓰지 않고 환경 변수의 키를 쓴다. 시간 이동은 막히고, 화면은 임시 지갑만 보여 준다.

```bash
RPC=<Sepolia RPC> DEPLOYER_KEY=… ISSUER_KEY=… TREASURY=0x… PROFILE=demo ./script/deploy-remote.sh
RPC=<Sepolia RPC> PUBLIC_RPC=<브라우저용 RPC> ISSUER_KEY=… ORACLE_KEY=… FAUCET_KEY=… BLOCK_TIME=12 npm run services
```

```text
PROFILE        local 60초 · 5분, demo 5분 · 30분, live 1시간 · 72시간 (모집 마감 간격 · 판정 기간)
MIN_GAP · JUDGE_PERIOD   위 값을 초 단위로 덮어쓴다
BOOKING_START_AFTER · BOOKING_DURATION   Mock 예약의 시작 지연 · 길이 (초)
FAUCET_KEY     테스트 ETH를 나눠 줄 지갑, 발표 전에 수도꼭지로 채워 둔다
```
