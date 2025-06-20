import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function withdrawMiner(program: Command) {
  program
    .command("miner-withdraw")
    .description("unstake miner")
    .requiredOption("--mint-k <string>", "Mint key to unstake", parseKey)
    .requiredOption("--amount <number>", "Amount to unstake")
    .action(async ({ mintK, amount }: { mintK: PublicKey; amount: string }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const rewarderContext = new RewarderContext(provider);

      const rewarders = await rewarderContext.loadRewarders();
      const rewardersMap = new Map(
        rewarders.map((rewarder) => [rewarder.address.toBase58(), rewarder]),
      );

      const pools = await rewarderContext.loadPools(rewardersMap);
      const poolsMap = new Map(
        pools.map((pool) => [pool.address.toBase58(), pool]),
      );

      const miners = await rewarderContext.loadMiners(poolsMap);

      const primaryMiner = miners.find(
        (miner) =>
          !miner.pool.rewarder.parentRewarder &&
          miner.pool.mintAddress.equals(mintK),
      );
      if (!primaryMiner) return;

      const derivedMiner = miners.find(
        (miner) =>
          miner.pool.rewarder.parentRewarder?.address.equals(
            primaryMiner.pool.rewarder.address,
          ) && miner.pool.mintAddress.equals(mintK),
      );

      const signature = await rewarderContext.withdraw({
        pool: primaryMiner.pool,
        derivedPool: derivedMiner?.pool,
        amount,
        priorityLevel,
        simulate,
      });

      console.log(signature);
    });
}
