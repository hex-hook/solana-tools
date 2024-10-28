import config from '@/config.toml'
import { collectAllTokenAndCloseAccount, queryMultipleTokenBalance } from '@/token'
import { fromMnemonic } from '@/utils'
import { Connection, PublicKey } from '@solana/web3.js'

async function main() {
    const mnemonic = config.wallet.mnemonic
    const count = 10
    const wallets = Array.from({ length: count }, (_, i) => fromMnemonic(mnemonic, i))
    const connection = new Connection(config.network.rpc[0])

    const mint = new PublicKey('4AAE7YJmdBwZ6nzx8vXURgphmt1JgbixFzRYtELCaJwz')
    await queryMultipleTokenBalance(connection, mint, wallets.map(item => item.publicKey))
    // change target wallet address
    await collectAllTokenAndCloseAccount(connection, mint, wallets[1], wallets, new PublicKey('ELECmNRLpd358DYJzLgPrKjdNVrTzX1NUfbMwU8mEaxN'))

    await queryMultipleTokenBalance(connection, mint, wallets.map(item => item.publicKey))
}
main()