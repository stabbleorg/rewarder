import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseDate, parseKey } from "../utils";

export function updateRewarder(program: Command) {
  program
    .command("rewarder-update")
    .description("update the rewarder")
    .requiredOption("--rewarder-k <string>", "reward mint key", parseKey)
    .requiredOption("--total-rewards <number>", "total rewards")
    .requiredOption("--starts-at <string>", "epoch start time", parseDate)
    .requiredOption("--ends-at <string>", "epoch end time", parseDate)
    .action(
      async ({
        rewarderK,
        totalRewards,
        startsAt,
        endsAt,
      }: {
        rewarderK: PublicKey;
        totalRewards: string;
        startsAt: Date;
        endsAt: Date;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const rewarderContext = new RewarderContext(provider);

        const rewarder = await rewarderContext.loadRewarder(rewarderK);

        if (simulate) {
          console.log("Authority:", rewarder.authorityAddress.toBase58());
          console.log("Cumulative rewards:", rewarder.cumulativeRewards);
          console.log("Total rewards:", rewarder.totalRewards);
          console.log("Total rewards claimed:", rewarder.totalRewardsClaimed);
          console.log("Total weights:", rewarder.totalWeights);
          console.log("Starts at:", rewarder.startsAt);
          console.log("Ends at:", rewarder.endsAt);
          return;
        }

        const signature = await rewarderContext.updateRewarder({
          rewarder,
          totalRewards,
          startsAt,
          endsAt,
          liquidity: false,
          priorityLevel,
        });

        console.log(signature);
      },
    );
}
