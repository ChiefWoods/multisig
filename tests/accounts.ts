import { Program } from "@coral-xyz/anchor";
import { Multisig } from "../target/types/multisig";
import { PublicKey } from "@solana/web3.js";

export async function fetchMultisigAcc(
  program: Program<Multisig>,
  multisigPda: PublicKey
) {
  return await program.account.multisig.fetchNullable(multisigPda);
}

export async function fetchTransactionAcc(
  program: Program<Multisig>,
  transactionPda: PublicKey
) {
  return await program.account.transaction.fetchNullable(transactionPda);
}
