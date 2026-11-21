# Trip Insurance 플러그인

이 폴더는 Claude Code · Codex용 플러그인이다. 레포 자체(Foundry 엔진 · Node 서비스 · 화면)는 상위 폴더에 있고, 플러그인은 그것을 다루는 스킬만 담는다.

```text
skills/stack   로컬 스택 켜기 · 끄기 · 점검
skills/demo    시연 준비 · QR 참여 · 시나리오 두 가지
skills/dev     개발 맥락 · 지도 · 규칙 · 검증 순서
```

설치는 마켓플레이스에서 `plugin` 폴더만 받는다(git-subdir). 이 레포를 열면 `.claude/settings.json`이 플러그인을 자동으로 켠다.
