import { assert } from "chai";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccount,
  createMint,
  mintTo,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";

const REWARD_MINT_KEYPAIR = Keypair.generate();
const LP_MINT_KEYPAIR = Keypair.generate();

const PAYER_KEYPAIR = Keypair.generate();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe("rewarder", () => {
  const provider = AnchorProvider.env();
  const rewarderContext = new RewarderContext(provider);

  let rewarderAddress: PublicKey, poolAddress: PublicKey;

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

  it("creates rewarder", async () => {
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

  it("creates pool", async () => {
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
    assert.equal(pool.dailyRewards, 0);

    poolAddress = address;

    await sleep(5_000);
  });

  it("deposits 100 LP token", async () => {
    const pool = await rewarderContext.loadPool(poolAddress);

    const signature = await rewarderContext.deposit({ pool, amount: 100 });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const reloadedPool = await rewarderContext.loadPool(poolAddress);
    assert.deepEqual(
      reloadedPool.rewarder.data.totalWeights,
      reloadedPool.data.totalWeights,
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
    assert.equal(miner.pool.dailyRewards, miner.pool.rewarder.dailyRewards);

    await sleep(5_000);
    assert.ok(miner.rewards > 0);
  });

  it("withdraws 50 LP token", async () => {
    const pool = await rewarderContext.loadPool(poolAddress);

    const signature = await rewarderContext.withdraw({ pool, amount: 50 });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const reloadedPool = await rewarderContext.loadPool(poolAddress);
    assert.deepEqual(
      reloadedPool.rewarder.data.totalWeights,
      reloadedPool.data.totalWeights,
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

  it("deposits 50 LP token", async () => {
    const pool = await rewarderContext.loadPool(poolAddress);

    const signature = await rewarderContext.deposit({ pool, amount: 50 });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const reloadedPool = await rewarderContext.loadPool(poolAddress);
    assert.deepEqual(
      reloadedPool.rewarder.data.totalWeights,
      reloadedPool.data.totalWeights,
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

  it("claim rewards", async () => {
    const pool = await rewarderContext.loadPool(poolAddress);

    const signature = await rewarderContext.claim({ pool });

    await provider.connection.confirmTransaction({
      ...(await provider.connection.getLatestBlockhash()),
      signature,
    });

    const reloadedPool = await rewarderContext.loadPool(poolAddress);
    const miner = await rewarderContext.loadMiner(reloadedPool);
    assert.isNotNull(miner);
    assert.deepEqual(
      miner.rewardsClaimed,
      miner.pool.rewarder.totalRewardsClaimed,
    );
  });
});
