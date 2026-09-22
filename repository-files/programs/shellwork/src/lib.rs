use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

declare_id!("EgaRMf8t5gnqEXa37xW9BYxgEiSmTsF2FkNfxr2kbyuh");

const MAX_METADATA_URI: usize = 200;
const MIN_DURATION: u64 = 3_600;
const MAX_DURATION: u64 = 3_650 * 24 * 3_600;

#[program]
pub mod shellwork {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        treasury: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        require!(
            treasury != Pubkey::default(),
            ShellworkError::InvalidAddress
        );
        require!(fee_bps <= 1_000, ShellworkError::InvalidFee);
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = treasury;
        config.fee_bps = fee_bps;
        Ok(())
    }

    pub fn update_config(ctx: Context<UpdateConfig>, treasury: Pubkey, fee_bps: u16) -> Result<()> {
        require!(
            treasury != Pubkey::default(),
            ShellworkError::InvalidAddress
        );
        require!(fee_bps <= 1_000, ShellworkError::InvalidFee);
        ctx.accounts.config.treasury = treasury;
        ctx.accounts.config.fee_bps = fee_bps;
        Ok(())
    }

    pub fn publish(
        ctx: Context<Publish>,
        id: [u8; 32],
        code_hash: [u8; 32],
        metadata_uri: String,
    ) -> Result<()> {
        validate_metadata(&code_hash, &metadata_uri)?;
        let component = &mut ctx.accounts.component;
        component.id = id;
        component.publisher = ctx.accounts.publisher.key();
        component.code_hash = code_hash;
        component.version = 1;
        component.active = true;
        component.metadata_uri = metadata_uri;
        Ok(())
    }

    pub fn update_component(
        ctx: Context<UpdateComponent>,
        code_hash: [u8; 32],
        metadata_uri: String,
    ) -> Result<()> {
        validate_metadata(&code_hash, &metadata_uri)?;
        let component = &mut ctx.accounts.component;
        component.code_hash = code_hash;
        component.version = component
            .version
            .checked_add(1)
            .ok_or(ShellworkError::Overflow)?;
        component.metadata_uri = metadata_uri;
        Ok(())
    }

    pub fn set_component_active(ctx: Context<UpdateComponent>, active: bool) -> Result<()> {
        ctx.accounts.component.active = active;
        Ok(())
    }

    pub fn create_listing(
        ctx: Context<CreateListing>,
        id: [u8; 32],
        price: u64,
        duration: u64,
        transferable: bool,
    ) -> Result<()> {
        require!(
            ctx.accounts.component.active,
            ShellworkError::ComponentInactive
        );
        require!(price > 0, ShellworkError::InvalidPrice);
        require!(
            (MIN_DURATION..=MAX_DURATION).contains(&duration),
            ShellworkError::InvalidDuration
        );
        let listing = &mut ctx.accounts.listing;
        listing.component_id = id;
        listing.publisher = ctx.accounts.publisher.key();
        listing.price = price;
        listing.duration = duration;
        listing.transferable = transferable;
        listing.active = true;
        Ok(())
    }

    pub fn set_listing_active(ctx: Context<SetListingActive>, active: bool) -> Result<()> {
        ctx.accounts.listing.active = active;
        Ok(())
    }

    pub fn purchase(ctx: Context<Purchase>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        let component = &ctx.accounts.component;
        require!(
            listing.active && component.active,
            ShellworkError::ListingUnavailable
        );
        require_keys_eq!(
            listing.publisher,
            component.publisher,
            ShellworkError::Unauthorized
        );
        let now = Clock::get()?.unix_timestamp;
        let license = &mut ctx.accounts.license;
        if license.owner != Pubkey::default() {
            require_keys_eq!(
                license.owner,
                ctx.accounts.buyer.key(),
                ShellworkError::Unauthorized
            );
            require!(
                license.component_id == listing.component_id,
                ShellworkError::InvalidAccount
            );
        }
        let start = license.expires_at.max(now);
        let expiry = start
            .checked_add(listing.duration as i64)
            .ok_or(ShellworkError::Overflow)?;
        let price = listing.price;
        let fee = ((price as u128) * (ctx.accounts.config.fee_bps as u128) / 10_000) as u64;
        let publisher_amount = price.checked_sub(fee).ok_or(ShellworkError::Overflow)?;
        if publisher_amount > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.publisher.to_account_info(),
                    },
                ),
                publisher_amount,
            )?;
        }
        if fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                fee,
            )?;
        }
        license.component_id = listing.component_id;
        license.owner = ctx.accounts.buyer.key();
        license.expires_at = expiry;
        license.transferable = listing.transferable;
        Ok(())
    }

    pub fn transfer_license(ctx: Context<TransferLicense>, id: [u8; 32]) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require_keys_neq!(
            ctx.accounts.owner.key(),
            ctx.accounts.recipient.key(),
            ShellworkError::InvalidAddress
        );
        let source = &mut ctx.accounts.source;
        require!(source.component_id == id, ShellworkError::InvalidAccount);
        require!(source.expires_at > now, ShellworkError::LicenseUnavailable);
        require!(source.transferable, ShellworkError::TransferDisabled);
        let target = &mut ctx.accounts.target;
        if target.owner != Pubkey::default() {
            require_keys_eq!(
                target.owner,
                ctx.accounts.recipient.key(),
                ShellworkError::InvalidAccount
            );
            require!(target.component_id == id, ShellworkError::InvalidAccount);
            require!(target.expires_at <= now, ShellworkError::LicenseUnavailable);
        }
        target.component_id = id;
        target.owner = ctx.accounts.recipient.key();
        target.expires_at = source.expires_at;
        target.transferable = true;
        source.expires_at = 0;
        source.transferable = false;
        Ok(())
    }
}

