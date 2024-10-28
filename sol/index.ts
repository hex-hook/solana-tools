import { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js"
import { group } from "@/utils"

/**
 * Allocates a specified amount of SOL to a list of target accounts.
 *
 * @param connection - The Connection object for the Solana cluster.
 * @param payer - The Keypair object representing the account that will pay for the allocations.
 * @param targets - An array of PublicKey objects representing the target accounts to receive the allocations.
 * @param amount - The amount of SOL to allocate to each target account.
 * @returns A Promise that resolves when all allocations have been successfully sent and confirmed.
 *
 * @remarks
 * This function groups the target accounts into batches of 20 and creates a transaction for each batch.
 * Each transaction contains a SystemProgram.transfer instruction to transfer the specified amount of SOL
 * from the payer's account to each target account in the batch. The transactions are then sent and confirmed
 * using the sendAndConfirmTransaction method from the @solana/web3.js library.
 *
 * @throws {Error} If the payer's balance is not enough to cover the total amount to be allocated.
 */
export async function allocationSOL(connection: Connection, payer: Keypair, targets: PublicKey[], amount: number) {
    const balance = await connection.getBalance(payer.publicKey)
    if (balance == 0 || balance < amount * targets.length * LAMPORTS_PER_SOL) {
        throw new Error('payer balance is not enough')
    }
    const accountGroups = group(targets, 20)
    for (const accounts of accountGroups) {
        const transaction = new Transaction()
        for (const account of accounts) {
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: payer.publicKey,
                    toPubkey: account,
                    lamports: amount * LAMPORTS_PER_SOL
                }))
        }
        try {
            const tx = await sendAndConfirmTransaction(connection, transaction, [payer])
            console.log(tx)
            console.log(`send ${amount} sol to ${accounts.map(item => item.toBase58())} accounts`)
        } catch (error) {
            // Maybe it wasn't a real failure.
            console.warn(`Maybe [${payer.publicKey.toBase58()}] send [${amount}] SOL to [${accounts}] failed, Please view from blockchain browser!`, error)
        }
    }
}


/**
 * Queries the balance of multiple accounts in groups of 50.
 * 
 * @param connection - The Connection object for the Solana cluster.
 * @param accounts - An array of PublicKey objects representing the accounts to query.
 * @returns An array of objects containing the address and balance of each account in SOL.
 *
 * @remarks
 * This function groups the accounts into batches of 50 and queries the balance of each batch.
 * The balance is returned in SOL with two decimal places.
 */
export async function queryMultipleBalance(connection: Connection, accounts: PublicKey[]) {
    const accountGroups = group(accounts, 50)
    const res = []
    for (const accounts of accountGroups) {
        const balances = await connection.getMultipleAccountsInfo(accounts)
        for (let i = 0; i < balances.length; i++) {
            const item = balances[i]
            const address = accounts[i].toBase58()
            const balance = item == null ? 0 : item.lamports / LAMPORTS_PER_SOL
            res.push({ address, balance: `${balance} SOL` })
        }
    }
    console.table(res)
    return res
}


/**
 * Generates transfer instructions for multiple accounts to transfer a specified amount of SOL to a payer account.
 *
 * @param connection - The Connection object for the Solana cluster.
 * @param accounts - An array of Keypair objects representing the source accounts.
 * @param payer - The PublicKey object representing the destination account to receive the SOL.
 * @param amount - The amount of SOL to transfer from each source account to the payer account. If undefined, the full balance of each source account will be transferred.
 * @returns An array of objects containing the transfer instruction, signer, and amount for each source account.
 *
 * @remarks
 * This function queries the balance of each source account and generates a transfer instruction for those with sufficient balance.
 * If the amount is not specified, the full balance of the account will be transferred.
 * The transfer instructions are created using the SystemProgram.transfer method from the @solana/web3.js library.
 *
 * @throws {Error} If any of the source accounts have insufficient balance to cover the specified amount.
 */
async function getTransferInstructions(connection: Connection, accounts: Keypair[], payer: PublicKey, amount: number) {
    const balances = await connection.getMultipleAccountsInfo(accounts.map((account) => account.publicKey))
    const res = []
    for (let i = 0; i < balances.length; i++) {
        const item = balances[i]
        if (item == null || item.lamports == 0) {
            continue
        }
        let realAmount = amount == 0 ? item.lamports : amount * LAMPORTS_PER_SOL
        if (realAmount > item.lamports) {
            continue
        }
        res.push({
            instruction: SystemProgram.transfer({
                fromPubkey: accounts[i].publicKey,
                toPubkey: payer,
                lamports: realAmount
            }),
            signers: accounts[i],
            amount: realAmount / LAMPORTS_PER_SOL
        })
    }
    return res
}

