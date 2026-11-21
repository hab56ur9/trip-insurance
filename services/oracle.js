const { NonceManager } = require("ethers");
const { STATUS, signObservation } = require("./chain");
const { createJsonServer, RequestError } = require("./http");

const FINAL = ["Paid", "Expired", "Voided", "Cancelled"];
const AT_LEAST = 0n;

function outcomeValue(condition, outcome) {
  const threshold = BigInt(condition.threshold);
  if (outcome === "delay") return threshold;
  return condition.comparison === AT_LEAST ? threshold - 1n : threshold + 1n;
}

function createOracle({ chain, log = () => {}, blockTime = 12 }) {
  const signer = chain.wallets.oracle;
  const insurance = chain.insurance(new NonceManager(signer));
  const reports = new Map();
  let busy = false;

  async function report({ policyId, outcome }) {
    if (!["normal", "delay"].includes(outcome)) throw new RequestError("결과는 normal 또는 delay예요");
    const policy = await insurance.policyOf(policyId).catch(() => null);
    if (!policy || Number(policy.status) === 0) throw new RequestError("없는 보험이에요");
    if (policy.condition.oracle !== signer.address) throw new RequestError("이 오라클이 맡은 보험이 아니에요");
    const value = outcomeValue(policy.condition, outcome);
    reports.set(String(policyId), value);
    log(`oracle report #${policyId} ${outcome} (${value})`);
    await tick();
    return { policyId: String(policyId), outcome, value: value.toString(), pending: reports.has(String(policyId)) };
  }

  async function settleIfOpen(policyId, value, now) {
    const status = STATUS[Number(await insurance.statusOf(policyId))];
    if (FINAL.includes(status)) return reports.delete(policyId);
    const policy = await insurance.policyOf(policyId);
    if (now < Number(policy.windowEnd) || now + blockTime >= Number(policy.judgingEnd)) return;
    const signature = await signObservation(signer, insurance, policyId, value);
    await (await insurance.settle(policyId, value, signature)).wait();
    reports.delete(policyId);
    log(`oracle settled #${policyId} with ${value}`);
  }

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const now = await chain.now();
      for (const [policyId, value] of reports) {
        await settleIfOpen(policyId, value, now).catch((e) => log(`oracle #${policyId}: ${e.shortMessage || e.message}`));
      }
    } finally {
      busy = false;
    }
  }

  async function jump({ to }) {
    const target = Number(to);
    const now = await chain.now();
    if (!Number.isInteger(target) || target <= now) throw new RequestError("지금보다 뒤의 시각이어야 해요");
    await chain.provider.send("evm_setNextBlockTimestamp", [target]);
    await chain.provider.send("evm_mine", []);
    log(`time jumped to ${new Date(target * 1000).toISOString()}`);
    await tick();
    return { now: await chain.now() };
  }

  const routes = {
    "POST /report": report,
    "POST /time": jump,
    "GET /reports": () => Object.fromEntries([...reports].map(([k, v]) => [k, v.toString()])),
  };

  function start(intervalMs = 1000) {
    const timer = setInterval(() => tick().catch((e) => log(`oracle error: ${e.shortMessage || e.message}`)), intervalMs);
    return () => clearInterval(timer);
  }

  return { address: signer.address, report, jump, tick, start, serve: (port) => createJsonServer(routes, log).listen(port, "127.0.0.1") };
}

module.exports = { createOracle, outcomeValue };
