const { getAddress, isAddress, parseEther, formatEther, NonceManager, id } = require("ethers");
const { CASES, caseOf } = require("./cases");
const { createJsonServer, RequestError } = require("./http");

const FAUCET_ETH = process.env.FAUCET_ETH || "0.05";
const START_AFTER = Number(process.env.BOOKING_START_AFTER || 30 * 60);
const DURATION = Number(process.env.BOOKING_DURATION || 60 * 60);

const subjectOf = (item) => id(`${item.key}:${item.subject}`);

function createPlatform({ chain, log = () => {} }) {
  const issuer = new NonceManager(chain.wallets.issuer);
  const faucetWallet = new NonceManager(chain.wallets.faucet);
  const nft = chain.nft(issuer);
  const granted = new Set();

  async function book({ to, case: key }) {
    if (typeof to !== "string" || !isAddress(to)) throw new RequestError("지갑 주소가 아니에요");
    const item = caseOf(key);
    if (!item) throw new RequestError("없는 예약 상품이에요");
    const start = (await chain.now()) + START_AFTER;
    const end = start + DURATION;
    const tx = await nft.mint(getAddress(to), subjectOf(item), start, end, parseEther(item.amountEth)).catch((e) => {
      issuer.reset();
      throw e;
    });
    const receipt = await tx.wait();
    const tokenId = receipt.logs.map((l) => nft.interface.parseLog(l)).find((l) => l && l.name === "Transfer").args.tokenId;
    log(`issuer minted booking #${tokenId} (${item.key}) → ${to.slice(0, 8)}`);
    return { tokenId: tokenId.toString(), case: item.key, start, end };
  }

  async function importBookings({ to }) {
    if (typeof to !== "string" || !isAddress(to)) throw new RequestError("지갑 주소가 아니에요");
    const owner = getAddress(to);
    const read = chain.nft();
    const total = Number(await read.totalMinted());
    const owned = new Set();
    for (let tokenId = 1; tokenId <= total; tokenId++) {
      if ((await read.ownerOf(tokenId)) === owner) owned.add((await read.bookingOf(tokenId)).subject);
    }
    const added = [];
    for (const item of CASES) {
      if (owned.has(subjectOf(item))) continue;
      added.push(await book({ to: owner, case: item.key }));
    }
    return { added: added.length, bookings: added };
  }

  async function faucet({ to }) {
    if (typeof to !== "string" || !isAddress(to)) throw new RequestError("지갑 주소가 아니에요");
    const address = getAddress(to);
    if (granted.has(address)) throw new RequestError("이미 받은 지갑이에요", 409);
    granted.add(address);
    try {
      const value = parseEther(FAUCET_ETH);
      const tx = await faucetWallet.sendTransaction({ to: address, value });
      await tx.wait();
      log(`faucet ${formatEther(value)} ETH → ${address.slice(0, 8)}`);
      return { hash: tx.hash, amount: value.toString() };
    } catch (e) {
      granted.delete(address);
      faucetWallet.reset();
      throw e;
    }
  }

  const cases = () => CASES.map((item) => ({ ...item, subjectId: subjectOf(item), kindId: id(item.kind) }));

  const routes = {
    "GET /cases": cases,
    "GET /config": () => ({ ...chain.addresses, chainId: chain.chainId, local: chain.local, rpc: chain.publicRpc, oracle: chain.wallets.oracle.address }),
    "POST /bookings": book,
    "POST /bookings/import": importBookings,
    "POST /faucet": faucet,
  };

  return { book, importBookings, faucet, cases, serve: (port, host = "127.0.0.1") => createJsonServer(routes, log).listen(port, host) };
}

module.exports = { createPlatform, subjectOf };