fn validate_metadata(code_hash: &[u8; 32], uri: &str) -> Result<()> {
    require!(*code_hash != [0; 32], ShellworkError::InvalidCodeHash);
    require!(
        !uri.is_empty() && uri.len() <= MAX_METADATA_URI,
        ShellworkError::InvalidMetadata
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(init, payer = admin, space = Config::SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [b"config"], bump, has_one = admin)]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(id: [u8; 32])]
pub struct Publish<'info> {
    #[account(init, payer = publisher, space = Component::SPACE, seeds = [b"component".as_ref(), id.as_ref()], bump)]
    pub component: Account<'info, Component>,
    #[account(mut)]
    pub publisher: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateComponent<'info> {
    #[account(mut, seeds = [b"component".as_ref(), component.id.as_ref()], bump, has_one = publisher)]
    pub component: Account<'info, Component>,
    pub publisher: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(id: [u8; 32])]
pub struct CreateListing<'info> {
    #[account(seeds = [b"component".as_ref(), id.as_ref()], bump, has_one = publisher)]
    pub component: Account<'info, Component>,
    #[account(init, payer = publisher, space = Listing::SPACE, seeds = [b"listing".as_ref(), id.as_ref()], bump)]
    pub listing: Account<'info, Listing>,
    #[account(mut)]
    pub publisher: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetListingActive<'info> {
    #[account(mut, seeds = [b"listing".as_ref(), listing.component_id.as_ref()], bump, has_one = publisher)]
    pub listing: Account<'info, Listing>,
    pub publisher: Signer<'info>,
}

#[derive(Accounts)]
pub struct Purchase<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"listing".as_ref(), listing.component_id.as_ref()], bump)]
    pub listing: Account<'info, Listing>,
    #[account(seeds = [b"component".as_ref(), listing.component_id.as_ref()], bump)]
    pub component: Account<'info, Component>,
    #[account(
        init_if_needed,
        payer = buyer,
        space = License::SPACE,
        seeds = [b"license".as_ref(), listing.component_id.as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub license: Account<'info, License>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: The listing stores the verified publisher address.
    #[account(mut, address = listing.publisher)]
    pub publisher: UncheckedAccount<'info>,
    /// CHECK: The config stores the verified treasury address.
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id: [u8; 32])]
pub struct TransferLicense<'info> {
    #[account(mut, seeds = [b"license".as_ref(), id.as_ref(), owner.key().as_ref()], bump, has_one = owner)]
    pub source: Account<'info, License>,
    #[account(
        init_if_needed,
        payer = owner,
        space = License::SPACE,
        seeds = [b"license".as_ref(), id.as_ref(), recipient.key().as_ref()],
        bump
    )]
    pub target: Account<'info, License>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Used only as a public-key seed and stored owner.
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
}
impl Config {
    pub const SPACE: usize = 8 + 32 + 32 + 2;
}

#[account]
pub struct Component {
    pub id: [u8; 32],
    pub publisher: Pubkey,
    pub code_hash: [u8; 32],
    pub version: u64,
    pub active: bool,
    pub metadata_uri: String,
}
impl Component {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 1 + 4 + MAX_METADATA_URI;
}

#[account]
pub struct Listing {
    pub component_id: [u8; 32],
    pub publisher: Pubkey,
    pub price: u64,
    pub duration: u64,
    pub transferable: bool,
    pub active: bool,
}
impl Listing {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1;
}

#[account]
pub struct License {
    pub component_id: [u8; 32],
    pub owner: Pubkey,
    pub expires_at: i64,
    pub transferable: bool,
}
impl License {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1;
}

#[error_code]
pub enum ShellworkError {
    #[msg("Invalid treasury or recipient address")]
    InvalidAddress,
    #[msg("Protocol fee must be at most 10 percent")]
    InvalidFee,
    #[msg("Component code hash is invalid")]
    InvalidCodeHash,
    #[msg("Metadata URI must be 1 to 200 bytes")]
    InvalidMetadata,
    #[msg("The component is inactive")]
    ComponentInactive,
    #[msg("Price must be positive")]
    InvalidPrice,
    #[msg("Duration must be between one hour and ten years")]
    InvalidDuration,
    #[msg("Listing is unavailable")]
    ListingUnavailable,
    #[msg("The signer is not authorized")]
    Unauthorized,
    #[msg("An account does not match the component")]
    InvalidAccount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("No active license is available")]
    LicenseUnavailable,
    #[msg("This license cannot be transferred")]
    TransferDisabled,
}
