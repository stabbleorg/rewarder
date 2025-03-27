import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function updatePool(program: Command) {
  program
    .command("pool-update")
    .description("updates the pool")
    .requiredOption("--pool-k <string>", "reward pool key", parseKey)
    .requiredOption("--weight <number>", "weight", Number)
    .action(async ({ poolK, weight }: { poolK: PublicKey; weight: number }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const rewarderContext = new RewarderContext(provider);
      const pool = await rewarderContext.loadPool(poolK);

      const signature = await rewarderContext.updatePool({
        pool,
        weight,
        priorityLevel,
        simulate,
      });

      console.log(signature);
    });
}
