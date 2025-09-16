import type {Command} from "commander";
import {GovernoContext} from "@stabbleorg/rewarder-sdk";
import {useContext} from "../context";

export function governoAll(program: Command) {
  program
    .command("governo-all")
    .description("fetches all governo accounts")
    .action(async () => {
      const { provider } = useContext();

      const governoContext = new GovernoContext(provider);

      const governos = await governoContext.program.account.governo.all();

      governos.forEach((governo) => {
        console.log({
          ...governo,
          publicKey: governo.publicKey.toBase58(),
          account: {
            ...governo.account,
            admin: governo.account.admin.toBase58(),
            govMint: governo.account.govMint.toBase58(),
            veMint: governo.account.veMint.toBase58(),
          }
        });
      })

    });
}
