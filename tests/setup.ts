import { AnchorError, Program } from "@coral-xyz/anchor";
import { Multisig } from "../target/types/multisig";
import idl from "../target/idl/multisig.json";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { AccountInfoBytes, LiteSVM } from "litesvm";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { expect } from "bun:test";
import {
  ACCOUNT_SIZE,
  AccountLayout,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  MintLayout,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { MINT, MINT_DECIMALS } from "./constants";

export async function getSetup(
  accounts: { pubkey: PublicKey; account: AccountInfoBytes }[] = []
) {
  const litesvm = fromWorkspace("./");
  litesvm.withLogBytesLimit(null);

  initMint(litesvm, MINT);

  for (const { pubkey, account } of accounts) {
    litesvm.setAccount(new PublicKey(pubkey), {
      data: account.data,
      executable: account.executable,
      lamports: account.lamports,
      owner: new PublicKey(account.owner),
    });
  }

  const provider = new LiteSVMProvider(litesvm);
  const program = new Program<Multisig>(idl, provider);

  return { litesvm, provider, program };
}

export function fundedSystemAccountInfo(
  lamports: number = LAMPORTS_PER_SOL
): AccountInfoBytes {
  return {
    lamports,
    data: Buffer.alloc(0),
    owner: SystemProgram.programId,
    executable: false,
  };
}

export async function expectAnchorError(error: Error, code: string) {
  expect(error).toBeInstanceOf(AnchorError);
  const { errorCode } = (error as AnchorError).error;
  expect(errorCode.code).toBe(code);
}

function initMint(
  litesvm: LiteSVM,
  mint: PublicKey,
  owner: PublicKey = TOKEN_PROGRAM_ID
) {
  const mintData = Buffer.alloc(MINT_SIZE);

  MintLayout.encode(
    {
      mintAuthority: PublicKey.default,
      mintAuthorityOption: 0,
      supply: BigInt(1000000 * 10 ** MINT_DECIMALS),
      decimals: MINT_DECIMALS,
      isInitialized: true,
      freezeAuthority: PublicKey.default,
      freezeAuthorityOption: 0,
    },
    mintData
  );

  litesvm.setAccount(mint, {
    data: mintData,
    executable: false,
    lamports: LAMPORTS_PER_SOL,
    owner,
  });
}

export function initAta(
  litesvm: LiteSVM,
  mint: PublicKey,
  owner: PublicKey,
  amount: number = 100 * 10 ** MINT_DECIMALS
) {
  const ataData = Buffer.alloc(ACCOUNT_SIZE);

  AccountLayout.encode(
    {
      amount: BigInt(amount),
      closeAuthority: owner,
      closeAuthorityOption: 1,
      delegate: PublicKey.default,
      delegatedAmount: 0n,
      delegateOption: 0,
      isNative: 0n,
      isNativeOption: 0,
      mint,
      owner,
      state: 1,
    },
    ataData
  );

  const tokenProgram = litesvm.getAccount(mint).owner;

  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    !PublicKey.isOnCurve(owner),
    tokenProgram
  );

  litesvm.setAccount(ata, {
    data: ataData,
    executable: false,
    lamports: LAMPORTS_PER_SOL,
    owner: tokenProgram,
  });
}
