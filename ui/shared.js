const INSURANCE_ABI = [
  "function policyCount() view returns (uint256)",
  "function policyOf(uint256) view returns (tuple(address insured,uint256 tokenId,bytes32 subject,tuple(address oracle,bytes32 kind,uint8 comparison,int256 threshold) condition,uint64 biddingEnd,uint64 windowStart,uint64 windowEnd,uint64 judgingEnd,uint256 premium,uint256 minCoverage,uint256 coverage,uint256 usedPremium,uint256 unitShare,uint16 soldUnits,uint8 status))",
  "function statusOf(uint256) view returns (uint8)",
  "function bidsOf(uint256) view returns (tuple(address bidder,uint16 units,uint16 filled,bool refunded,bool claimed,uint256 unitCoverage)[])",
  "function holdingOf(uint256,address) view returns (uint256 units,uint256 deposit)",
  "function credits(address) view returns (uint256)",
  "function requestPolicy(uint256 tokenId, tuple(address oracle,bytes32 kind,uint8 comparison,int256 threshold) condition, uint256 minCoverage, uint64 biddingEnd) payable returns (uint256)",
  "function placeBid(uint256 policyId, uint16 units, uint256 unitCoverage) payable",
  "function bind(uint256 policyId)",
  "function voidPolicy(uint256 policyId)",
  "function claim(uint256 policyId)",
  "function withdraw()",
];
const NFT_ABI = [
  "function totalMinted() view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function bookingOf(uint256) view returns (tuple(bytes32 subject,uint64 start,uint64 end,uint256 amount))",
];
const ERRORS = {
  NotBookingOwner: "이 예약 NFT의 소유자가 아니에요",
  InvalidRequest: "입력값을 확인해 주세요 (모집 마감은 예약 시작 전이어야 해요)",
  WrongStatus: "지금 단계에서는 할 수 없어요",
  BiddingClosed: "입찰이 마감됐어요",
  BiddingOpen: "아직 입찰 중이에요",
  NotAllowed: "구매자와 오라클은 입찰할 수 없어요",
  BelowMinimum: "지분당 보장금액이 시작가보다 낮아요",
  WrongPayment: "예치금이 지분 수 × 지분당 보장금액과 달라요",
  TooManyBids: "이 보험의 입찰이 가득 찼어요",
  JudgingClosed: "판정 기간이 아니에요",
  JudgingOpen: "아직 판정 기간이에요",
  WrongOracle: "조건에 지정된 오라클의 서명이 아니에요",
  NothingToClaim: "청구할 금액이 없어요",
};
const STATUS = ["없음", "모집 중", "보장 중", "유찰", "지급", "만료", "무효"];
const STATUS_CHIP = ["gray", "info", "info", "gray", "bad", "good", "warn"];
const TEST_KEYS = {
  4: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  5: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  6: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  7: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
};

const QUERY = new URLSearchParams(location.search);
const HOST = location.hostname || "127.0.0.1";
const RPC = QUERY.get("rpc") || `http://${HOST}:8545`;
const PLATFORM = QUERY.get("platform") || `http://${HOST}:8787`;
const ORACLE_API = QUERY.get("oracle") || "http://127.0.0.1:8788";
const ETH_KRW = Number(QUERY.get("krw")) > 0 ? Number(QUERY.get("krw")) : 3258000;

const provider = new ethers.JsonRpcProvider(RPC);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const eth = (wei) => `${Number(ethers.formatEther(wei)).toLocaleString("ko-KR", { maximumFractionDigits: 6 })} ETH`;
const krw = (wei) => `${Math.round(Number(ethers.formatEther(wei)) * ETH_KRW).toLocaleString("ko-KR")}원`;
const money = (wei) => `<span class="money"><span>${krw(wei)}</span><small>${eth(wei)}</small></span>`;
const when = (ts) => new Date(Number(ts) * 1000).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const left = (ts, now) => {
  const s = Number(ts) - now;
  if (s <= 0) return "지남";
  return s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분 남음` : `${Math.ceil(s / 60)}분 남음`;
};

async function api(base, path, body) {
  const res = await fetch(`${base}${path}`, body ? { method: "POST", body: JSON.stringify(body) } : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status}`);
  return data;
}

