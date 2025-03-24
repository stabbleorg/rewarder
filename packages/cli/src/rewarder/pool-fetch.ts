import type { Command } from "commander";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";

export function fetchPools(program: Command) {
  program
    .command("pool-fetch")
    .description("fetch pools")
    .action(async () => {
      const { provider } = useContext();

      const rewarderContext = new RewarderContext(provider);

      const rewarders = await rewarderContext.loadRewarders();
      const rewardersMap = new Map(
        rewarders.map((rewarder) => [rewarder.address.toBase58(), rewarder]),
      );

      const pools = await rewarderContext.loadPools(rewardersMap);

      console.log("Rewarders:", rewarders.length);
      console.log("Reward pools:", pools.length);

      console.log(
        rewarders
          .map((rewarder) => rewarder.parentRewarder?.address.toBase58())
          .join("\n"),
      );
    });
}
