import { collectToken, fromMnemonic, queryMultipleTokenBalance } from '@/index'
import config from '@/config.toml'
import { Keypair, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'

async function collectDuck() {
    const wallets = config.wallet.keys.map(key => Keypair.fromSecretKey(bs58.decode(key)))
    const duckMint = new PublicKey('4ALKS249vAS3WSCUxXtHJVZN753kZV6ucEQC41421Rka')
    await queryMultipleTokenBalance(duckMint, wallets.map(item => item.publicKey))
    // change target wallet address
    await collectToken(duckMint, wallets[1], wallets, new PublicKey('ELECmNRLpd358DYJzLgPrKjdNVrTzX1NUfbMwU8mEaxN'))

    await queryMultipleTokenBalance(duckMint, wallets.map(item => item.publicKey))
}
collectDuck()