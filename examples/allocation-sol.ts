import { Connection } from "@solana/web3.js";
import { fromMnemonic } from "@/utils";
import config from "@/config.toml";
import { allocationSOL } from "@/sol";


async function main() {
    const connection = new Connection(config.network.rpc[0])
    const wallets = new Array(30).fill(null).map((_, index) => fromMnemonic(config.wallet.mnemonic, index))
    const target = wallets.map(item => item.publicKey).splice(2, 15)
    const source = wallets[1]
    await allocationSOL(connection, source, target, 0.1)
}

main()