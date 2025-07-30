use anchor_lang::prelude::*;

#[account]
pub struct Transaction {
    pub bump: u8,                                // 1
    pub executed: bool,                          // 1
    pub id: u16,                                 // 2
    pub multisig: Pubkey,                        // 32
    pub proposer: Pubkey,                        // 32
    pub signers: Vec<Pubkey>,                    // 4
    pub transaction_types: Vec<TransactionType>, // 4
}

impl Transaction {
    pub fn space(transaction_types: &Vec<TransactionType>) -> usize {
        Transaction::DISCRIMINATOR.len()
            + 1
            + 1
            + 2
            + 32
            + 32
            // signers is empty at initialization
            + 4
            + (4 + transaction_types.iter().map(|tt| tt.space()).sum::<usize>())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum TransactionType {
    Instruction(Instruction),
    MultisigAction(MultisigAction),
}

impl TransactionType {
    pub fn space(&self) -> usize {
        1 + match self {
            TransactionType::Instruction(instruction) => {
                Instruction::space(&instruction.accounts, &instruction.data)
            }
            TransactionType::MultisigAction(..) => MultisigAction::INIT_SPACE,
        }
    }
}

/// Borsh wrapper for [`anchor_lang::solana_program::instruction::Instruction`]
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Instruction {
    pub program_id: Pubkey,         // 32
    pub accounts: Vec<AccountMeta>, // 4
    pub data: Vec<u8>,              // 4
}

impl Instruction {
    pub fn space(accounts: &Vec<AccountMeta>, data: &Vec<u8>) -> usize {
        msg!("accounts len: {}", accounts.len());
        msg!("data len: {}", data.len());
        32 + (4 + accounts.len() * AccountMeta::INIT_SPACE) + (4 + data.len() * 1)
    }
}

/// Borsh wrapper for [`anchor_lang::solana_program::instruction::AccountMeta`]
#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone)]
pub struct AccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, Eq, InitSpace)]
pub enum MultisigAction {
    AddMember { member: Pubkey },
    RemoveMember { member: Pubkey },
    SetThreshold { threshold: u8 },
}
