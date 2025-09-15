import {PublicKey} from "@solana/web3.js";
import * as dotenv from 'dotenv';
import {governoContext} from "./constants";

dotenv.config();

const main = async () => {
  const governo = await governoContext.loadGoverno(new PublicKey("GovSTBshDa7PyWDzDqmWnHRa9qvZzCD8uQ4wyLRniS2h"));
  const lockers = await governoContext.loadLockers(governo);
  lockers.forEach(locker => {
    console.log({
      ...locker,
      data: {
        ...locker.data,
        lockedAmount: locker.data.lockedAmount.toNumber() / 10 ** 9,
        votingWeight: locker.data.votingWeight.toNumber() / 10 ** 9,
        votingWeightUsed: locker.data.votingWeightUsed.toNumber() / 10 ** 9,
        lockedAt: locker.data.lockedAt.toNumber(),
        unlocksAt: locker.data.unlocksAt.toNumber(),
      }
    })
  })
};

main();