function toast(message, error = false) {
  const el = $("toast");
  el.textContent = message;
  el.className = `toast on${error ? " err" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.className = "toast"), error ? 4200 : 2400);
}

function reason(e, iface) {
  const data = e?.data || e?.info?.error?.data || e?.error?.data;
  if (data && iface) {
    try {
      const parsed = iface.parseError(data);
      if (parsed) return ERRORS[parsed.name] || parsed.name;
    } catch {}
  }
  const text = e?.shortMessage || e?.message || String(e);
  const named = Object.keys(ERRORS).find((k) => text.includes(k));
  return named ? ERRORS[named] : text;
}

function tempKey() {
  try {
    let key = localStorage.getItem("trip.tempKey");
    if (!key) localStorage.setItem("trip.tempKey", (key = ethers.Wallet.createRandom().privateKey));
    return key;
  } catch {
    return (tempKey.memory ||= ethers.Wallet.createRandom().privateKey);
  }
}

async function setup({ defaultRole } = {}) {
  const select = $("walletMode");
  const config = await api(PLATFORM, "/config");
  const cases = await api(PLATFORM, "/cases");
  const ctx = { config, cases, provider };
  ctx.read = new ethers.Contract(config.insurance, INSURANCE_ABI, provider);
  ctx.nft = new ethers.Contract(config.nft, NFT_ABI, provider);

  ctx.connect = () => {
    const key = select.value === "temp" ? tempKey() : TEST_KEYS[select.value];
    ctx.wallet = new ethers.Wallet(key, provider);
    ctx.address = ctx.wallet.address;
    ctx.write = new ethers.Contract(config.insurance, INSURANCE_ABI, ctx.wallet);
    $("dot").className = "dot on";
  };
  if (select) {
    const saved = QUERY.get("wallet") || (HOST === "localhost" || HOST === "127.0.0.1" ? String(defaultRole) : "temp");
    if ([...select.options].some((o) => o.value === saved)) select.value = saved;
    ctx.connect();
    select.addEventListener("change", () => {
      ctx.connect();
      ctx.refresh?.();
    });
  }

  ctx.caseOf = (subject) => cases.find((c) => c.subjectId === subject);
  ctx.now = async () => Number((await provider.getBlock("latest")).timestamp);

  ctx.send = async (label, run) => {
    try {
      const tx = await run();
      toast(`${label} 보내는 중…`);
      await tx.wait();
      toast(`${label} 완료`);
      return true;
    } catch (e) {
      toast(reason(e, ctx.read.interface), true);
      return false;
    }
  };

  ctx.policies = async () => {
    const count = Number(await ctx.read.policyCount());
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    return Promise.all(
      ids.map(async (id) => {
        const [policy, status, bids] = await Promise.all([ctx.read.policyOf(id), ctx.read.statusOf(id), ctx.read.bidsOf(id)]);
        return { id, policy, status: Number(status), stored: Number(policy.status), bids, item: ctx.caseOf(policy.subject) };
      })
    );
  };

  ctx.gasBanner = async () => {
    const low = (await provider.getBalance(ctx.address)) < ethers.parseEther("0.01");
    $("gas").hidden = !low;
  };
  $("gasBtn")?.addEventListener("click", async () => {
    try {
      await api(PLATFORM, "/faucet", { to: ctx.address });
      toast("테스트 ETH를 받았어요");
      ctx.refresh?.();
    } catch (e) {
      toast(e.message, true);
    }
  });
  return ctx;
}

function statusChip(status) {
  return `<span class="chip ${STATUS_CHIP[status]}">${STATUS[status]}</span>`;
}

function allocation(bids) {
  const order = bids.map((bid, i) => ({ bid, i })).sort((a, b) => (b.bid.unitCoverage > a.bid.unitCoverage ? 1 : b.bid.unitCoverage < a.bid.unitCoverage ? -1 : a.i - b.i));
  const filled = bids.map(() => 0);
  let remaining = 100;
  for (const { bid, i } of order) {
    const taken = Math.min(Number(bid.units), remaining);
    filled[i] = taken;
    remaining -= taken;
  }
  return filled;
}

function conditionText(item) {
  return item ? `${item.label} ${item.threshold}${item.unit} 이상이면 지급` : "알 수 없는 조건";
}
