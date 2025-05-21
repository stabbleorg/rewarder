import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { RewarderContext, VestoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function redeem(program: Command) {
  program
    .command("vesto-redeem")
    .description("redeem IOU token")
    .requiredOption("--pool-k <string>", "IOU pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const vestoContext = new VestoContext(provider);
      const pool = await vestoContext.loadPool(poolK);

      const rewarderContext = new RewarderContext(provider);
      const rewarder = await rewarderContext.loadRewarder(
        pool.config.governo.rewarderAddress,
      );
      const rewardPools = await rewarderContext.loadPoolsByRewarder(rewarder);
      const rewardPool = rewardPools.find((rewardPool) =>
        rewardPool.mintAddress.equals(pool.iouMintAddress),
      );
      if (!rewardPool) throw new Error("Reward pool not available");

      const signature = await vestoContext.redeem({
        pool,
        rewardPool,
        priorityLevel,
        simulate,
      });
      console.log(signature);
    });
}
