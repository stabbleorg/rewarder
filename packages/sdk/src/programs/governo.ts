import {
  AccountMeta,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as MPL_TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  AuthorityType,
  createInitializeMint2Instruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  MintLayout,
  TOKEN_PROGRAM_ID,
  unpackMint,
} from "@solana/spl-token";
import { Program, Provider } from "@coral-xyz/anchor";
import {
  AddressWithTransactionSignature,
  TransactionArgs,
  WalletContext,
  SafeAmount,
  DataUpdatedEvent,
  SIMULATED_SIGNATURE,
  TOKEN_MINT_RENT_FEE_LAMPORTS,
} from "@stabbleorg/anchor-contrib";
import { Governo, GovernoData, Locker, Miner, Pool } from "../accounts";
import { type Governo as IDLType } from "../generated/governo";
import IDL from "../generated/idl/governo.json";
import REWARDER_PROGRAM_IDL from "../generated/idl/rewarder.json";
import { REWARDER_PROGRAM_ID, RewarderContext } from "./rewarder";

export const GOVERNO_PROGRAM_ID = new PublicKey(IDL.address);
export const GOVERNO_ERRORS = new Map(
  IDL.errors.map((error) => [error.code, error.msg]),
);

export type GovernoProgram = Program<IDLType>;

export class GovernoContext<
  T extends Provider = Provider,
