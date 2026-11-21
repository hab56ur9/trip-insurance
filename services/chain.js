const fs = require("fs");
const path = require("path");
const { JsonRpcProvider, Wallet, Contract, id } = require("ethers");

const ROOT = path.join(__dirname, "..");

const ANVIL_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
];

const ROLES = {
  deployer: 0,
  treasury: 1,
  issuer: 2,
  oracle: 3,
  buyer: 4,
  alice: 5,
  bob: 6,
  carol: 7,
  keeper: 8,
};

const STATUS = ["None", "Auction", "Bound", "Cancelled", "Paid", "Expired", "Voided"];

function abi(name) {
  const file = path.join(ROOT, "out", `${name}.sol`, `${name}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")).abi;
}

function deployment(chainId) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "deployments", `${chainId}.json`), "utf8"));
}

const LOCAL_CHAIN_ID = 31337;
const SERVICE_KEYS = { issuer: "ISSUER_KEY", oracle: "ORACLE_KEY", faucet: "FAUCET_KEY" };
const LOCAL_SERVICE_ROLES = { issuer: "issuer", oracle: "oracle", faucet: "deployer" };

function serviceWallets(provider, local) {
  return Object.fromEntries(
    Object.entries(SERVICE_KEYS).map(([role, env]) => {
      const key = process.env[env] || (local ? ANVIL_KEYS[ROLES[LOCAL_SERVICE_ROLES[role]]] : null);
      if (!key) throw new Error(`${env} is required outside the local chain`);
      return [role, new Wallet(key, provider)];
    })
  );
}

async function connect(rpc = process.env.RPC || "http://127.0.0.1:8545") {
  const provider = new JsonRpcProvider(rpc, undefined, { polling: true, pollingInterval: 250 });
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const local = chainId === LOCAL_CHAIN_ID;
  const addresses = deployment(chainId);
  const wallets = local
    ? Object.fromEntries(Object.entries(ROLES).map(([role, index]) => [role, new Wallet(ANVIL_KEYS[index], provider)]))
    : {};
  Object.assign(wallets, serviceWallets(provider, local));
  const insurance = (signer) => new Contract(addresses.insurance, abi("TripInsurance"), signer || provider);
  const nft = (signer) => new Contract(addresses.nft, abi("BookingNFT"), signer || provider);

  return {
    provider,
    chainId,
    local,
    publicRpc: process.env.PUBLIC_RPC || "",
    addresses,
    wallets,
    insurance,
    nft,
    judgePeriod: Number(addresses.judgePeriod),
    minGap: Number(addresses.minGap),
    now: async () => Number((await provider.getBlock("latest")).timestamp),
  };
}

function statusOf(policy) {
  return STATUS[Number(policy.status)];
}

async function signObservation(wallet, insurance, policyId, value) {
  const digest = await insurance.observationHash(policyId, value);
  return wallet.signMessage(Buffer.from(digest.slice(2), "hex"));
}

module.exports = { connect, ROLES, ANVIL_KEYS, STATUS, statusOf, signObservation, kindId: id, abi, deployment };
