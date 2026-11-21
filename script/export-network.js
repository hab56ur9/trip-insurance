const fs = require("fs");
const path = require("path");
const { Wallet, isAddress } = require("ethers");
const { catalog } = require("../services/cases");

const NETWORKS = { "base-sepolia": { chainId: 84532, rpc: "https://sepolia.base.org" } };

function main() {
  const name = process.argv[2] || "base-sepolia";
  const network = NETWORKS[name];
  if (!network) throw new Error(`unknown network: ${name}`);
  const root = path.join(__dirname, "..");
  const deployed = JSON.parse(fs.readFileSync(path.join(root, "deployments", `${network.chainId}.json`), "utf8"));
  const oracleKey = process.env.ORACLE_KEY || process.env.UNSAFE_DEMO_KEY;
  const oracle = process.env.ORACLE || (oracleKey && new Wallet(oracleKey).address);
  if (!isAddress(oracle || "")) throw new Error("ORACLE, ORACLE_KEY or UNSAFE_DEMO_KEY is required");
  const file = path.join(root, "ui", "networks", `${name}.json`);
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).config : {};
  const config = {
    chainId: network.chainId,
    local: false,
    rpc: process.env.PUBLIC_RPC || network.rpc,
    insurance: deployed.insurance,
    nft: deployed.nft,
    oracle,
    minGap: deployed.minGap,
    judgePeriod: deployed.judgePeriod,
    participants: process.env.PARTICIPANTS_URL || previous.participants || "",
  };
  fs.writeFileSync(file, `${JSON.stringify({ config, cases: catalog() }, null, 2)}\n`);
  console.log(`wrote ${path.relative(root, file)}`);
}

main();
