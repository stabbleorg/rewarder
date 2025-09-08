import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function reduceRewarderEmissions(program: Command) {
  program
    .command("rewarder-reduce")
    .description("reduce the total rewards of a rewarder")
    .requiredOption("--rewarder-k <string>", "rewarder key", parseKey)
    .requiredOption("--reduce-amount <number>", "amount to reduce total rewards by")
    .action(
      async ({
       rewarderK,
       reduceAmount,
      }: {
        rewarderK: PublicKey;
        reduceAmount: string;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const rewarderContext = new RewarderContext(provider);

        const rewarder = await rewarderContext.loadRewarder(rewarderK);

        console.log("provider:", provider.publicKey.toBase58());
        console.log("Authority:", rewarder.authorityAddress.toBase58());
        console.log("Admin:", rewarder.adminAddress.toBase58());
        console.log("Cumulative rewards:", rewarder.cumulativeRewards);
        console.log("Total rewards:", rewarder.totalRewards);
        console.log("Total rewards claimed:", rewarder.totalRewardsClaimed);
        console.log("Total weights:", rewarder.totalWeights);
        console.log("Starts at:", rewarder.startsAt);
        console.log("Ends at:", rewarder.endsAt);

        const signature = await rewarderContext.reduceRewarderEmissions({
          rewarder,
          reduceAmount,
          priorityLevel,
          simulate,
        });

        console.log(signature);
      },
    );
}