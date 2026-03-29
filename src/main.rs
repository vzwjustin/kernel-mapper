mod cli;
mod parser;
mod storage;

use anyhow::Result;
use clap::Parser;
use cli::Cli;

fn main() -> Result<()> {
    env_logger::init();
    let cli = Cli::parse();
    cli::dispatch(cli)
}
