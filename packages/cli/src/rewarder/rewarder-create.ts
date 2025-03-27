import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseDate, parseKey, parseKeypair } from "../utils";

export function createRewarder(program: Command) {
  program
    .command("rewarder-create")
    .description("creates a rewarder")
    .requiredOption("--mint-k <string>", "reward mint key", parseKey)
    .requiredOption("--total-rewards <number>", "total rewards")
    .requiredOption("--starts-at <string>", "epoch start time", parseDate)
    .requiredOption("--ends-at <string>", "epoch end time", parseDate)
    .option("--rewarder-k-p <path>", "rewarder keypair", parseKeypair)
    .action(
      async ({
        mintK,
        totalRewards,
        startsAt,
        endsAt,
        rewarderKP,
      }: {
        mintK: PublicKey;
        totalRewards: string;
        startsAt: Date;
        endsAt: Date;
        rewarderKP?: Keypair;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const rewarderContext = new RewarderContext(provider);

        const { address, signature } = await rewarderContext.createRewarder({
          mintAddress: mintK,
          totalRewards,
          startsAt,
          endsAt,
          liquidity: false,
          keypair: rewarderKP,
          priorityLevel,
          simulate,
        });

        console.log("Rewarder:", address.toBase58());
        console.log(signature);
      },
    );
}
