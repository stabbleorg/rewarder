import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { GovernoContext } from "../programs";

export type GovernoData = {
  admin: PublicKey;
  govMint: PublicKey;
  veMint: PublicKey;
  decimals: number;
  authorityBump: number;
  minLockDuration: number;
  maxLockDuration: number;
  totalLockedAmount: BN;
  padding: number[];
};

export class Governo {
  constructor(
    readonly address: PublicKey,
    readonly data: GovernoData,
  ) {}

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
}
