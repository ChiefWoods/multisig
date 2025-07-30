use anchor_lang::{prelude::*, solana_program::program::invoke_signed};

use crate::{
    error::MultisigError, multisig_signer, Multisig, MultisigAction, Transaction, TransactionType,
    MULTISIG_SEED, TRANSACTION_SEED,
};

#[derive(Accounts)]
pub struct ExecuteTransaction<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    #[account(
        mut,
        seeds = [MULTISIG_SEED, multisig.base.key().as_ref()],
        bump = multisig.bump,
        constraint = multisig.members.contains(&member.key()) @ MultisigError::UnauthorizedMember,
    )]
    pub multisig: Account<'info, Multisig>,
    #[account(
        mut,
        seeds = [
            TRANSACTION_SEED,
            multisig.key().as_ref(),
            &transaction.id.to_le_bytes()
        ],
        bump = transaction.bump,
        constraint = transaction.signers.len() >= multisig.threshold as usize @ MultisigError::InsufficientVotes,
        constraint = !transaction.executed @ MultisigError::TransactionAlreadyExecuted,
    )]
    pub transaction: Account<'info, Transaction>,
    pub system_program: Program<'info, System>,
}

impl ExecuteTransaction<'_> {
    pub fn handler(ctx: Context<ExecuteTransaction>) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let base_key = multisig.base.key();
        let signer = multisig_signer!(base_key, multisig.bump);

        for transaction_type in &transaction.transaction_types {
            match transaction_type {
                TransactionType::Instruction(instruction) => {
                    let instruction = anchor_lang::solana_program::instruction::Instruction {
                        program_id: instruction.program_id,
                        // map Borsh AccountMeta into native AccountMeta
                        accounts: instruction
                            .accounts
                            .iter()
                            .map(|account_meta| {
                                anchor_lang::solana_program::instruction::AccountMeta {
                                    pubkey: account_meta.pubkey,
                                    is_signer: account_meta.is_signer,
                                    is_writable: account_meta.is_writable,
                                }
                            })
                            .collect(),
                        data: instruction.data.clone(),
                    };

                    invoke_signed(&instruction, ctx.remaining_accounts, &[signer])?;
                }
                TransactionType::MultisigAction(action) => match action {
                    MultisigAction::AddMember { member } => {
                        require!(
                            !multisig.members.contains(&member),
                            MultisigError::MemberAlreadyExists
                        );

                        let current_data_len = multisig.to_account_info().data_len();

                        multisig.members.push(*member);

                        let new_data_len = Multisig::space(&multisig.members);

                        if new_data_len > current_data_len {
                            Multisig::top_up_rent(
                                multisig.to_account_info(),
                                ctx.accounts.member.to_account_info(),
                                ctx.accounts.system_program.to_account_info(),
                                new_data_len,
                            )?;
                        }
                    }
                    MultisigAction::RemoveMember { member } => {
                        require!(
                            multisig.members.len() > multisig.threshold as usize,
                            MultisigError::CannotRemoveMemberBelowThreshold
                        );
                        require!(
                            multisig.members.contains(&member),
                            MultisigError::MemberDoesNotExist
                        );
                        multisig.members.retain(|&m| m != *member);
                    }
                    MultisigAction::SetThreshold { threshold } => {
                        require!(
                            *threshold <= multisig.members.len() as u8,
                            MultisigError::InvalidThreshold
                        );
                        multisig.threshold = *threshold;
                    }
                },
            }
        }

        transaction.executed = true;

        Ok(())
    }
}
