import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { GovernoContext } from "../programs";

export type GovernoData = {
  admin: PublicKey;
  govMint: PublicKey;
  veMint: PublicKey;
  decimals: number;
  // authorityBump: number;
  minLockDuration: number;
  maxLockDuration: number;
  totalLockedAmount: BN;
  totalVotingWeight: BN;
  padding: number[];
};

export class Governo {
  public data: GovernoData;

  constructor(
    readonly address: PublicKey,
    data: GovernoData,
  ) {
    this.data = data;
  }

  refreshData(updatedData: Partial<GovernoData>) {
    this.data = { ...this.data, ...updatedData };
  }

  get authorityAddress(): PublicKey {
    return GovernoContext.getGovernoAuthorityAddress(this.address);
  }

  get govMintAddress(): PublicKey {
    return this.data.govMint;
  }

  get veMintAddress(): PublicKey {
    return this.data.veMint;
  }

  get totalLockedAmount(): number {
    return SafeAmount.toUiAmount(
      this.data.totalLockedAmount,
      this.data.decimals,
    );
  }

  get totalVotingWeight(): number {
    return SafeAmount.toUiAmount(
      this.data.totalVotingWeight,
      this.data.decimals,
    );
  }

  getAssociatedTokenAddress(
    mintAddress: PublicKey,
    programId: PublicKey = TOKEN_PROGRAM_ID,
  ): PublicKey {
    return getAssociatedTokenAddressSync(
      mintAddress,
      this.authorityAddress,
      true,
      programId,
    );
  }
}
