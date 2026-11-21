---
name: trip-stack
description: Trip Insurance 로컬 스택(anvil 12초 블록 · 배포 · platform/oracle · 화면 서버)을 켜고 끄고 점검한다. "스택 켜줘", "스택 재시작", "스택 상태", "smoke 돌려줘" 요청 시 호출.
---

# 로컬 스택 운영

스택은 anvil 한 프로세스와 Node 서비스 한 프로세스, 화면용 정적 서버 한 프로세스로 이루어진다. 레포 루트에서 실행한다.

## 켜기

anvil이 이미 떠 있으면 배포만 다시 하므로, 깨끗한 체인이 필요하면 먼저 끈다. `BLOCK_TIME`은 블록 간격(초)이고 기본 12다.

```bash
export PATH="$HOME/.foundry/bin:$PATH"
./script/local-up.sh                              # 백그라운드로 실행, 종료 알림을 기다리지 말 것
python3 -m http.server 8099 --bind 0.0.0.0        # 레포 루트에서 (폰 참여를 위해 LAN 공개)
```

준비 확인은 플랫폼 API가 응답하는지로 한다.

```bash
curl -sf http://127.0.0.1:8787/cases | head -c 200
```

## 끄기 · 재시작

서비스 코드(services/*.js)를 바꾸면 스택을 다시 켜야 반영된다. 끄면 체인이 초기화된다.

```bash
for p in 8545 8787 8788; do lsof -ti tcp:$p | xargs kill 2>/dev/null; done
```

## 점검

변경 뒤 항상 두 가지를 돌린다. e2e는 자체 anvil(포트 18545, 1초 블록)을 띄운다.

```bash
forge test                   # 컨트랙트 30
npm run e2e                  # 로컬 네트워크 8 시나리오
```

## 자주 겪는 일

| 증상 | 원인 | 처치 |
|---|---|---|
| 거래가 12초씩 기다림 | 블록 간격 12초 (실제 슬롯과 동일) | 정상. 급하면 `BLOCK_TIME=3 ./script/local-up.sh` |
| 화면이 옛 코드로 동작 | 브라우저가 shared.js를 캐시 | 페이지의 `shared.js?v=` 값을 올린다 |
| 모든 보험이 유찰 | 마감까지 입찰이 0건 | 투자자 화면에서 먼저 입찰한다 |
