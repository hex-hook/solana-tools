import config from "@/config.toml";
import { queryMultipleBalance } from "@/sol";
import { fromMnemonic } from "@/utils";
import { Connection } from "@solana/web3.js";


async function main() {
    const connection = new Connection(config.network.rpc[0])
    const keypairs = new Array(10).fill(null).map((_, index) => fromMnemonic(config.wallet.mnemonic, index))
    await queryMultipleBalance(connection, keypairs.map(item => item.publicKey))
}

main()