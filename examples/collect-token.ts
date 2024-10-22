import { collectToken, fromMnemonic, queryMultipleTokenBalance } from '@/index'
import config from '@/config.toml'
import { PublicKey } from '@solana/web3.js'

async function collectDuck() {
    const mnemonic = config.wallet.mnemonic
    const count = config.wallet.count
    const wallets = Array.from({ length: count }, (_, i) => fromMnemonic(mnemonic, i))

    const duckMint = new PublicKey('4ALKS249vAS3WSCUxXtHJVZN753kZV6ucEQC41421Rka')
    await queryMultipleTokenBalance(duckMint, wallets.map(item => item.publicKey))
    // change target wallet address
    await collectToken(duckMint, wallets[1], wallets, new PublicKey('ELECmNRLpd358DYJzLgPrKjdNVrTzX1NUfbMwU8mEaxN'))

    await queryMultipleTokenBalance(duckMint, wallets.map(item => item.publicKey))
}
collectDuck()