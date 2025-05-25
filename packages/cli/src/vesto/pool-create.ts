import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { VestoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function createPool(program: Command) {
  program
    .command("vesto-pool-create")
    .description("creates IOU pool of a vesting config")
    .requiredOption("--config-k <string>", "config key", parseKey)
    .requiredOption("--iou-mint-k <string>", "IOU mint key", parseKey)
    .action(
      async ({
        configK,
        iouMintK,
      }: {
        configK: PublicKey;
        iouMintK: PublicKey;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const vestoContext = new VestoContext(provider);

        const config = await vestoContext.loadConfig(configK);

        const signature = await vestoContext.createPool({
          config,
          iouMintAddress: iouMintK,
          priorityLevel,
          simulate,
        });

        console.log(signature);
      },
    );
}
