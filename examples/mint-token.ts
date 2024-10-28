import config from "@/config.toml";
import { batchMintTo } from "@/token";
import { fromMnemonic } from "@/utils";
import { Connection, PublicKey } from "@solana/web3.js";




async function main() {
    const mint = new PublicKey('4AAE7YJmdBwZ6nzx8vXURgphmt1JgbixFzRYtELCaJwz')
    const connection = new Connection(config.network.rpc[0])
    const payer = fromMnemonic(config.wallet.mnemonic, 0)
    const targets = new Array(20).fill(null).map((_, index) => fromMnemonic(config.wallet.mnemonic, index).publicKey)
    await batchMintTo(connection, payer, mint, targets, 100)
}

main()