use anchor_lang::prelude::*;

use crate::{
    error::MultisigError, Multisig, Transaction, TransactionType, MULTISIG_SEED, TRANSACTION_SEED,
};

#[derive(Accounts)]
#[instruction(transaction_types: Vec<TransactionType>)]
pub struct ProposeTransaction<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,
    #[account(
        mut,
        seeds = [MULTISIG_SEED, multisig.base.key().as_ref()],
        bump = multisig.bump,
        constraint = multisig.members.contains(&proposer.key()) @ MultisigError::UnauthorizedMember,
    )]
    pub multisig: Account<'info, Multisig>,
    #[account(
        init,
        payer = proposer,
        space = Transaction::space(&transaction_types),
        seeds = [
            TRANSACTION_SEED,
            multisig.key().as_ref(),
            &multisig.next_transaction_id.to_le_bytes()
        ],
        bump,
    )]
    pub transaction: Account<'info, Transaction>,
    pub system_program: Program<'info, System>,
}

impl ProposeTransaction<'_> {
    pub fn handler(
        ctx: Context<ProposeTransaction>,
        transaction_types: Vec<TransactionType>,
    ) -> Result<()> {
        require!(
            !transaction_types.is_empty(),
            MultisigError::EmptyTransactionTypesList
        );

        let multisig = &mut ctx.accounts.multisig;

        ctx.accounts.transaction.set_inner(Transaction {
            bump: ctx.bumps.transaction,
            executed: false,
            id: multisig.next_transaction_id,
            multisig: multisig.key(),
            proposer: ctx.accounts.proposer.key(),
            signers: Vec::new(),
            transaction_types,
        });

        msg!(
            "transaction size: {}",
            ctx.accounts.transaction.to_account_info().data_len()
        );

        multisig.next_transaction_id += 1;

        Ok(())
    }
}
