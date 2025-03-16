import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey, parseKeypair } from "../utils";

export function createPool(program: Command) {
  program
    .command("pool-create")
    .description("creates a pool")
    .requiredOption("--rewarder-k <string>", "rewarder key", parseKey)
    .requiredOption("--mint-k <string>", "mint key", parseKey)
    .requiredOption("--weight <number>", "weight", Number)
    .option("--pool-k-p <path>", "pool keypair", parseKeypair)
    .action(
      async ({
        rewarderK,
        mintK,
        weight,
        poolKP,
      }: {
        rewarderK: PublicKey;
        mintK: PublicKey;
        weight: number;
        poolKP?: Keypair;
      }) => {
        const { provider, priorityLevel } = useContext();

        const rewarderContext = new RewarderContext(provider);

        const { address, signature } = await rewarderContext.createPool({
          rewarderAddress: rewarderK,
          mintAddress: mintK,
          weight,
          keypair: poolKP,
          priorityLevel,
        });

        console.log("Pool:", address.toBase58());
        console.log(signature);
      },
    );
}
