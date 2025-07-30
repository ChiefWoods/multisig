use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

#[account]
pub struct Multisig {
    pub threshold: u8,            // 1
    pub bump: u8,                 // 1
    pub next_transaction_id: u16, // 2
    pub base: Pubkey,             // 32
    pub members: Vec<Pubkey>,     // 4
}

impl Multisig {
    pub fn space(members: &Vec<Pubkey>) -> usize {
        Multisig::DISCRIMINATOR.len() + 1 + 1 + 2 + 32 + (4 + members.len() * 32)
    }

    pub fn top_up_rent<'a>(
        multisig: AccountInfo<'a>,
        member: AccountInfo<'a>,
        system_program: AccountInfo<'a>,
        new_len: usize,
    ) -> Result<()> {
        multisig.resize(new_len)?;

        let rent_exempt_lamports = Rent::get()?.minimum_balance(new_len);
        let lamports_to_top_up = rent_exempt_lamports.saturating_sub(multisig.lamports());

        transfer(
            CpiContext::new(
                system_program,
                Transfer {
                    from: member,
                    to: multisig,
                },
            ),
            lamports_to_top_up,
        )
    }
}
