const { id } = require("ethers");

const CASES = [
  {
    key: "ktx",
    title: "KTX 지연 보험",
    booking: "KTX-101 서울 → 강릉",
    subject: "KTX-101",
    amountEth: "0.06",
    kind: "rail.delay.min",
    label: "도착 지연",
    unit: "분",
    threshold: 30,
    riskPct: 2,
    premiumEth: "0.0018",
    minCoverageEth: "0.06",
  },
  {
    key: "hotel",
    title: "숙소 폭우 보험",
    booking: "강릉 바다 펜션 1박",
    subject: "KMA-105",
    amountEth: "0.12",
    kind: "rain.mm",
    label: "일 강수량",
    unit: "mm",
    threshold: 50,
    riskPct: 4,
    premiumEth: "0.0072",
    minCoverageEth: "0.12",
  },
  {
    key: "surf",
    title: "서핑 강풍 보험",
    booking: "강릉 서핑 강습",
    subject: "KMA-105",
    amountEth: "0.05",
    kind: "wind.ms",
    label: "최대 풍속",
    unit: "m/s",
    threshold: 14,
    riskPct: 6,
    premiumEth: "0.0045",
    minCoverageEth: "0.05",
  },
];

const caseOf = (key) => CASES.find((c) => c.key === key);
const subjectOf = (item) => id(`${item.key}:${item.subject}`);
const catalog = () => CASES.map((item) => ({ ...item, subjectId: subjectOf(item), kindId: id(item.kind) }));

module.exports = { CASES, caseOf, subjectOf, catalog };
