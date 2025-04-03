import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function closePool(program: Command) {
  program
    .command("pool-close")
    .description("closes the pool")
    .requiredOption("--pool-k <string>", "reward pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const rewarderContext = new RewarderContext(provider);
      const pool = await rewarderContext.loadPool(poolK);

      const signature = await rewarderContext.closePool({
        pool,
        priorityLevel,
        simulate,
      });

      console.log(signature);
    });
}
