import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction, type ParsedAccountData } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, createCloseAccountInstruction, createTransferInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { HDKey } from "micro-ed25519-hdkey";
import { sleep } from "bun";
import * as bip39 from 'bip39'
import config from '@/config.toml'

const connection = new Connection(config.network.rpc[0], 'confirmed')


function fromSeed(seed: Buffer, index: number): Keypair {
    const hd = HDKey.fromMasterSeed(new Uint8Array(seed))
    return Keypair.fromSeed(hd.derive(`m/44'/501'/${index}'/0`, true).privateKey)
}


/**
 * phantom hd wallet
 * Generates a Keypair from a given mnemonic and index.
 *
 * @param mnemonic - The mnemonic phrase used to generate the seed.
 * @param index - The index of the desired account.
 * @returns A Keypair generated from the seed and index.
 */
export function fromMnemonic(mnemonic: string, index: number): Keypair {
    const seed = bip39.mnemonicToSeedSync(mnemonic)
    return fromSeed(seed, index)
}

/**
 * Groups an array into smaller arrays of a specified size.
 *
 * @param data - The array of elements to be grouped.
 * @param size - The size of each group.
 * @returns An array of arrays, where each inner array is a group of elements from the original array.
 *
 * @remarks
 * This function iterates over the input array and creates new arrays of the specified size.
 * If the input array's length is not divisible by the group size, the last group will contain the remaining elements.
 *
 * @example
 * const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
 * const grouped = group(numbers, 3);
 * // grouped will be [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
 */
export function group<T>(data: T[], size: number): T[][] {
    const result = [];
    for (let i = 0; i < data.length; i += size) {
        result.push(data.slice(i, i + size));
    }
    return result;
}
/**
 * Queries the balance of multiple accounts in groups of 50.
 *
 * @param accounts - An array of PublicKey objects representing the accounts to query.
 * @returns An array of objects containing the address and balance of each account in SOL.
 *
 * @remarks
 * This function groups the accounts into batches of 50 and queries the balance of each batch.
 * The balance is returned in SOL with two decimal places.
 */
