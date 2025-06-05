import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { RewarderContext, VestoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function unstake(program: Command) {
  program
    .command("vesto-unstake")
    .description("unstake IOU token")
    .requiredOption("--pool-k <string>", "IOU pool key", parseKey)
    .option("--user-k <string>", "User key", parseKey)
    .action(
      async ({ poolK, userK }: { poolK: PublicKey; userK?: PublicKey }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const vestoContext = new VestoContext(provider);
        const pool = await vestoContext.loadPool(poolK);
        const position = await vestoContext.loadPosition(pool, userK);
        if (!position) throw new Error("Vesting position does not exist");

        const rewarderContext = new RewarderContext(provider);
        const rewarder = await rewarderContext.loadRewarder(
          pool.config.governo.rewarderAddress,
        );
        const rewardPools = await rewarderContext.loadPoolsByRewarder(rewarder);
        const rewardPool = rewardPools.find((rewardPool) =>
          rewardPool.mintAddress.equals(pool.iouMintAddress),
        );
        if (!rewardPool) throw new Error("Reward pool not available");

        const miner = await rewarderContext.loadMiner(
          rewardPool,
          position.address,
        );
        if (!miner) throw new Error("Reward miner does not exist");

        const signature = await vestoContext.unstake({
          miner,
          position,
          priorityLevel,
          simulate,
        });
        console.log(signature);
      },
    );
}
