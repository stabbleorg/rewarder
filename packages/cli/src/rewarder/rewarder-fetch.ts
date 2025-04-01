import type { Command } from "commander";
import { table } from "table";
import { PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function fetchRewarder(program: Command) {
  program
    .command("rewarder-fetch")
    .description("report for reward pools of the rewarder")
    .requiredOption("--rewarder-k <string>", "rewarder key", parseKey)
    .action(async ({ rewarderK }: { rewarderK: PublicKey }) => {
      const { provider } = useContext();

      const rewarderContext = new RewarderContext(provider);

      const rewarder = await rewarderContext.loadRewarder(rewarderK);
      const pools = await rewarderContext.loadPools(
        new Map([[rewarder.address.toBase58(), rewarder]]),
      );

      console.log("Total rewards:", rewarder.totalRewards);
      console.log("Total weights:", rewarder.totalWeights);
      console.log("Starts:", rewarder.startsAt);
      console.log("Ends:", rewarder.endsAt);

      console.log(
        table([
          [
            "Address",
            "Mint",
            "Weight",
            "Total amount",
            "Total weights",
            "Weekly rewards",
            "Miners",
          ],
          ...pools
            .filter((pool) => pool.weight > 0)
            .sort((a, b) => b.totalWeights - a.totalWeights)
            .map((pool) => [
              pool.address.toBase58(),
              pool.mintAddress.toBase58(),
              pool.weight + "x",
              pool.totalAmount,
              pool.totalWeights,
              pool.weeklyRewards,
              pool.data.numMiners,
            ]),
        ]),
      );
    });
}
