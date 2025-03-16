import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { GovernoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseDate, parseKey, parseKeypair } from "../utils";

export function createGoverno(program: Command) {
  program
    .command("governo-create")
    .description("creates a governo")
    .requiredOption("--gov-mint-k <string>", "gov mint key", parseKey)
    .requiredOption("--min-lock-duration <string>", "min lock duration", Number)
    .requiredOption("--max-lock-duration <string>", "max lock duration", Number)
    .option("--name <string>", "ve token metadata name")
    .option("--symbol <string>", "ve token metadata symbol")
    .option("--uri <string>", "ve token metadata uri")
    .option("--ve-mint-k-p <path>", "ve mint keypair", parseKeypair)
    .option("--governo-k-p <path>", "governo keypair", parseKeypair)
    .action(
      async ({
        govMintK,
        minLockDuration,
        maxLockDuration,
        name,
        symbol,
        uri,
        veMintKP,
        governoKP,
      }: {
        govMintK: PublicKey;
        minLockDuration: number;
        maxLockDuration: number;
        name?: string;
        symbol?: string;
        uri?: string;
        veMintKP?: Keypair;
        governoKP?: Keypair;
      }) => {
        const { provider, priorityLevel } = useContext();

        const governoContext = new GovernoContext(provider);

        const { address, signature } = await governoContext.createGoverno({
          mintAddress: govMintK,
          minLockDuration,
          maxLockDuration,
          veMetadata: {
            name: name || "",
            symbol: symbol || "",
            uri: uri || "",
          },
          veMintKeypair: veMintKP,
          keypair: governoKP,
          priorityLevel,
        });

        console.log("Governo:", address.toBase58());
        console.log(signature);
      },
    );
}
