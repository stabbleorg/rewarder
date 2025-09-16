import {Connection, Keypair, PublicKey, Transaction, VersionedTransaction} from "@solana/web3.js";
import {AnchorProvider, Program, Wallet} from "@coral-xyz/anchor";
import {GovernoContext, RewarderContext, RewarderProgram} from "../packages/sdk";
import AdminKeypair from "../.keypair/admin.json";
import RewarderIDL from "../target/idl/rewarder.json";
import * as dotenv from 'dotenv';

dotenv.config();

export const keypair = Keypair.fromSecretKey(new Uint8Array(AdminKeypair));
export const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.API_KEY}`, 'confirmed');

export class ReadOnlyWallet implements Wallet {
  readonly publicKey: PublicKey;
  readonly payer: Keypair = keypair;

  constructor(publicKey: PublicKey) {
    this.publicKey = publicKey;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(_transaction: T): Promise<T> {
    throw new Error("Cannot sign transactions with a read-only wallet");
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(_transactions: T[]): Promise<T[]> {
    throw new Error("Cannot sign transactions with a read-only wallet");
  }
}

export const provider = new AnchorProvider(connection, new Wallet(keypair));
export const governoContext = new GovernoContext(provider);
export const rewarderContext = new RewarderContext(provider);
export const rewarderProgram = new Program(RewarderIDL, provider) as unknown as RewarderProgram;