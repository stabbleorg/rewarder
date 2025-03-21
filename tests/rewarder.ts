import { assert } from "chai";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccount,
  createMint,
  mintTo,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { RewarderContext, GovernoContext } from "@stabbleorg/rewarder-sdk";

const REWARD_MINT_KEYPAIR = Keypair.generate();
const LP_MINT_KEYPAIR = Keypair.generate();
const VE_MINT_KEYPAIR = Keypair.generate();

const PAYER_KEYPAIR = Keypair.generate();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe("rewarder", () => {
  const provider = AnchorProvider.env();
  const rewarderContext = new RewarderContext(provider);
  const governoContext = new GovernoContext(provider);

  let rewarderAddress: PublicKey,
    poolAddress: PublicKey,
    governoAddress: PublicKey,
    vePoolAddress: PublicKey;

  before(async () => {
    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature: await provider.connection.requestAirdrop(
        PAYER_KEYPAIR.publicKey,
        LAMPORTS_PER_SOL,
      ),
    });

    await createMint(
      provider.connection,
      PAYER_KEYPAIR,
      PAYER_KEYPAIR.publicKey,
      null,
      6,
      REWARD_MINT_KEYPAIR,
    );
    await mintTo(
      provider.connection,
      PAYER_KEYPAIR,
      REWARD_MINT_KEYPAIR.publicKey,
      await createAssociatedTokenAccount(
        provider.connection,
        PAYER_KEYPAIR,
        REWARD_MINT_KEYPAIR.publicKey,
        provider.publicKey,
      ),
      PAYER_KEYPAIR,
      BigInt("1000000000000"), // 1M
    );

    await createMint(
      provider.connection,
      PAYER_KEYPAIR,
      PAYER_KEYPAIR.publicKey,
      null,
      9,
      LP_MINT_KEYPAIR,
    );
    await mintTo(
      provider.connection,
      PAYER_KEYPAIR,
      LP_MINT_KEYPAIR.publicKey,
      await createAssociatedTokenAccount(
        provider.connection,
        PAYER_KEYPAIR,
        LP_MINT_KEYPAIR.publicKey,
        provider.publicKey,
      ),
      PAYER_KEYPAIR,
      BigInt("1000000000000000"), // 1M
    );
  });

  it("should create a rewarder", async () => {
    const time = Date.now();
    const totalRewards = 500000; // 500K

    const { address, signature } = await rewarderContext.createRewarder({
      mintAddress: REWARD_MINT_KEYPAIR.publicKey,
      totalRewards,
      startsAt: new Date(time + 20_000), // 20s delay
      endsAt: new Date(time + 120_000), // 100s duration
    });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const rewarder = await rewarderContext.loadRewarder(address);
    assert.deepEqual(rewarder.mintAddress, REWARD_MINT_KEYPAIR.publicKey);
    assert.equal(rewarder.totalRewards, totalRewards);

    rewarderAddress = address;
  });

  it("should create a pool", async () => {
    const { address, signature } = await rewarderContext.createPool({
      rewarderAddress,
      mintAddress: LP_MINT_KEYPAIR.publicKey,
      weight: 1,
    });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const pool = await rewarderContext.loadPool(address);
    assert.deepEqual(pool.mintAddress, LP_MINT_KEYPAIR.publicKey);
    assert.equal(pool.weight, 1);
    assert.equal(pool.dailyRewardsPerAmount, 0);
    assert.equal(pool.weeklyRewardsPerAmount, 0);
    assert.equal(pool.monthlyRewardsPerAmount, 0);

    poolAddress = address;
  });

  it("should create a governo", async () => {
    const { address, signature } = await governoContext.createGoverno({
      mintAddress: LP_MINT_KEYPAIR.publicKey,
      minLockDuration: 1,
      maxLockDuration: 30,
      veMintKeypair: VE_MINT_KEYPAIR,
    });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const governo = await governoContext.loadGoverno(address);
    assert.deepEqual(governo.govMintAddress, LP_MINT_KEYPAIR.publicKey);
    assert.deepEqual(governo.veMintAddress, VE_MINT_KEYPAIR.publicKey);
    assert.equal(governo.totalLockedAmount, 0);

    governoAddress = address;
  });

  it("should create a pool for governo", async () => {
    const { address, signature } = await rewarderContext.createPool({
      rewarderAddress,
      mintAddress: VE_MINT_KEYPAIR.publicKey,
      weight: 1,
    });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const pool = await rewarderContext.loadPool(address);
    assert.deepEqual(pool.mintAddress, VE_MINT_KEYPAIR.publicKey);
    assert.equal(pool.weight, 1);
    assert.equal(pool.dailyRewardsPerAmount, 0);
    assert.equal(pool.weeklyRewardsPerAmount, 0);
    assert.equal(pool.monthlyRewardsPerAmount, 0);

    vePoolAddress = address;

    await sleep(5_000);
  });

  it("should lock 100 LP token for 20 seconds", async () => {
    const pool = await rewarderContext.loadPool(vePoolAddress);
    const governo = await governoContext.loadGoverno(governoAddress);

    const { signature } = await governoContext.lock({
      pool,
      governo,
      amount: 100,
      duration: 20,
    });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const reloadedPool = await rewarderContext.loadPool(vePoolAddress);
    assert.deepEqual(
      reloadedPool.rewarder.data.totalWeights,
      reloadedPool.data.totalWeights,
    );

    const lockers = await governoContext.loadLockers(governo);
    const locker = lockers[0];
    assert.equal(locker.lockedAmount, 100);
    assert.ok(locker.votingWeight >= 100);
  });

  it("should deposit 100 LP token", async () => {
    const pool = await rewarderContext.loadPool(poolAddress);

    const signature = await rewarderContext.deposit({ pool, amount: 100 });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const reloadedPool = await rewarderContext.loadPool(poolAddress);
    assert.ok(
      reloadedPool.rewarder.data.totalWeights.gt(
        reloadedPool.data.totalWeights,
      ),
    );
    assert.ok(
      reloadedPool.rewarder.data.lastUpdatedAt.gte(
        pool.rewarder.data.lastUpdatedAt,
      ),
    );
    assert.ok(
      reloadedPool.rewarder.data.rewardsPerWeight.gte(
        pool.rewarder.data.rewardsPerWeight,
      ),
    );
    assert.ok(
      reloadedPool.data.rewardsPerAmount.gte(pool.data.rewardsPerAmount),
    );

    const miner = await rewarderContext.loadMiner(reloadedPool);
    assert.isNotNull(miner);
    assert.equal(miner.amount, 100);

    await sleep(5_000);
    assert.ok(miner.rewards > 0);
  });

  it("should withdraw 50 LP token", async () => {
    const pool = await rewarderContext.loadPool(poolAddress);

    const signature = await rewarderContext.withdraw({ pool, amount: 50 });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const reloadedPool = await rewarderContext.loadPool(poolAddress);
    assert.ok(
      reloadedPool.rewarder.data.totalWeights.gt(
        reloadedPool.data.totalWeights,
      ),
    );
    assert.ok(
      reloadedPool.rewarder.data.lastUpdatedAt.gte(
        pool.rewarder.data.lastUpdatedAt,
      ),
    );
    assert.ok(
      reloadedPool.rewarder.data.rewardsPerWeight.gte(
        pool.rewarder.data.rewardsPerWeight,
      ),
    );
    assert.ok(
      reloadedPool.data.rewardsPerAmount.gte(pool.data.rewardsPerAmount),
    );

    const miner = await rewarderContext.loadMiner(reloadedPool);
    assert.isNotNull(miner);
    assert.equal(miner.amount, 50);

    await sleep(5_000);
    assert.ok(miner.rewards > 0);
  });

  it("should deposit 50 LP token", async () => {
    const pool = await rewarderContext.loadPool(poolAddress);

    const signature = await rewarderContext.deposit({ pool, amount: 50 });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const reloadedPool = await rewarderContext.loadPool(poolAddress);
    assert.ok(
      reloadedPool.rewarder.data.totalWeights.gt(
        reloadedPool.data.totalWeights,
      ),
    );
    assert.ok(
      reloadedPool.rewarder.data.lastUpdatedAt.gte(
        pool.rewarder.data.lastUpdatedAt,
      ),
    );
    assert.ok(
      reloadedPool.rewarder.data.rewardsPerWeight.gte(
        pool.rewarder.data.rewardsPerWeight,
      ),
    );
    assert.ok(
      reloadedPool.data.rewardsPerAmount.gte(pool.data.rewardsPerAmount),
    );

    const miner = await rewarderContext.loadMiner(reloadedPool);
    assert.isNotNull(miner);
    assert.equal(miner.amount, 100);

    await sleep(5_000);
    assert.ok(miner.rewards > 0);
  });

  it("should claim rewards", async () => {
    const pool = await rewarderContext.loadPool(poolAddress);
    const miner = await rewarderContext.loadMiner(pool);

    assert.isNotNull(miner);
    const signature = await rewarderContext.claim({ miners: [miner] });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const reloadedPool = await rewarderContext.loadPool(poolAddress);
    const reloadedMiner = await rewarderContext.loadMiner(reloadedPool);
    assert.isNotNull(reloadedMiner);
    assert.deepEqual(
      reloadedMiner.rewardsClaimed,
      reloadedMiner.pool.rewarder.totalRewardsClaimed,
    );
  });

  it("should claim locker rewards", async () => {
    const governo = await governoContext.loadGoverno(governoAddress);
    const lockers = await governoContext.loadLockers(governo);
    const locker = lockers[0];

    const pool = await rewarderContext.loadPool(vePoolAddress);
    const miner = await rewarderContext.loadMiner(
      pool,
      locker.authorityAddress,
    );
    assert.isNotNull(miner);

    const signature = await governoContext.claim({ miner, locker });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });
  });

  it("should should not unlock", async () => {
    const governo = await governoContext.loadGoverno(governoAddress);
    const lockers = await governoContext.loadLockers(governo);
    const locker = lockers[0];

    const pool = await rewarderContext.loadPool(vePoolAddress);

    try {
      await governoContext.unlock({ pool, locker });
      assert.fail();
    } catch (err) {
      assert.instanceOf(err, Error);
    }

    await sleep(5_000);
  });

  it("should should unlock", async () => {
    const governo = await governoContext.loadGoverno(governoAddress);
    const lockers = await governoContext.loadLockers(governo);
    const locker = lockers[0];

    const pool = await rewarderContext.loadPool(vePoolAddress);

    const signature = await governoContext.unlock({ pool, locker });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const postLockers = await governoContext.loadLockers(governo);
    assert.equal(postLockers.length, 0);
  });
});
