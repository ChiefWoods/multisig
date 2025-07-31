import { Keypair, PublicKey } from "@solana/web3.js";
import idl from "../target/idl/multisig.json";

export const MULTISIG_PROGRAM_ID = new PublicKey(idl.address);
export const MINT = Keypair.generate().publicKey;
export const MINT_DECIMALS = 6;