> extends WalletContext<T> {
  readonly program: GovernoProgram;

  constructor(provider: T) {
    super(provider);
    this.program = new Program(IDL, provider);
  }

  async loadGoverno(governoAddress: PublicKey): Promise<Governo> {
    const data = await this.program.account.governo.fetch(governoAddress);

    return new Governo(governoAddress, data);
  }

  async loadLockers(
    governo: Governo,
    authorityAddress: PublicKey = this.walletAddress,
  ): Promise<Locker[]> {
    const accounts = await this.program.account.locker.all([
      {
        memcmp: {
          offset: 8,
          bytes: governo.address.toBase58(),
        },
      },
      {
        memcmp: {
          offset: 40,
          bytes: authorityAddress.toBase58(),
        },
      },
    ]);

    return accounts.map(
      (account) => new Locker(governo, account.publicKey, account.account),
    );
  }

  async createGoverno({
    mintAddress,
    minLockDuration,
    maxLockDuration,
    veMetadata,
    veMintKeypair = Keypair.generate(),
    keypair = Keypair.generate(),
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    mintAddress: PublicKey;
    minLockDuration: number;
    maxLockDuration: number;
    veMetadata?: {
      name: string;
      symbol: string;
      uri: string;
    };
    veMintKeypair?: Keypair;
    keypair?: Keypair;
  }>): Promise<AddressWithTransactionSignature> {
    const data = await this.provider.connection.getAccountInfo(mintAddress);
    if (!data) throw new Error("Invalid gov mint address");
    const mint = unpackMint(mintAddress, data, data.owner);

    const instructions: TransactionInstruction[] = [
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: veMintKeypair.publicKey,
        space: MintLayout.span,
        lamports: TOKEN_MINT_RENT_FEE_LAMPORTS,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        veMintKeypair.publicKey,
        mint.decimals,
        this.walletAddress,
        this.walletAddress,
      ),
    ];

    if (veMetadata) {
      const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          MPL_TOKEN_METADATA_PROGRAM_ID.toBytes(),
          veMintKeypair.publicKey.toBytes(),
        ],
        MPL_TOKEN_METADATA_PROGRAM_ID,
      );

      instructions.push(
        createCreateMetadataAccountV3Instruction(
          {
            metadata: metadataAddress,
            mint: veMintKeypair.publicKey,
            mintAuthority: this.walletAddress,
            payer: this.walletAddress,
            updateAuthority: this.walletAddress,
          },
          {
            createMetadataAccountArgsV3: {
              data: {
                ...veMetadata,
                sellerFeeBasisPoints: 0,
                creators: null,
                collection: null,
                uses: null,
              },
              isMutable: true,
              collectionDetails: null,
            },
          },
        ),
      );
    }

    const space = this.program.account.governo.size;
    const lamports =
      await this.provider.connection.getMinimumBalanceForRentExemption(space);

    const address = keypair.publicKey;
    const authorityAddress = GovernoContext.getGovernoAuthorityAddress(address);

    instructions.push(
      createSetAuthorityInstruction(
        veMintKeypair.publicKey,
        this.walletAddress,
        AuthorityType.MintTokens,
        authorityAddress,
      ),
      createSetAuthorityInstruction(
        veMintKeypair.publicKey,
        this.walletAddress,
        AuthorityType.FreezeAccount,
        authorityAddress,
      ),
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: address,
        space,
        lamports,
        programId: this.program.programId,
      }),
      await this.program.methods
        .createGoverno(minLockDuration, maxLockDuration)
        .accountsStrict({
          admin: this.walletAddress,
          govMint: mintAddress,
          veMint: veMintKeypair.publicKey,
          governo: address,
          governoAuthority: authorityAddress,
        })
        .instruction(),
    );

    const signature = await this.sendSmartTransaction(
      instructions,
      [keypair, veMintKeypair],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );

    return { address, signature };
  }

  async lock({
    pool,
    governo,
    amount,
    duration,
    keypair = Keypair.generate(),
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    pool: Pool;
    governo: Governo;
    amount: string | number;
    duration: number;
    keypair?: Keypair;
  }>): Promise<AddressWithTransactionSignature> {
    if (!governo.veMintAddress.equals(pool.mintAddress))
      throw new Error("Invalid pool account");

    const instructions: TransactionInstruction[] = [];

    const address = keypair.publicKey;
    const authorityAddress = GovernoContext.getLockerAuthorityAddress(address);

    const userGovTokenAddress = this.getAssociatedTokenAddress(
      governo.govMintAddress,
    );

    const {
      address: lockerGovTokenAddress,
      instruction: createLockerGovAtaIX,
    } = await this.getOrCreateAssociatedTokenAddressInstruction(
      governo.govMintAddress,
      authorityAddress,
      true,
    );
    if (createLockerGovAtaIX) instructions.push(createLockerGovAtaIX);

    const { address: lockerVeTokenAddress, instruction: createLockerVeAtaIX } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        governo.veMintAddress,
        authorityAddress,
        true,
      );
    if (createLockerVeAtaIX) instructions.push(createLockerVeAtaIX);

    const space = this.program.account.locker.size;
    const lamports =
      await this.provider.connection.getMinimumBalanceForRentExemption(space);

    instructions.push(
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: address,
        space,
        lamports,
        programId: this.program.programId,
      }),
      await this.program.methods
        .createLocker(
          SafeAmount.toU64Amount(amount, governo.data.decimals),
          duration,
        )
        .accountsStrict({
          user: this.walletAddress,
          userGovToken: userGovTokenAddress,
          lockerGovToken: lockerGovTokenAddress,
          lockerVeToken: lockerVeTokenAddress,
          govMint: governo.govMintAddress,
          veMint: governo.veMintAddress,
          locker: address,
          lockerAuthority: authorityAddress,
          governo: governo.address,
          governoAuthority: governo.authorityAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    const minerAddress = RewarderContext.getMinerAddress(
      authorityAddress,
      pool.address,
    );

    const rewarderProgram = new Program(REWARDER_PROGRAM_IDL, this.provider);

    instructions.push(
      await rewarderProgram.methods
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

    const { address: minerVeTokenAddress, instruction: createMinerVeAtaIX } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        pool.mintAddress,
        minerAddress,
        true,
      );
    if (createMinerVeAtaIX) instructions.push(createMinerVeAtaIX);

    instructions.push(
      await this.program.methods
        .stakeLocker()
        .accountsStrict({
          locker: address,
          lockerAuthority: authorityAddress,
          governo: governo.address,
          rewarderProgram: REWARDER_PROGRAM_ID,
          miner: minerAddress,
          pool: pool.address,
          rewarder: pool.rewarder.address,
          veMint: pool.mintAddress,
          lockerVeToken: lockerVeTokenAddress,
          minerVeToken: minerVeTokenAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    const signature = await this.sendSmartTransaction(
      instructions,
      [keypair],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );

    return { address, signature };
  }

  async unlock({
    pool,
    locker,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    pool: Pool;
    locker: Locker;
  }>): Promise<TransactionSignature> {
    if (!locker.governo.veMintAddress.equals(pool.mintAddress))
      throw new Error("Invalid pool account");

    const minerAddress = RewarderContext.getMinerAddress(
      locker.authorityAddress,
      pool.address,
    );

    const lockerVeTokenAddress = locker.getAssociatedTokenAddress(
      locker.governo.veMintAddress,
    );

    const minerVeTokenAddress = getAssociatedTokenAddressSync(
      locker.governo.veMintAddress,
      minerAddress,
      true,
    );

    const instructions: TransactionInstruction[] = [
      await this.program.methods
        .unstakeLocker()
        .accountsStrict({
          locker: locker.address,
          lockerAuthority: locker.authorityAddress,
          governo: locker.governo.address,
          rewarderProgram: REWARDER_PROGRAM_ID,
          miner: minerAddress,
          pool: pool.address,
          rewarder: pool.rewarder.address,
          veMint: pool.mintAddress,
          lockerVeToken: lockerVeTokenAddress,
          minerVeToken: minerVeTokenAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    ];

    const { address: userGovTokenAddress, instruction: createUserGovAtaIX } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        locker.governo.govMintAddress,
      );
    if (createUserGovAtaIX) instructions.push(createUserGovAtaIX);

    const lockerGovTokenAddress = locker.getAssociatedTokenAddress(
      locker.governo.govMintAddress,
    );

    instructions.push(
      await this.program.methods
        .closeLocker()
        .accountsStrict({
          authority: this.walletAddress,
          userGovToken: userGovTokenAddress,
          lockerGovToken: lockerGovTokenAddress,
          lockerVeToken: lockerVeTokenAddress,
          govMint: locker.governo.govMintAddress,
          veMint: locker.governo.veMintAddress,
          locker: locker.address,
          lockerAuthority: locker.authorityAddress,
          governo: locker.governo.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    return this.sendSmartTransaction(
      instructions,
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );
  }

  async claim({
    miner,
    locker,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    miner: Miner;
    locker: Locker;
  }>): Promise<TransactionSignature> {
    if (!locker.governo.veMintAddress.equals(miner.pool.mintAddress))
      throw new Error("Invalid pool account");
    if (!locker.authorityAddress.equals(miner.beneficiaryAddress))
      throw new Error("Invalid miner account");

    const instructions: TransactionInstruction[] = [];
    const remainingAccounts: AccountMeta[] = [];

    if (!miner.amount) {
      remainingAccounts.push(
        {
          pubkey: this.walletAddress,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: miner.getAssociatedTokenAddress(miner.pool.mintAddress),
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: miner.pool.mintAddress,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
      );
    }

    const {
      address: authorityTokenAddress,
      instruction: createAuthorityRewardAtaIX,
    } = await this.getOrCreateAssociatedTokenAddressInstruction(
      miner.pool.rewarder.mintAddress,
    );
    if (createAuthorityRewardAtaIX)
      instructions.push(createAuthorityRewardAtaIX);

    const rewarderRewardTokenAddress =
      miner.pool.rewarder.getAssociatedTokenAddress(
        miner.pool.rewarder.mintAddress,
      );

    instructions.push(
      await this.program.methods
        .claimLocker()
        .accountsStrict({
          locker: locker.address,
          lockerAuthority: locker.authorityAddress,
          rewarderProgram: REWARDER_PROGRAM_ID,
          miner: miner.address,
          pool: miner.pool.address,
          rewarder: miner.pool.rewarder.address,
          rewarderAuthority: miner.pool.rewarder.authorityAddress,
          mint: miner.pool.rewarder.mintAddress,
          authorityToken: authorityTokenAddress,
          rewarderToken: rewarderRewardTokenAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    return this.sendSmartTransaction(
      instructions,
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );
  }

  static getGovernoAuthorityAddress(governoAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("governo_authority"), governoAddress.toBuffer()],
      GOVERNO_PROGRAM_ID,
    )[0];
  }

  static getLockerAuthorityAddress(lockerAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("locker_authority"), lockerAddress.toBuffer()],
      GOVERNO_PROGRAM_ID,
    )[0];
  }
}

export class GovernoListener {
  private governoUpdatedEvent: number = -1;

  constructor(readonly program: GovernoProgram) {}

  addRewarderListeners(
    callback: (event: DataUpdatedEvent<Partial<GovernoData>>) => void,
  ) {
    this.removeGovernoListeners();

    this.governoUpdatedEvent = this.program.addEventListener(
      "governoUpdatedEvent",
      (
        event: DataUpdatedEvent<Partial<GovernoData>>,
        _slot: number,
        signature: TransactionSignature,
      ) => {
        if (signature !== SIMULATED_SIGNATURE) {
          callback(event);
        }
      },
    );
  }

  removeGovernoListeners() {
    if (this.governoUpdatedEvent !== -1) {
      this.program.removeEventListener(this.governoUpdatedEvent);
      this.governoUpdatedEvent = -1;
    }
  }
}
