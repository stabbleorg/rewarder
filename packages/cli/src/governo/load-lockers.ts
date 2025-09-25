import type {Command} from "commander";
import {GovernoContext} from "@stabbleorg/rewarder-sdk";
import {useContext} from "../context";
import {parseKey} from "../utils";
import {PublicKey} from "@solana/web3.js";

export function loadLockers(program: Command) {
  program
    .command("load-lockers")
    .requiredOption("--governo-k <string>", "governo key", parseKey)
    .requiredOption("--authority-k <string>", "authority public key", parseKey)
    .action(async ({ governoK, authorityK }: { governoK: PublicKey, authorityK: PublicKey }) => {
      const { provider } = useContext();
      const governoContext = new GovernoContext(provider);
      const governo = await governoContext.loadGoverno(governoK);
      const lockers = await governoContext.loadLockers(governo, authorityK);
      lockers.forEach(locker => console.log({
        ...locker,
      }))
    });
}