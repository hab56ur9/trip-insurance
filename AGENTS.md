# AGENTS

이 문서는 Trip Insurance 레포에서 일하는 에이전트의 출발점이다. 새 세션은 이 문서를 읽고, 파악한 내용을 3줄로 보고한 뒤 지시를 기다린다.

## 프로젝트

Trip Insurance는 "누구나 보험에 들고, 누구나 투자자가 되는" 단발성 여행 보험 PoC다. 여행자는 비용 NFT로 예약을 증명하고 보험료와 최소 보장금액을 정해 보험을 요청한다. 투자자는 보험 한 건의 지분 100개를 오름 입찰로 나눠 맡는다. 판정은 오라클이 서명한 관측값으로 컨트랙트가 하며, 체결 뒤에는 사람이 개입하지 않는다.

```text
성격      블록체인 과목 기말 프로젝트 PoC (구현 + 발표 · 시연)
```

## 먼저 읽을 것

```text
docs/prd.html        PRD: 가입 · 경매 · 판정 · 정산 요구사항
docs/tech.html       구성과 요구사항별 구현 방법 · 한계 · trade-off
docs/demo-runbook.md 시연 순서
README.md            실행 · 테스트 · 화면 · API
```

## 구조

컨트랙트 하나가 모든 보험을 처리한다. 오프체인 서버는 비용 NFT 발급과 관측값 서명만 하고 자산 이동을 결정하지 않는다.

```text
src/TripInsurance.sol    가입 · 입찰 · 배정 · 판정 · 무효 · 청구 · 출금, 시간에 따른 상태 전환은 지연 실행
src/BookingNFT.sol       비용 NFT (예약 대상 · 시작 · 끝 · 금액), 발급사만 민팅
services/platform.js     Mock 발급사(POST /bookings) · 수도꼭지(POST /faucet) · GET /cases · GET /config, 포트 8787
services/oracle.js       Mock 오라클(POST /report) · 로컬 시간 이동(POST /time), 포트 8788 (이 호스트만)
services/cases.js        예약 상품 3종 (KTX 지연 · 숙소 폭우 · 서핑 강풍)과 기본 조건
ui/buyer.html            구매자: 예약(Mock) · 보험 가입 · 내 보험 · 보험료 돌려받기 · 출금
ui/investor.html         투자자: 입찰 · 내 투자 · 청구 · 출금
ui/oracle.html           발표자: 정상 · 지연 판정, 모집 마감 · 판정 시작 · 판정 종료로 시간 이동
ui/deck.html             발표 덱 (이전 설계 기준, 다시 만들어야 함)
test/ · e2e/             forge 30 · 로컬 네트워크 e2e 8 시나리오
```

## 확정 설계

```text
가입            보험료 · 비용 NFT · 보장 조건(오라클 · 관측 항목 · 기준값) · 최소 보장금액
경매            지분 100개 · 시작가 = 최소 보장금액 / 100 · 지분당 보장금액 오름 입찰 · 전액 예치 · 높은 순 배정(같으면 먼저 낸 순) · 각자 부른 금액 · 팔린 만큼 체결 · 0개면 유찰 · 보험당 입찰 200건
판정            조건 오라클의 서명만 인정, 충족이면 지급(보장금액 전액) · 미충족이면 만료, 판정 기간 안에 없으면 무효
정산            수수료 2% · 지분 비례 보험료 몫 · 주소별 잔액 적립 후 각자 출금, 환불과 수령은 투자자가 청구
지연 실행       마감 뒤 첫 판정 · 청구 · 결과 확정이 배정을, 판정 기간 뒤 첫 청구가 무효를 실행. 화면은 statusOf로 현재 상태를 계산
범위 밖         보장 상한 · 2차 거래 · 투자 풀 · 여러 일정 묶음 · 실제 발급사 · 실제 오라클
블록            로컬 anvil 12초 간격 (BLOCK_TIME으로 변경), e2e는 1초
지갑            테스트 키 · 임시 지갑(?wallet=temp, LAN 접속 시 기본) + "테스트 ETH 받기"(지갑당 1회 0.05 ETH)
```

## 작업 규칙

```text
언어       답변은 한국어. 결론 3줄 먼저, 본문 500자 이내, 끝은 "### 남은 문제"(인용 줄 + 선택지 표, 추천안 먼저)
코드       주석 없이 작성. 주석은 작업 완료 후 사용자 허락을 받고 추가
브랜치     master에 직접 커밋. 커밋 메시지 끝에 Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
문구       쉬운 말: 투자자(인수자 아님) · 여행자(가입자 아님) · 최저(바닥 아님), 금액은 원화 먼저 ETH 작게
화면       소비자 화면은 토스식(흰 배경 · 큰 숫자 · 둥근 카드 · 하단 CTA), 시연 화면은 PPT 한 장면처럼 볼 곳 하나
설계 변경  docs/prd.html을 먼저 고친 뒤 코드에 반영
```

## 검증

변경 뒤 항상 아래 순서로 돌린다. e2e는 자체 anvil(포트 18545)을 띄운다.

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge test                 # 컨트랙트 30
npm run e2e                # 로컬 네트워크 8 시나리오
```

화면을 바꾸면 Chrome으로 실제로 열어 문구와 넘침을 확인한다. shared.js · app.css를 바꾸면 페이지의 `?v=` 꼬리표를 올린다.

## 운영

```bash
./script/local-up.sh                           # anvil(12초) + 배포 + 서비스, 127.0.0.1에만 연다. LAN=1이면 0.0.0.0
python3 -m http.server 8099 --bind 127.0.0.1   # 화면 서버 (레포 루트), 폰 참여 때는 --bind 0.0.0.0
for p in 8545 8787 8788; do lsof -ti tcp:$p | xargs kill; done   # 끄기 (체인 초기화)
```

## 서명

```text
observation = keccak256(abi.encode(chainid, insurance, kind, subject, windowStart, windowEnd, value))
EIP-191 personal sign, 컨트랙트에서 ecrecover
```
