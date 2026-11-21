const { connect } = require("./chain");
const { createPlatform } = require("./platform");
const { createOracle } = require("./oracle");

async function main() {
  const chain = await connect();
  const log = (line) => console.log(new Date().toISOString(), line);
  const platform = createPlatform({ chain, log });
  const oracle = createOracle({ chain, log, blockTime: Number(process.env.BLOCK_TIME || 12) });

  const host = process.env.SERVICE_HOST || "127.0.0.1";
  const platformPort = Number(process.env.PLATFORM_PORT || 8787);
  const oraclePort = Number(process.env.ORACLE_PORT || 8788);
  platform.serve(platformPort, host).on("error", exitOnListenError("platform"));
  oracle.serve(oraclePort).on("error", exitOnListenError("oracle"));
  oracle.start();

  log(`insurance ${chain.addresses.insurance} · nft ${chain.addresses.nft} · oracle ${oracle.address}`);
  log(`platform API http://127.0.0.1:${platformPort}  GET /cases · GET /config · POST /bookings · POST /faucet`);
  log(`oracle API   http://127.0.0.1:${oraclePort}  POST /report · POST /time · GET /reports (이 호스트만)`);
}

function exitOnListenError(name) {
  return (e) => {
    console.error(`${name} API could not listen: ${e.code === "EADDRINUSE" ? `port ${e.port} is already in use` : e.message}`);
    process.exit(1);
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
