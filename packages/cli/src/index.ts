import type { Command } from "commander";
import { program } from "commander";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  AddressLookupTableAccount,
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import { setupGovernoProgram } from "./governo";
import { setupRewarderProgram } from "./rewarder";
import { setContext } from "./context";
import { parseKeypair } from "./utils";

program
  .version("0.9.2")
  .option("-k, --keypair <path>", "wallet keypair", parseKeypair)
  .option("-u, --url <string>", "RPC monk or url", "devnet")
  .option("-a, --alt-keys <string...>", "Address Lookup Table keys")
  .option("-p, --priority-level <string>", "priority fee level", "High")
  .option("-s, --simulate", "simulate transaction")
  .hook("preAction", async (cmd: Command) => {
    const { keypair, url, priorityLevel, altKeys, simulate } = cmd.opts();

    let rpcEndpoint: string;
    switch (url) {
      case "testnet":
      case "devnet":
      case "mainnet-beta":
        rpcEndpoint = clusterApiUrl(url);
        break;
      default:
        rpcEndpoint = url;
        break;
    }

    const connection = new Connection(rpcEndpoint);
    const provider = new AnchorProvider(
      connection,
      new Wallet(keypair || Keypair.generate()),
    );

    let altAccounts;
    if (altKeys) {
      const addresses = altKeys.map((key: string) => new PublicKey(key));
      const accounts = await connection.getMultipleAccountsInfo(addresses);
      altAccounts = accounts.map(
        (account, index) =>
          new AddressLookupTableAccount({
            key: addresses[index],
            state: AddressLookupTableAccount.deserialize(account!.data),
          }),
      );
    }

    setContext({
      provider,
      altAccounts,
      priorityLevel,
      simulate: Boolean(simulate),
    });
  });

setupGovernoProgram(program);
setupRewarderProgram(program);

program
  .parseAsync(process.argv)
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
