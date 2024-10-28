import config from '@/config.toml'
import { collectAllTokenAndCloseAccount, queryMultipleTokenBalance } from '@/token'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'

async function collectDuck() {
    const connection = new Connection(config.network.rpc[0])
    const wallets = config.wallet.keys.map(key => Keypair.fromSecretKey(bs58.decode(key)))
    const duckMint = new PublicKey('4ALKS249vAS3WSCUxXtHJVZN753kZV6ucEQC41421Rka')
    await queryMultipleTokenBalance(connection, duckMint, wallets.map(item => item.publicKey))
    // change target wallet address
    await collectAllTokenAndCloseAccount(connection, duckMint, wallets[1], wallets, new PublicKey('ELECmNRLpd358DYJzLgPrKjdNVrTzX1NUfbMwU8mEaxN'))

    await queryMultipleTokenBalance(connection, duckMint, wallets.map(item => item.publicKey))
}
collectDuck()