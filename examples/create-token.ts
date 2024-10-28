import config from "@/config.toml";
import { createToken } from "@/token";
import { fromMnemonic } from "@/utils";
import type { DataV2 } from "@metaplex-foundation/mpl-token-metadata";
import { none } from "@metaplex-foundation/umi";
import { Connection, Keypair } from "@solana/web3.js";


async function main() {
    const connection = new Connection(config.network.rpc[0], 'finalized')
    const payer = fromMnemonic(config.wallet.mnemonic, 0)
    const mint = Keypair.generate()
    console.log(`Creating token with mint ${mint.publicKey.toBase58()}`)
    
    const metadata: DataV2 = {
        name: "Test Token",
        symbol: "TT",
        uri: "",
        sellerFeeBasisPoints: 0,
        creators: none(),
        collection: none(),
        uses: none()
    }

    // default token type(TOKEN_PROGRAM_ID) and decimals(9)
    await createToken(connection, payer, mint, metadata)
}

main()


