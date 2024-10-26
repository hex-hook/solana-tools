import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, type Idl } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import config from '@/config.toml'
import idl from '@/examples/fucksun/idl.json'
import { fromMnemonic} from "@/index";
import { sleep } from "bun";

const MINT = new PublicKey('7g6qxcgqsDCFnoSheY2qNqFQTPfUC7gW6XjPgxPSkn21')
const AUTH = new PublicKey('396e8hJkEXeB2wAGgrc8p13NqxJ3KhWCRMKWrHXyUhXi')
const PROGRAM_ID = new PublicKey(idl.address)
const CONFIG = PublicKey.findProgramAddressSync([Buffer.from('config'), AUTH.toBuffer()], PROGRAM_ID)[0]

// 单号(1000 次上限)
// ata: 0.002 SOL (可回收)
// pda state: 0.003 SOL (不可回收，最终给程序创建者)
// fee(最大1000次): 0.005 SOL = 0.000005 * 1000
// 交互 1000 次磨损： 0.008 SOL = 0.005 + 0.003
// 代币价值: 11.76 u = 0.001176 * 1000
// 交互基础金额(1000 次): 0.01 SOL = 0.002 + 0.003 + 0.005
// 理想收益(1000 次 mintTo，不包含 swap)：10.4 u = 11.75 - 0.008 * 168
async function mintTo(connection: Connection, payer: Keypair) {

    const provider = new AnchorProvider(connection, new Wallet(payer));
    const program = new Program(idl as Idl, provider);
    const ata = getAssociatedTokenAddressSync(MINT, payer.publicKey);
    // 使用 fuck 而不是 fuck_100 指令，fuck_100 指令会固定收取 0.1 SOL 的贿赂费！代币价值高于 0.1 SOL 才能赚到
    const ix = await program.methods.fuck()
        .accountsPartial({
            mint: MINT,
            config: CONFIG,
            userAta: ata,
            signer: payer.publicKey
        })
        .instruction()
    const transaction = new Transaction().add(ix)
    const tx = await connection.sendTransaction(transaction, [payer])
    console.log(tx)
}

async function batchMint(connection: Connection, payer: Keypair, count: number) {
    for (let i = 0; i < count; i++) {
        try {
            await mintTo(connection, payer)
        } catch (e) {
            console.error(e)
        }
        await sleep(2000)
    }
}

async function main() {
    const connection = new Connection(config.network.rpc[0])
    // 池子较小，无需批量
    // const payers = new Array(200).fill(null).map((_, index) =>fromMnemonic(config.wallet.mnemonic, index))
    // const payerAccounts = payers.map(payer => payer.publicKey);
    // const balances = await queryMultipleBalance(payerAccounts)
    // const tokenBalances = await queryMultipleTokenBalance(MINT, payerAccounts)
    const payer = fromMnemonic(config.wallet.mnemonic, 2)
    // 最多 1000 次，失败了会扣手续费，自行检查剩余次数
    await batchMint(connection, payer, 1000)
}

// 由于流动性池子较小，最终收益远不及预期，不建议使用。仅用于学习
// main()

