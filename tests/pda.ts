import { PublicKey } from "@solana/web3.js";
import { MULTISIG_PROGRAM_ID } from "./constants";
import { BN } from "@coral-xyz/anchor";

export function getMultisigPda(base: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("multisig"), base.toBuffer()],
    MULTISIG_PROGRAM_ID
  )[0];
}

export function getTransactionPda(multisig: PublicKey, id: number) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("transaction"),
      multisig.toBuffer(),
      new BN(id).toArrayLike(Buffer, "le", 2),
    ],
    MULTISIG_PROGRAM_ID
  )[0];
}
