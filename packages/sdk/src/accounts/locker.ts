import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { Governo } from "./governo";
import { GovernoContext } from "../programs";

export type LockerData = {
  governo: PublicKey;
  authority: PublicKey;
  // authorityBump: number;
  lockedAmount: BN;
  votingWeight: BN;
  votingWeightUsed: BN;
  lockedAt: BN;
  unlocksAt: BN;
};

export class Locker {
  public data: LockerData;

  constructor(
    readonly governo: Governo,
    readonly address: PublicKey,
    data: LockerData,
  ) {
    this.data = data;
  }

  refreshData(updatedData: Partial<LockerData>) {
    this.data = { ...this.data, ...updatedData };
  }

  get authorityAddress(): PublicKey {
    return GovernoContext.getLockerAuthorityAddress(this.address);
  }

  get ownerAddress(): PublicKey {
    return this.data.authority;
  }

  get lockedAmount(): number {
    return SafeAmount.toUiAmount(
      this.data.lockedAmount,
      this.governo.data.decimals,
    );
  }

  get votingWeight(): number {
    return SafeAmount.toUiAmount(
      this.data.votingWeight.sub(this.data.votingWeightUsed),
      this.governo.data.decimals,
    );
  }

  get votingWeightUsed(): number {
    return SafeAmount.toUiAmount(
      this.data.votingWeightUsed,
      this.governo.data.decimals,
    );
  }

  get lockedAt(): Date {
    return new Date(this.data.lockedAt.toNumber() * 1000);
  }

  get unlocksAt(): Date {
    return new Date(this.data.unlocksAt.toNumber() * 1000);
  }

  getAssociatedTokenAddress(
    mintAddress: PublicKey,
    programId?: PublicKey,
  ): PublicKey {
    return getAssociatedTokenAddressSync(
      mintAddress,
      this.authorityAddress,
      true,
      programId,
    );
  }
}