export async function queryMultipleBalance(accounts: PublicKey[]) {
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
 * Queries the token balance of multiple accounts for a specific token mint.
 *
 * @param mint - The PublicKey object representing the token mint.
 * @param accounts - An array of PublicKey objects representing the accounts to query.
 * @returns An array of objects containing the address and token balance of each account.
 *
 * @remarks
 * This function groups the accounts into batches of 50 and queries the token balance of each batch.
 * The balance is returned in the smallest unit of the token (e.g., wei for ETH, satoshis for BTC).
 */
export async function queryMultipleTokenBalance(mint: PublicKey, accounts: PublicKey[]) {
    const accountGroups = group(accounts.map(item => getAssociatedTokenAddressSync(mint, item)), 50)
    const res = []
    for (const tokenAccounts of accountGroups) {
        const balances = await connection.getMultipleParsedAccounts(tokenAccounts)
        for (let i = 0; i < balances.value.length; i++) {
            const item = balances.value[i]
            const address = accounts[i].toBase58()
            let lamports = 0 
            let balance = 0 
            if (item != null) {
                balance = (item.data as ParsedAccountData).parsed.info.tokenAmount.uiAmount
                lamports = item.lamports
            }
            res.push({ address, balance, lamports })
        }
    }
    console.log(`mint: ${mint.toBase58()}`)
    console.table(res)
    return res
}


/**
 * Allocates a specified amount of SOL to a list of target accounts.
 *
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
export async function allocation(payer: Keypair, targets: PublicKey[], amount: number) {
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
        const tx = await sendAndConfirmTransaction(connection, transaction, [payer])
        console.log(tx)
        console.log(`send ${amount} sol to ${accounts.map(item => item.toBase58())} accounts`)
        await sleep(config.network.sleep)
    }
}


/**
 * Generates transfer instructions for multiple accounts to transfer a specified amount of SOL to a payer account.
 *
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
async function getTransferInstructions(accounts: Keypair[], payer: PublicKey, amount: number | undefined) {
    const balances = await connection.getMultipleAccountsInfo(accounts.map((account) => account.publicKey))
    const limitAmount = amount == undefined ? 1 : amount * LAMPORTS_PER_SOL
    const res = []
    for (let i = 0; i < balances.length; i++) {
        const item = balances[i]
        if (item == null || item.lamports < limitAmount) {
            continue
        }
        const realAmount = amount == undefined ? item.lamports : amount * LAMPORTS_PER_SOL
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
 * @param payer - The Keypair object representing the account that will receive the collected SOL.
 * @param sources - An array of Keypair objects representing the source accounts from which to collect SOL.
 * @param amount - The amount of SOL to collect from each source account. If undefined, the full balance of each source account will be collected.
 * @returns A Promise that resolves when all collections have been successfully sent and confirmed.
 * 
 * @remarks
 * This function groups the source accounts into batches of 20 and generates transfer instructions for each batch.
 * Each transfer instruction is created using the SystemProgram.transfer method from the @solana/web3.js library.
 * The transactions are then sent and confirmed using the sendAndConfirmTransaction method.
 * 
 * @throws {Error} If the amount is not greater than 0, or if the payer's balance is not enough to cover the total amount to be collected.
 */
export async function collect(payer: Keypair, sources: Keypair[], amount: number | undefined) {
    if (amount != undefined && amount <= 0) {
        throw new Error('amount must be greater than 0')
    }
    const balance = await connection.getBalance(payer.publicKey)
    if (balance < 0.001 * LAMPORTS_PER_SOL) {
        throw new Error('payer balance is not enough')
    }
    const accountGroups = group(sources, 20)
    const instructionAndSigners = []
    for (const accounts of accountGroups) {
        const instructions = await getTransferInstructions(accounts, payer.publicKey, amount)
        if (instructions.length > 0) {
            instructionAndSigners.push(...instructions)
        }
    }

    const instructionAndSignerGroups = group(instructionAndSigners, 20)
    for (const instructionAndSignerGroup of instructionAndSignerGroups) {
        const transaction = new Transaction().add(...instructionAndSignerGroup.map((item) => item.instruction))
        transaction.feePayer = payer.publicKey
        const tx = await sendAndConfirmTransaction(connection, transaction, [payer, ...instructionAndSignerGroup.map((item) => item.signers)])
        console.log(tx)
        console.table(instructionAndSignerGroup.map(item => ({ address: item.signers.publicKey.toBase58(), amount: item.amount })))
        await sleep(config.network.sleep)
    }

}

/**
 * Generates transfer instructions for multiple token accounts to transfer a specified amount of tokens to a target token account.
 * 
 * @param accounts - An array of objects containing the signer (Keypair) and the associated token account (ATA) for each source account.
 * @param targetAta - The PublicKey object representing the destination token account to receive the tokens.
 * @param amount - The amount of tokens to transfer from each source account to the target account. If undefined, the full balance of each source account will be transferred.
 * @param closeAta - A boolean indicating whether to close the source token accounts after the transfer.
 * @returns An array of objects containing the transfer instruction, close instruction (if applicable), signer, and amount for each source account.
 * 
 * @remarks
 * This function queries the balance of each source token account and generates a transfer instruction for those with sufficient balance.
 * If the amount is not specified, the full balance of the account will be transferred.
 * The transfer instructions are created using the createTransferInstruction method from the @solana/spl-token library.
 * If the closeAta parameter is true, a close account instruction will be generated for each source token account.
 * The close account instructions are created using the createCloseAccountInstruction method from the @solana/spl-token library.
 * 
 * @throws {Error} If any of the source token accounts have insufficient balance to cover the specified amount.
 */
async function getTokenTransferInstructions(accounts: { signer: Keypair, ata: PublicKey }[], targetAta: PublicKey,
    amount: number | undefined, closeAta: boolean
) {
    const balances = await connection.getMultipleParsedAccounts(accounts.map((account) => account.ata))
    if (balances.value.length == 0) {
        return []
    }
    const instructions = []
    for (let i = 0; i < balances.value.length; i++) {
        const item = balances.value[i]
        if (item == null) {
            continue
        }
        const data = item.data as ParsedAccountData
        const uiAmount = data.parsed.info.tokenAmount.uiAmount
        if (amount != undefined && uiAmount < data.parsed.info.tokenAmount.amount) {
            continue
        }
        const realAmount = amount == undefined ? data.parsed.info.tokenAmount.amount.toString() : amount * (10 ** data.parsed.info.tokenAmount.decimals)
        const signer = accounts[i].signer

        // if token amount is 0, don't transfer
        let transferInstruction = null
        if (data.parsed.info.tokenAmount.amount > 0) {
            transferInstruction = createTransferInstruction(
                accounts[i].ata, 
                targetAta, 
                signer.publicKey, 
                realAmount
            )
        }
        let closeInstruction = null
        if (closeAta) {
            closeInstruction = createCloseAccountInstruction(
                accounts[i].ata,
                signer.publicKey,
                signer.publicKey,
            )
        }
        if (transferInstruction == null && closeInstruction == null) {
            continue
        }
        instructions.push({
            instruction: transferInstruction,
            closeInstruction: closeInstruction,
            signers: signer,
            amount: realAmount / (10 ** data.parsed.info.tokenAmount.decimals),
        })
    }
    return instructions
}

/**
 * Collects a specified amount of tokens from multiple source accounts and transfers them to a payer account.
 * 
 * @param mint - The PublicKey object representing the token mint.
 * @param payer - The Keypair object representing the account that will receive the collected tokens.
 * @param sources - An array of Keypair objects representing the source accounts from which to collect tokens.
 * @param amount - The amount of tokens to collect from each source account. If undefined, the full balance of each source account will be collected.
 * @returns A Promise that resolves when all collections have been successfully sent and confirmed.
 * 
 * @remarks
 * This function groups the source accounts into batches of 10 (if closing ATAs) or 20 (if not closing ATAs) and generates transfer instructions for each batch.
 * Each transfer instruction is created using the createTransferInstruction method from the @solana/spl-token library.
 * If the amount is not specified, the full balance of the account will be transferred.
 * If the closeAta parameter is true, a close account instruction will be generated for each source token account.
 * The close account instructions are created using the createCloseAccountInstruction method from the @solana/spl-token library.
 * The transactions are then sent and confirmed using the sendAndConfirmTransaction method.
 * 
 * @throws {Error} If the amount is not greater than 0, or if the payer's balance is not enough to cover the total amount to be collected.
 */
export async function collectToken(mint: PublicKey, payer: Keypair, sources: Keypair[], target: PublicKey, amount?: number | undefined) {
    if (amount != undefined && amount <= 0) {
        throw new Error('amount must be greater than 0')
    }
    const closeAta = amount == undefined
    const balance = await connection.getBalance(payer.publicKey)
    if (balance < 0.001 * LAMPORTS_PER_SOL) {
        throw new Error('payer balance is not enough')
    }
    const accountGroups = group(sources.map(item => ({
        signer: item,
        ata: getAssociatedTokenAddressSync(mint, item.publicKey)
    })), 50)
    const targetAta = getAssociatedTokenAddressSync(mint, target)
    const instructionAndSigners = []
    for (const accounts of accountGroups) {
        const instructions = await getTokenTransferInstructions(accounts, targetAta, amount, closeAta)
        if (instructions.length > 0) {
            instructionAndSigners.push(...instructions)
        }
    }
    const instructionAndSignerGroup = group(instructionAndSigners, closeAta ? 5 : 10)
    const ataInfo = await connection.getParsedAccountInfo(targetAta)
    let ataInstruction = []
    if (ataInfo.value == null) {
        ataInstruction.push(createAssociatedTokenAccountInstruction(payer.publicKey, targetAta, target, mint))
    }
    for (const instructionAndSigner of instructionAndSignerGroup) {
        const transaction = new Transaction()
        if (ataInstruction.length > 0) {
            transaction.add(ataInstruction.pop()!)
            console.log(`create target ata: ${targetAta.toBase58()}`)
        }
        transaction.add(...instructionAndSigner.map((item) => item.instruction).filter((item) => item != null))
        if (closeAta) {
            transaction.add(...instructionAndSigner.map((item) => item.closeInstruction!))
        }
        transaction.feePayer = payer.publicKey
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        
        const tx = await sendAndConfirmTransaction(connection, transaction, [payer, ...instructionAndSigner.map((item) => item.signers)])
        console.log(tx)
        console.table(instructionAndSigner.map(item => ({ address: item.signers.publicKey.toBase58(), amount: item.amount })))
        await sleep(config.network.sleep)
    }
}
