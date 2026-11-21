---
name: trip-dev
description: Trip Insurance 레포에서 코드를 고칠 때의 맥락과 규칙 — 먼저 읽을 문서, 구조, 화면 공통 모듈, 검증 순서, 문구 규칙. "맥락 파악", "이 레포 설명", "어디를 고쳐야", 새 세션 시작 시 호출.
---

# 개발 맥락과 규칙

이 레포는 단발성 여행 보험 PoC다. 컨트랙트 하나가 모든 보험을 처리하고, 오프체인 Mock 서버는 비용 NFT 발급과 관측값 서명만 한다. 새 세션은 AGENTS.md부터 읽는다.

## 먼저 읽을 것

```text
AGENTS.md            목적 · 확정 설계 · 구조 · 작업 규칙
docs/prd.html        PRD (가입 · 경매 · 판정 · 정산 요구사항)
docs/tech.html       구성 · 구현 방법 · 한계 · trade-off
docs/demo-runbook.md 시연 순서
```

## 지도

```text
src/TripInsurance.sol    가입 · 입찰 · 배정 · 판정 · 무효 · 청구 · 출금 (지연 실행)
src/BookingNFT.sol       비용 NFT
services/                platform(발급사 · 수도꼭지 · 상품) · oracle(판정 · 시간 이동) · cases · chain
ui/shared.js · app.css   화면 공통 (ABI · 지갑 · 오류 문장 · 원화 표시 · 배정 계산)
ui/buyer · investor      거래 화면,  ui/oracle  발표자 화면
```

## 규칙

코드는 주석 없이 쓴다. 문서(PRD · 테크)에는 함수 · 파일 이름을 쓰지 않는다. 화면 문구는 쉬운 말을 쓰고, 금액은 원화를 먼저 ETH를 작게 쓴다. 소비자 화면은 토스식(흰 배경 · 큰 숫자 · 둥근 카드 · 하단 CTA)이다.

## 검증 순서

```text
forge test     컨트랙트 변경 시
npm run e2e    흐름 변경 시
Chrome         화면은 실제로 열어 문구 · 넘침을 확인
```