/**
 * Collects a specified amount of SOL from multiple source accounts and transfers it to a payer account.
 * 
 * @param connection - The Connection object for the Solana cluster.
 * @param payer - The Keypair object representing the account that will receive the collected SOL.
 * @param sources - An array of Keypair objects representing the source accounts from which to collect SOL.
 * @param amount - The amount of SOL to collect from each source account. If undefined, the full balance of each source account will be collected.
 * @returns A Promise that resolves when all collections have been successfully sent and confirmed.
 * 
 * @throws {Error} If the amount is not greater than 0, or if the payer's balance is not enough to cover the total amount to be collected.
 */
export async function collectSOL(connection: Connection, payer: Keypair, sources: Keypair[], amount: number) {
    if (amount <= 0) {
        throw new Error('amount must be greater than 0')
    }
    const balance = await connection.getBalance(payer.publicKey)
    if (balance < 0.001 * LAMPORTS_PER_SOL) {
        throw new Error('payer balance is not enough')
    }
    const accountGroups = group(sources, 20)
    const instructionAndSigners = []
    for (const accounts of accountGroups) {
        const instructions = await getTransferInstructions(connection, accounts, payer.publicKey, amount)
        if (instructions.length > 0) {
            instructionAndSigners.push(...instructions)
        }
    }

    const instructionAndSignerGroups = group(instructionAndSigners, 20)
    for (const instructionAndSignerGroup of instructionAndSignerGroups) {
        const transaction = new Transaction().add(...instructionAndSignerGroup.map((item) => item.instruction))
        transaction.feePayer = payer.publicKey
        try {
            const tx = await sendAndConfirmTransaction(connection, transaction, [payer, ...instructionAndSignerGroup.map((item) => item.signers)])
            console.log(tx)
            console.table(instructionAndSignerGroup.map(item => ({ address: item.signers.publicKey.toBase58(), amount: item.amount })))
        } catch (error) {
            console.warn(`Maybe collect SOL ${instructionAndSignerGroup.map(item => item.signers.publicKey.toBase58())} failed, Please view from blockchain browser!`, error)
        }
    }

}

/**
 * Collects all SOL from multiple source accounts and transfers it to a payer account.
 * 
 * @param connection - The Connection object for the Solana cluster.
 * @param payer - The Keypair object representing the account that will receive the collected SOL.
 * @param sources - An array of Keypair objects representing the source accounts from which to collect SOL.
 * @returns A Promise that resolves when all collections have been successfully sent and confirmed.
 * 
 * @throws {Error} If the payer's balance is not enough to cover the total amount to be collected.
 */
export async function collectAllSOL(connection: Connection, payer: Keypair, sources: Keypair[]) {
    const balance = await connection.getBalance(payer.publicKey)
    if (balance < 0.001 * LAMPORTS_PER_SOL) {
        throw new Error('payer balance is not enough')
    }
    const accountGroups = group(sources, 20)
    const instructionAndSigners = []
    for (const accounts of accountGroups) {
        const instructions = await getTransferInstructions(connection, accounts, payer.publicKey, 0)
        if (instructions.length > 0) {
            instructionAndSigners.push(...instructions)
        }
    }

    const instructionAndSignerGroups = group(instructionAndSigners, 20)
    for (const instructionAndSignerGroup of instructionAndSignerGroups) {
        const transaction = new Transaction().add(...instructionAndSignerGroup.map((item) => item.instruction))
        transaction.feePayer = payer.publicKey
        try {
            const tx = await sendAndConfirmTransaction(connection, transaction, [payer, ...instructionAndSignerGroup.map((item) => item.signers)])
            console.log(tx)
            console.table(instructionAndSignerGroup.map(item => ({ address: item.signers.publicKey.toBase58(), amount: item.amount })))
        } catch (error) {
            console.warn(`Maybe collect SOL ${instructionAndSignerGroup.map(item => item.signers.publicKey.toBase58())} failed, Please view from blockchain browser!`, error)
        }
    }

}