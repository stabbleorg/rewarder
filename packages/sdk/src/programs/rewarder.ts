import BN from "bn.js";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  unpackMint,
} from "@solana/spl-token";
import { Program, Provider } from "@coral-xyz/anchor";
import {
  AddressWithTransactionSignature,
  SafeAmount,
  TransactionArgs,
  WalletContext,
} from "@stabbleorg/anchor-contrib";
import { Rewarder, Pool, Miner } from "../accounts";
import { type Rewarder as IDLType } from "../generated/rewarder";
import IDL from "../generated/idl/rewarder.json";

export const REWARDER_PROGRAM_ID = new PublicKey(IDL.address);

export type RewarderProgram = Program<IDLType>;

export class RewarderContext<
  T extends Provider = Provider,
> extends WalletContext<T> {
  readonly program: RewarderProgram;

  constructor(provider: T) {
    super(provider);
    this.program = new Program(IDL, provider);
  }

  async loadRewarder(rewarderAddress: PublicKey): Promise<Rewarder> {
    const data = await this.program.account.rewarder.fetch(rewarderAddress);

    return new Rewarder(rewarderAddress, data);
  }

  async loadRewarders(): Promise<Rewarder[]> {
    const accounts = await this.program.account.rewarder.all();

    return accounts.map(
      (account) => new Rewarder(account.publicKey, account.account),
    );
  }

  async loadPool(poolAddress: PublicKey, rewarder?: Rewarder): Promise<Pool> {
    const data = await this.program.account.pool.fetch(poolAddress);

    if (!rewarder) {
      rewarder = await this.loadRewarder(data.rewarder);
    }

    return new Pool(rewarder, poolAddress, data);
  }

  async loadPools(rewarders: Map<PublicKey, Rewarder>): Promise<Pool[]> {
    const accounts = await this.program.account.pool.all();

    return accounts.map(
      (account) =>
        new Pool(
          rewarders.get(account.account.rewarder)!,
          account.publicKey,
          account.account,
        ),
    );
  }

  async loadMiner(
    pool: Pool,
    userAddress: PublicKey = this.walletAddress,
  ): Promise<Miner | null> {
    const data = await this.program.account.miner.fetchNullable(
      RewarderContext.getMinerAddress(userAddress, pool.address),
    );

    if (!data) return null;

    return new Miner(pool, data);
  }

  async loadMiners(
    pools: Map<PublicKey, Pool>,
    beneficiaryAddress: PublicKey = this.walletAddress,
  ): Promise<Miner[]> {
    const accounts = await this.program.account.miner.all([
      {
        memcmp: {
          offset: 72,
          bytes: beneficiaryAddress.toBase58(),
        },
      },
    ]);

    return accounts.map(
      (account) => new Miner(pools.get(account.account.pool)!, account.account),
    );
  }

  async createRewarder({
    mintAddress,
    totalRewards,
    startsAt,
    endsAt,
    liquidity = true,
    keypair = Keypair.generate(),
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
  }: TransactionArgs<{
    mintAddress: PublicKey;
    totalRewards: string | number;
    startsAt: Date;
    endsAt: Date;
    liquidity?: boolean;
    keypair?: Keypair;
  }>): Promise<AddressWithTransactionSignature> {
    const data = await this.provider.connection.getAccountInfo(mintAddress);
    if (!data) throw new Error("Invalid reward mint address");
    const tokenProgramAddress = data.owner;
    const mint = unpackMint(mintAddress, data, tokenProgramAddress);
    const amount = SafeAmount.toU64Amount(totalRewards, mint.decimals);

    const space = this.program.account.rewarder.size;
    const lamports =
      await this.provider.connection.getMinimumBalanceForRentExemption(space);

    const address = keypair.publicKey;
    const authorityAddress =
      RewarderContext.getRewarderAuthorityAddress(address);

    const instructions: TransactionInstruction[] = [
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: address,
        space,
        lamports,
        programId: this.program.programId,
      }),
      await this.program.methods
        .createRewarder(
          amount,
          new BN(startsAt.getTime() / 1000),
          new BN(endsAt.getTime() / 1000),
        )
        .accountsStrict({
          admin: this.walletAddress,
          mint: mintAddress,
          rewarder: address,
          rewarderAuthority: authorityAddress,
        })
        .instruction(),
    ];

    const { address: rewarderTokenAddress, instruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        mintAddress,
        authorityAddress,
        true,
        tokenProgramAddress,
      );
    if (instruction) instructions.push(instruction);

    if (liquidity) {
      instructions.push(
        createTransferCheckedInstruction(
          this.getAssociatedTokenAddress(mintAddress, tokenProgramAddress),
          mintAddress,
          rewarderTokenAddress,
          this.walletAddress,
          BigInt(amount.toString()),
          mint.decimals,
          [],
          tokenProgramAddress,
        ),
      );
    }

    const signature = await this.sendSmartTransaction(
      instructions,
      [keypair],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
    );

    return { address, signature };
  }

  async updateRewarder({
    rewarder,
    totalRewards,
    startsAt,
    endsAt,
    liquidity = true,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
  }: TransactionArgs<{
    rewarder: Rewarder;
    totalRewards: string | number;
    startsAt: Date;
    endsAt: Date;
    liquidity?: boolean;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      [
        await this.program.methods
          .updateRewarder(
            SafeAmount.toU64Amount(totalRewards, rewarder.data.decimals),
            new BN(startsAt.getTime() / 1000),
            new BN(endsAt.getTime() / 1000),
          )
          .accountsStrict({
            admin: this.walletAddress,
            rewarder: rewarder.address,
          })
          .instruction(),
      ],
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
    );
  }

  async createPool({
    rewarderAddress,
    mintAddress,
    weight,
    keypair = Keypair.generate(),
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
  }: TransactionArgs<{
    rewarderAddress: PublicKey;
    mintAddress: PublicKey;
    weight: number;
    keypair?: Keypair;
  }>): Promise<AddressWithTransactionSignature> {
    const address = keypair.publicKey;

    const space = this.program.account.pool.size;
    const lamports =
      await this.provider.connection.getMinimumBalanceForRentExemption(space);

    const signature = await this.sendSmartTransaction(
      [
        SystemProgram.createAccount({
          fromPubkey: this.walletAddress,
          newAccountPubkey: address,
          space,
          lamports,
          programId: this.program.programId,
        }),
        await this.program.methods
          .createPool(weight)
          .accountsStrict({
            admin: this.walletAddress,
            mint: mintAddress,
            pool: address,
            rewarder: rewarderAddress,
          })
          .instruction(),
      ],
      [keypair],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
    );

    return { address, signature };
  }

  async deposit({
    pool,
    amount,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
  }: TransactionArgs<{
    pool: Pool;
    amount: string | number;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      await this.createDepositInstructions({ pool, amount }),
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
    );
  }

  async withdraw({
    pool,
    amount,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
  }: TransactionArgs<{
    pool: Pool;
    amount: string | number;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      await this.createWithdrawInstructions({ pool, amount }),
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
    );
  }

  async claim({
    pool,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
  }: TransactionArgs<{
    pool: Pool;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      await this.createClaimInstructions({ pool }),
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
    );
  }

  async createDepositInstructions({
    pool,
    amount,
    authorityAddress = this.walletAddress,
  }: {
    pool: Pool;
    amount: string | number;
    authorityAddress?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    const data = await this.provider.connection.getAccountInfo(
      pool.mintAddress,
    );
    const tokenProgramAddress = data!.owner;

    const miner = await this.loadMiner(pool);
    const minerAddress = RewarderContext.getMinerAddress(
      authorityAddress,
      pool.address,
    );

    if (!miner) {
      instructions.push(
        await this.program.methods
          .createMiner(authorityAddress)
          .accountsStrict({
            payer: this.walletAddress,
            miner: minerAddress,
            pool: pool.address,
            rewarder: pool.rewarder.address,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      );

      const { instruction } =
        await this.getOrCreateAssociatedTokenAddressInstruction(
          pool.mintAddress,
          minerAddress,
          true,
          tokenProgramAddress,
        );
      if (instruction) instructions.push(instruction);
    }

    const userTokenAddress = this.getAssociatedTokenAddress(
      pool.mintAddress,
      tokenProgramAddress,
    );
    const minerTokenAddress = getAssociatedTokenAddressSync(
      pool.mintAddress,
      minerAddress,
      true,
      tokenProgramAddress,
    );

    instructions.push(
      await this.program.methods
        .depositMiner(SafeAmount.toU64Amount(amount, pool.data.decimals))
        .accountsStrict({
          with: {
            miner: minerAddress,
            pool: pool.address,
            rewarder: pool.rewarder.address,
          },
          authority: authorityAddress,
          mint: pool.mintAddress,
          userToken: userTokenAddress,
          minerToken: minerTokenAddress,
          tokenProgram: tokenProgramAddress,
        })
        .instruction(),
    );

    return instructions;
  }

  async createWithdrawInstructions({
    pool,
    amount,
    authorityAddress = this.walletAddress,
  }: {
    pool: Pool;
    amount: string | number;
    authorityAddress?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    const data = await this.provider.connection.getAccountInfo(
      pool.mintAddress,
    );
    const tokenProgramAddress = data!.owner;

    const minerAddress = RewarderContext.getMinerAddress(
      authorityAddress,
      pool.address,
    );

    const { address: userTokenAddress, instruction: createUserAtaIX } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        pool.mintAddress,
        authorityAddress,
        true,
        tokenProgramAddress,
      );
    if (createUserAtaIX) instructions.push(createUserAtaIX);

    const minerTokenAddress = getAssociatedTokenAddressSync(
      pool.mintAddress,
      minerAddress,
      true,
      tokenProgramAddress,
    );

    instructions.push(
      await this.program.methods
        .withdrawMiner(SafeAmount.toU64Amount(amount, pool.data.decimals))
        .accountsStrict({
          with: {
            miner: minerAddress,
            pool: pool.address,
            rewarder: pool.rewarder.address,
          },
          authority: authorityAddress,
          mint: pool.mintAddress,
          userToken: userTokenAddress,
          minerToken: minerTokenAddress,
          tokenProgram: tokenProgramAddress,
        })
        .instruction(),
    );

    return instructions;
  }

  async createClaimInstructions({
    pool,
    authorityAddress = this.walletAddress,
  }: {
    pool: Pool;
    authorityAddress?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    const data = await this.provider.connection.getAccountInfo(
      pool.rewarder.mintAddress,
    );
    const tokenProgramAddress = data!.owner;

    const minerAddress = RewarderContext.getMinerAddress(
      authorityAddress,
      pool.address,
    );

    const { address: userTokenAddress, instruction: createUserAtaIX } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        pool.rewarder.mintAddress,
        authorityAddress,
        true,
        tokenProgramAddress,
      );
    if (createUserAtaIX) instructions.push(createUserAtaIX);

    const rewarderTokenAddress = getAssociatedTokenAddressSync(
      pool.rewarder.mintAddress,
      pool.rewarder.authorityAddress,
      true,
      tokenProgramAddress,
    );

    instructions.push(
      await this.program.methods
        .claimMiner()
        .accountsStrict({
          with: {
            miner: minerAddress,
            pool: pool.address,
            rewarder: pool.rewarder.address,
          },
          beneficiary: this.walletAddress,
          rewarderAuthority: pool.rewarder.authorityAddress,
          mint: pool.rewarder.mintAddress,
          userToken: userTokenAddress,
          rewarderToken: rewarderTokenAddress,
          tokenProgram: tokenProgramAddress,
        })
        .instruction(),
    );

    return instructions;
  }

  static getRewarderAuthorityAddress(rewarderAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("rewarder_authority"), rewarderAddress.toBuffer()],
      REWARDER_PROGRAM_ID,
    )[0];
  }

  static getMinerAddress(
    userAddress: PublicKey,
    poolAddress: PublicKey,
  ): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("miner"), userAddress.toBuffer(), poolAddress.toBuffer()],
      REWARDER_PROGRAM_ID,
    )[0];
  }
}
