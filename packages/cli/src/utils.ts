import fs from "fs";
import { Keypair, PublicKey } from "@solana/web3.js";

export function parseKeypair(path?: string): Keypair {
  let keypair: Keypair;

  if (!path || path === "") {
    keypair = Keypair.generate();
    console.log("Using random keypair...");
    console.log(keypair.publicKey.toBase58());
  } else {
    keypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(path, { encoding: "utf8" }))),
    );
  }

  return keypair;
}

export function parseKey(key: string): PublicKey {
  return new PublicKey(key);
}

export function parseDate(value: string): Date {
  return new Date(value);
}
