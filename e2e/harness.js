const { spawn, spawnSync } = require("child_process");
const path = require("path");
const os = require("os");
const { Wallet } = require("ethers");
const { connect, ANVIL_KEYS, ROLES } = require("../services/chain");
const { createPlatform } = require("../services/platform");
const { createOracle } = require("../services/oracle");

const ROOT = path.join(__dirname, "..");
const FOUNDRY = path.join(os.homedir(), ".foundry", "bin");
const PORT = Number(process.env.E2E_PORT || 18545);
const RPC = `http://127.0.0.1:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const addressOf = (role) => new Wallet(ANVIL_KEYS[ROLES[role]]).address;

async function rpcUp() {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function startAnvil(blockTime) {
  const anvil = spawn(path.join(FOUNDRY, "anvil"), ["--port", String(PORT), "--block-time", String(blockTime), "--silent"], { stdio: "ignore" });
  process.once("exit", () => anvil.kill());
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => process.exit(1));
  return anvil;
}

function deploy() {
  const env = { ...process.env, PATH: `${FOUNDRY}:${process.env.PATH}`, PROFILE: "local", ISSUER: addressOf("issuer"), TREASURY: addressOf("treasury") };
  const result = spawnSync(
    path.join(FOUNDRY, "forge"),
    ["script", "script/Deploy.s.sol", "--rpc-url", RPC, "--private-key", ANVIL_KEYS[ROLES.deployer], "--broadcast", "--silent"],
    { cwd: ROOT, env, encoding: "utf8" }
  );
  if (result.status !== 0) throw new Error(`deploy failed\n${result.stdout}\n${result.stderr}`);
}

function listening(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

async function boot({ blockTime = 1, log = () => {} } = {}) {
  if (await rpcUp()) throw new Error(`port ${PORT} already serves a chain; stop it or set E2E_PORT`);
  const anvil = startAnvil(blockTime);
  for (let i = 0; i < 50 && !(await rpcUp()); i++) await sleep(200);
  deploy();
  const chain = await connect(RPC);
  const platform = createPlatform({ chain, log });
  const oracle = createOracle({ chain, log, blockTime });
  const stop = oracle.start(300);
  const servers = [platform.serve(0), oracle.serve(0)];
  const [platformUrl, oracleUrl] = await Promise.all(servers.map(listening));

  async function waitFor(check, label, timeoutMs = 20000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await check()) return;
      await sleep(250);
    }
    throw new Error(`timeout waiting for ${label}`);
  }

  function shutdown() {
    stop();
    servers.forEach((server) => server.close());
    anvil.kill();
  }

  return { chain, platform, oracle, waitFor, shutdown, urls: { platform: platformUrl, oracle: oracleUrl } };
}

module.exports = { boot, sleep };
