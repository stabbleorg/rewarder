import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { VestoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function fetchVault(program: Command) {
  program
    .command("vesto-vault-fetch")
    .description("find vault governance token account for a specific IOU mint")
    .requiredOption("--iou-mint-k <string>", "IOU mint key", parseKey)
    .action(async ({ iouMintK }: { iouMintK: PublicKey }) => {
      const { provider } = useContext();

      const vestoContext = new VestoContext(provider);

      // Load all vesting pools and find the one with matching IOU mint
      const allAccounts = await vestoContext.program.account.vestingPool.all();
      
      const matchingAccounts = allAccounts.filter(
        ({ account }) => account.iouMint.equals(iouMintK),
      );

      if (matchingAccounts.length === 0) {
        throw new Error(`No vesting pool found for IOU mint: ${iouMintK.toBase58()}`);
      }

      if (matchingAccounts.length > 1) {
        console.warn(
          `Warning: Found ${matchingAccounts.length} pools for IOU mint. Using the first one.`,
        );
      }

      const { publicKey: poolAddress, account: poolData } = matchingAccounts[0];

      // Load the config
      const config = await vestoContext.loadConfig(poolData.config);

      // Calculate vault authority and vault gov token address
      const vaultAuthority = config.authorityAddress;
      const vaultGovToken = config.getAssociatedTokenAddress(
        config.governo.govMintAddress,
      );

      console.log("Pool address:", poolAddress.toBase58());
      console.log("Config address:", config.address.toBase58());
      console.log("Vault authority:", vaultAuthority.toBase58());
      console.log("Vault gov token:", vaultGovToken.toBase58());
      console.log("Governance mint:", config.governo.govMintAddress.toBase58());
    });
}

