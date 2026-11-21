const { parseEther, formatEther, id, Wallet } = require("ethers");
const { boot } = require("./harness");
const { STATUS, signObservation } = require("../services/chain");
const { caseOf } = require("../services/cases");

async function main() {
  const lines = [];
  const env = await boot({ blockTime: 1, log: (line) => lines.push(line) });
  const { chain, platform, oracle, waitFor, urls } = env;
  const { buyer, alice, bob, carol } = chain.wallets;
  const read = chain.insurance();
  const as = (wallet) => chain.insurance(wallet);
  const status = async (policyId) => STATUS[Number(await read.statusOf(policyId))];
  const stored = async (policyId) => STATUS[Number((await read.policyOf(policyId)).status)];
  const results = [];

  async function insure(key = "ktx") {
    const item = caseOf(key);
    const { tokenId } = await platform.book({ to: buyer.address, case: key });
    const condition = { oracle: oracle.address, kind: id(item.kind), comparison: 0, threshold: item.threshold };
    const biddingEnd = (await chain.now()) + 300;
    const tx = await as(buyer).requestPolicy(tokenId, condition, parseEther(item.minCoverageEth), biddingEnd, { value: parseEther(item.premiumEth) });
    const receipt = await tx.wait();
    const policyId = receipt.logs.map((l) => read.interface.parseLog(l)).find((l) => l && l.name === "PolicyRequested").args.policyId;
    return policyId;
  }

  async function bid(wallet, policyId, units, unitCoverageEth) {
    const unitCoverage = parseEther(unitCoverageEth);
    await (await as(wallet).placeBid(policyId, units, unitCoverage, { value: unitCoverage * BigInt(units) })).wait();
  }

  async function jumpTo(field, policyId, extra = 0) {
    const policy = await read.policyOf(policyId);
    await oracle.jump({ to: Number(policy[field]) + extra });
  }

  const eth = (value) => `${formatEther(value)} ETH`;

  async function scenario(name, run) {
    try {
      results.push({ name, ok: true, detail: await run() });
    } catch (e) {
      results.push({ name, ok: false, detail: e.shortMessage || e.message });
    }
  }

  function check(condition, message) {
    if (!condition) throw new Error(message);
  }

  await scenario("지급: 지연 판정 → 구매자가 보장금 출금", async () => {
    const policyId = await insure("ktx");
    await bid(alice, policyId, 60, "0.0008");
    await bid(bob, policyId, 50, "0.0007");
    await oracle.report({ policyId, outcome: "delay" });
    await jumpTo("windowEnd", policyId);
    await waitFor(async () => (await stored(policyId)) === "Paid", "paid");
    const coverage = parseEther("0.0008") * 60n + parseEther("0.0007") * 40n;
    const credit = await read.credits(buyer.address);
    check(credit >= coverage, `credit ${credit}`);
    const before = await chain.provider.getBalance(buyer.address);
    await (await as(buyer).withdraw()).wait();
    check((await chain.provider.getBalance(buyer.address)) > before, "withdraw");
    return `보장금 ${eth(coverage)}`;
  });

  await scenario("만료: 정상 판정 → 투자자가 예치금과 보험료 몫 청구", async () => {
    const policyId = await insure("hotel");
    await bid(alice, policyId, 100, "0.0015");
    await oracle.report({ policyId, outcome: "normal" });
    await jumpTo("windowEnd", policyId);
    await waitFor(async () => (await stored(policyId)) === "Expired", "expired");
    const before = await read.credits(alice.address);
    await (await as(alice).claim(policyId)).wait();
    const gained = (await read.credits(alice.address)) - before;
    const deposit = parseEther("0.0015") * 100n;
    check(gained > deposit, `gained ${gained}`);
    return `투자자 +${eth(gained)}`;
  });

  await scenario("경매: 높은 금액부터 지분 100개, 미배정은 청구 시 환불", async () => {
    const policyId = await insure("surf");
    await bid(carol, policyId, 30, "0.0005");
    await bid(bob, policyId, 50, "0.00055");
    await bid(alice, policyId, 60, "0.0006");
    await jumpTo("biddingEnd", policyId);
    check((await status(policyId)) === "Bound", "lazy bound view");
    const bobBefore = await read.credits(bob.address);
    await (await as(bob).claim(policyId)).wait();
    await (await as(carol).claim(policyId)).wait();
    const [aliceUnits] = await read.holdingOf(policyId, alice.address);
    const [bobUnits] = await read.holdingOf(policyId, bob.address);
    const [carolUnits] = await read.holdingOf(policyId, carol.address);
    check(aliceUnits === 60n && bobUnits === 40n && carolUnits === 0n, `${aliceUnits}/${bobUnits}/${carolUnits}`);
    check((await read.credits(bob.address)) - bobBefore === parseEther("0.00055") * 10n, "bob refund");
    return `A 60 · B 40 · C 0, B 환불 ${eth(parseEther("0.00055") * 10n)}`;
  });

  await scenario("부분 체결: 40개만 팔림 → 남은 보험료 60% 환불", async () => {
    const policyId = await insure("ktx");
    await bid(alice, policyId, 40, "0.0006");
    await jumpTo("biddingEnd", policyId);
    const before = await read.credits(buyer.address);
    await (await as(buyer).bind(policyId)).wait();
    const policy = await read.policyOf(policyId);
    const refund = (await read.credits(buyer.address)) - before;
    check(Number(policy.soldUnits) === 40, `sold ${policy.soldUnits}`);
    check(refund === (parseEther("0.003") * 60n) / 100n, `refund ${refund}`);
    return `체결 40개, 환불 ${eth(refund)}`;
  });

  await scenario("유찰: 입찰 없음 → 보험료 전액 환불", async () => {
    const policyId = await insure("hotel");
    await jumpTo("biddingEnd", policyId);
    check((await status(policyId)) === "Cancelled", "cancelled view");
    const before = await read.credits(buyer.address);
    await (await as(buyer).bind(policyId)).wait();
    check((await read.credits(buyer.address)) - before === parseEther("0.006"), "premium refund");
    return "보험료 0.006 ETH 환불";
  });

  await scenario("무효: 판정 없이 기간 종료 → 첫 청구가 무효 처리", async () => {
    const policyId = await insure("surf");
    await bid(alice, policyId, 100, "0.0005");
    await jumpTo("judgingEnd", policyId);
    check((await status(policyId)) === "Voided", "voided view");
    const before = await read.credits(alice.address);
    await (await as(alice).claim(policyId)).wait();
    check((await stored(policyId)) === "Voided", "voided stored");
    check((await read.credits(alice.address)) - before === parseEther("0.0005") * 100n, "deposit back");
    return "예치금 전액 반환";
  });

  await scenario("판정: 조건의 오라클이 아닌 서명은 거절", async () => {
    const policyId = await insure("ktx");
    await bid(alice, policyId, 100, "0.0006");
    await jumpTo("windowEnd", policyId);
    const stranger = Wallet.createRandom();
    const signature = await signObservation(stranger, read, policyId, 30);
    let reverted = false;
    try {
      await as(bob).settle.staticCall(policyId, 30, signature);
    } catch (e) {
      reverted = (e.shortMessage || e.message).includes("WrongOracle") || e.revert?.name === "WrongOracle";
    }
    check(reverted, "expected WrongOracle");
    return "WrongOracle";
  });

  await scenario("HTTP: 상품 · 예약 발급 · 테스트 ETH", async () => {
    const cases = await (await fetch(`${urls.platform}/cases`)).json();
    check(cases.length === 3, "cases");
    const someone = Wallet.createRandom().address;
    const booked = await (await fetch(`${urls.platform}/bookings`, { method: "POST", body: JSON.stringify({ to: someone, case: "ktx" }) })).json();
    check((await chain.nft().ownerOf(booked.tokenId)) === someone, "nft owner");
    const first = await fetch(`${urls.platform}/faucet`, { method: "POST", body: JSON.stringify({ to: someone }) });
    const second = await fetch(`${urls.platform}/faucet`, { method: "POST", body: JSON.stringify({ to: someone }) });
    check(first.status === 200 && second.status === 409, `${first.status}/${second.status}`);
    return `상품 ${cases.length}개, NFT #${booked.tokenId}, 수도꼭지 409`;
  });

  env.shutdown();
  console.log("| # | 시나리오 | 결과 | 내용 |");
  console.log("|---|---|---|---|");
  results.forEach((r, i) => console.log(`| ${i + 1} | ${r.name} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail} |`));
  const failed = results.filter((r) => !r.ok).length;
  if (failed) {
    console.log("\nservice log:\n" + lines.join("\n"));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
