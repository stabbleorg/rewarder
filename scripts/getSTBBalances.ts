import * as dotenv from 'dotenv';
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import {connection, rewarderContext, rewarderProgram} from "./constants";
import {PublicKey} from "@solana/web3.js";
import fs from "fs";

dotenv.config();

const mint = new PublicKey('STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1');

const main = async () => {
  const file = fs.readFileSync('./scripts/input.csv', 'utf8');
  const header = file.split('\n')[0];
  const lines = file.split('\n').slice(1);
  const accounts = lines.map(line => {
    const fields = line.split(',');
    return fields[0]!.trim();
  });
  const tokenBalances: string[] = [];
  const solBalances: string[] = [];
  for (let i = 0; i < accounts.length; i++) {
    let wallet = new PublicKey(accounts[i])!;
    try {
      const miner = await rewarderProgram.account.miner.fetchNullable(wallet)
      if (miner) {
        console.log(`Found miner beneficiary ${miner.beneficiary.toBase58()}`)
        wallet = miner.beneficiary;
      }
      const ata = getAssociatedTokenAddressSync(mint, new PublicKey(wallet), true);
      const tokenAccount = await getAccount(connection, ata);
      const decimals = tokenAccount.amount.toString().slice(-9);
      const integers = tokenAccount.amount.toString().slice(0, -9) || 0;
      tokenBalances[i] = `${integers}.${decimals}`;
    } catch (e) {
      console.error(e);
      console.log(`Couldn't get token balance for ${wallet}`)
      tokenBalances[i] = '0';
    }
  }
  const output = [`${header},STB Balance`].concat(lines.map((line, index) => `${line},${tokenBalances[index]}`));
  const outputStr = output.join('\n');
  fs.writeFileSync('./scripts/output.csv', outputStr);
};

main();