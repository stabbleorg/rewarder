import { AnchorProvider } from "@coral-xyz/anchor";
import { AddressLookupTableAccount } from "@solana/web3.js";
import { PriorityLevel } from "@stabbleorg/anchor-contrib";

export interface Context {
  provider: AnchorProvider;
  altAccounts?: AddressLookupTableAccount[];
  priorityLevel: PriorityLevel;
  simulate: boolean;
}

let context: Context;

export const setContext = (ctx: Context) => {
  context = ctx;
};

export const useContext = () => {
  return context;
};
