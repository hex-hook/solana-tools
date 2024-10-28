import { group, sleep } from '@/utils';
import bs58 from 'bs58';
import { type DataV2, createMetadataAccountV3 } from '@metaplex-foundation/mpl-token-metadata';
import { createSignerFromKeypair, publicKey } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createAssociatedTokenAccountInstruction, createCloseAccountInstruction, createMint, createMintToInstruction, createTransferInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, unpackMint } from '@solana/spl-token';
import { LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, Transaction, type Connection, type Keypair, type ParsedAccountData, type TokenAmount } from '@solana/web3.js';


/**
 * Creates a new token mint and token metadata.
 * 
 * @param connection - The Connection object for the Solana cluster.
 * @param payer - The Keypair object representing the account that will pay for the mint creation.
 * @param mint - The Keypair object representing the token mint.
 * @param metadata - The metadata object for the token mint.
 * @param decimals - The number of decimal places for the token mint.
 * 
 * @remarks
 * The metadata object must be in the format of the DataV2 type from the @metaplex-foundation/mpl-token-metadata library.
 */
export async function createToken(
    connection: Connection,
    payer: Keypair,
    mint: Keypair,
    metadata: DataV2,
    decimals: number = 9,
) {
    await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        decimals,
        mint,
    )
    console.log(`Create mint ${mint.publicKey.toBase58()} successfully`)
    console.log('waiting for create mint confirmed... 2s')
    await sleep(2000)
    const umi = createUmi(connection.rpcEndpoint)
    umi.payer = createSignerFromKeypair(umi, { publicKey: publicKey(payer.publicKey.toBase58()), secretKey: payer.secretKey })
    const transaction = await createMetadataAccountV3(umi, {
        mint: publicKey(mint.publicKey.toBase58()),
        mintAuthority: umi.payer,
        updateAuthority: publicKey(payer.publicKey.toBase58()),
        isMutable: true,
        data: metadata,
        collectionDetails: null,
    }).buildAndSign(umi)
    const tx = await umi.rpc.sendTransaction(transaction)
    console.log(`Create token metadata successfully, tx ${bs58.encode(tx)}`)
}


/**
 * Queries the metadata of a token mint.
 * 
 * @param connection - The Connection object for the Solana cluster.
 * @param mint - The PublicKey object representing the token mint.
 * @returns An object containing the metadata of the token mint.
 * 
 * @throws {Error} If the mint address is invalid, the mint owner is not the token program, or the mint owner is the token 2022 program.
 */
export async function getMintInfo(
    connection: Connection,
    mint: PublicKey,

) {
    const accountInfo = await connection.getAccountInfo(mint);
    if (accountInfo === null) {
        throw new Error('Invalid mint address')
    }
    const mintOwner = accountInfo.owner.toBase58();
    if (mintOwner == TOKEN_2022_PROGRAM_ID.toBase58()) {
        throw new Error('Unsupported token 2022')
    }
    if (mintOwner !== TOKEN_PROGRAM_ID.toBase58()) {
        throw new Error('Invalid mint owner')
    }
    const metadataInfo = unpackMint(mint, accountInfo, accountInfo.owner)
    return metadataInfo
}


async function getMultipleAtaInfo(connection: Connection, mint: PublicKey, targets: PublicKey[], programId: PublicKey = TOKEN_PROGRAM_ID): Promise<{ ata: PublicKey, target: PublicKey, exists: boolean }[]> {
    const targetAndAta = targets.map(item => ({ ata: getAssociatedTokenAddressSync(mint, item, true, programId), target: item }))
    const accountGroups = group(targetAndAta, 10)
    const res = []
    for (const tokenAccounts of accountGroups) {
        const accountInfos = await connection.getMultipleAccountsInfo(tokenAccounts.map(item => item.ata))
        for (let i = 0; i < accountInfos.length; i++) {
            res.push({
                ...tokenAccounts[i],
                exists: accountInfos[i] != null
            })
        }
    }

    return res
}

/**
 * Mints tokens to multiple target accounts.
 * 
 * @param connection - The Connection object for the Solana cluster.
 * @param payer - The Keypair object representing the account that will pay for the minting.
 * @param mint - The PublicKey object representing the token mint.
 * @param targets - An array of PublicKey objects representing the target accounts to receive the minted tokens.
 * @param amount - The amount of tokens to mint to each target account.
 */
export async function batchMintTo(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    targets: PublicKey[],
    amount: number
) {
    const mintMetadataInfo = await getMintInfo(connection, mint)
    const mintAuthority = mintMetadataInfo.mintAuthority?.toBase58()
    if (mintAuthority != payer.publicKey.toBase58()) {
        throw new Error('Invalid mint authority')
    }
    const accounts = (await getMultipleAtaInfo(connection, mint, targets))
    const accountGroups = group(accounts, 5)
    for (const accountGroup of accountGroups) {
        const transaction = new Transaction()
        for (const account of accountGroup) {
            if (!account.exists) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        payer.publicKey,
                        account.ata,
                        account.target,
                        mint,
                    )
                )
            }
            transaction.add(
                createMintToInstruction(
                    mint,
                    account.ata,
                    payer.publicKey,
                    BigInt(10 ** mintMetadataInfo.decimals) * BigInt(amount),
                    [],
                )
            )
        }
        try {
            const tx = await sendAndConfirmTransaction(connection, transaction, [payer])
            console.log(`Batch mint to ${accountGroup.map(item => item.target.toBase58())} successfully, tx ${tx}`)
        } catch (error) {
            console.warn(`Maybe batch mint to ${accountGroup.map(item => item.target.toBase58())} failed, Please view from blockchain browser!`, error)
        }
    }

}



/**
 * Queries the token balance of multiple accounts for a specific token mint.
 *
 * @param connection - The Connection object for the Solana cluster.
 * @param mint - The PublicKey object representing the token mint.
 * @param accounts - An array of PublicKey objects representing the accounts to query.
 * @returns An array of objects containing the address and token balance of each account.
 *
 * @remarks
 * This function groups the accounts into batches of 50 and queries the token balance of each batch.
 * The balance is returned in the smallest unit of the token (e.g., wei for ETH, satoshis for BTC).
 */
export async function queryMultipleTokenBalance(connection: Connection, mint: PublicKey, accounts: PublicKey[]) {
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
 * Generates transfer instructions for multiple token accounts to transfer a specified amount of tokens to a target token account.
 * 
 * @param connection - The Connection object for the Solana cluster.
 * @param accounts - An array of objects containing the signer (Keypair) and the associated token account (ATA) for each source account.
 * @param targetAta - The PublicKey object representing the destination token account to receive the tokens.
 * @param transferAmount - The amount of tokens to transfer from each source account to the target account. If undefined, the full balance of each source account will be transferred.
 * @returns An array of objects containing the transfer instruction, close instruction (if applicable), signer, and amount for each source account.
 * 
 * @throws {Error} If any of the source token accounts have insufficient balance to cover the specified amount.
 */
async function getTokenTransferInstructions(
    connection: Connection,
    accounts: { signer: Keypair, ata: PublicKey }[],
    targetAta: PublicKey,
    transferAmount: number
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
        const account = accounts[i]
        const data = item.data as ParsedAccountData
        const tokenAmount = data.parsed.info.tokenAmount as TokenAmount
        const uiAmount = tokenAmount.uiAmount || 0
        // skip if balance is less than transfer amount
        if (uiAmount < transferAmount) {
            console.debug(`skip ${account.signer.publicKey.toBase58()} due to insufficient balance`)
            continue
        }
        const amount = BigInt(transferAmount) * BigInt(10 ** tokenAmount.decimals)
        const signer = account.signer

        // if token amount is 0, don't transfer
        const instruction = createTransferInstruction(
            account.ata,
            targetAta,
            signer.publicKey,
            amount
        )

        instructions.push({
            instruction,
            signers: signer,
            amount: transferAmount,
        })
    }
    return instructions
}

/**
 * Generates transfer instructions for multiple token accounts to transfer all tokens to a target token account and close the source accounts.
 * 
 * @param connection - The Connection object for the Solana cluster.
 * @param accounts - An array of objects containing the signer (Keypair) and the associated token account (ATA) for each source account.
 * @param targetAta - The PublicKey object representing the destination token account to receive the tokens.
 * @returns An array of objects containing the transfer instruction, close instruction, signer, and amount for each source account.
 */
async function getAllTokenTransferInstructions(connection: Connection, accounts: { signer: Keypair, ata: PublicKey }[], targetAta: PublicKey) {
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
        const tokenAmount = data.parsed.info.tokenAmount as TokenAmount
        const amount = BigInt(tokenAmount.amount)
        const signer = accounts[i].signer
        let transferInstruction = null
        if (amount > 0) {
            transferInstruction = createTransferInstruction(
                accounts[i].ata,
                targetAta,
                signer.publicKey,
                amount
            )
        }
        // close account instruction
        const closeInstruction = createCloseAccountInstruction(
            accounts[i].ata,
            signer.publicKey,
            signer.publicKey,
        )
        instructions.push({
            instruction: transferInstruction,
            signers: signer,
            amount: tokenAmount.uiAmount,
            closeInstruction,
        })
    }
    return instructions
}

/**
 * Collects a specified amount of tokens from multiple source accounts and transfers them to a payer account.
 * 
 * @param connection - The Connection object for the Solana cluster.
 * @param mint - The PublicKey object representing the token mint.
 * @param payer - The Keypair object representing the account that will receive the collected tokens.
 * @param sources - An array of Keypair objects representing the source accounts from which to collect tokens.
 * @param target - The PublicKey object representing the destination token account to receive the tokens.
 * @param amount - The amount of tokens to collect from each source account. If undefined, the full balance of each source account will be collected.
 * @returns A Promise that resolves when all collections have been successfully sent and confirmed.
 * 
 * @throws {Error} If the amount is not greater than 0, or if the payer's balance is not enough to cover the total amount to be collected.
 */
export async function collectToken(connection: Connection, mint: PublicKey, payer: Keypair, sources: Keypair[], target: PublicKey, amount: number) {
    if (amount <= 0) {
        throw new Error('amount must be greater than 0')
    }
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
        const instructions = await getTokenTransferInstructions(connection, accounts, targetAta, amount)
        if (instructions.length > 0) {
            instructionAndSigners.push(...instructions)
        }
    }
    const instructionAndSignerGroup = group(instructionAndSigners, 10)
    const ataInfo = await connection.getParsedAccountInfo(targetAta)
    let ataInstruction = []
    if (ataInfo.value == null) {
        ataInstruction.push(createAssociatedTokenAccountInstruction(payer.publicKey, targetAta, target, mint))
    }

    for (const instructionAndSigner of instructionAndSignerGroup) {
        const { blockhash } = await connection.getLatestBlockhash();
        const transaction = new Transaction()
        if (ataInstruction.length > 0) {
            transaction.add(ataInstruction.pop()!)
            console.log(`create target ata: ${targetAta.toBase58()}`)
        }
        transaction.add(...instructionAndSigner.map((item) => item.instruction).filter((item) => item != null))
        transaction.feePayer = payer.publicKey
        transaction.recentBlockhash = blockhash;

        try {
            const tx = await sendAndConfirmTransaction(connection, transaction, [payer, ...instructionAndSigner.map((item) => item.signers)])
            console.log(tx)
            console.table(instructionAndSigner.map(item => ({ address: item.signers.publicKey.toBase58(), amount: item.amount })))

        } catch (error) {
            console.warn(`Maybe collect token failed ${instructionAndSigner.map(item => item.signers.publicKey.toBase58())}, Please view from blockchain browser!`, error)
        }
    }
}

/**
 * Collects all tokens from multiple source accounts and transfers them to a payer account.
 * 
 * @param connection - The Connection object for the Solana cluster.
 * @param mint - The PublicKey object representing the token mint.
 * @param payer - The Keypair object representing the account that will receive the collected tokens.
 * @param sources - An array of Keypair objects representing the source accounts from which to collect tokens.
 * @param target - The PublicKey object representing the destination token account to receive the tokens.
 */
export async function collectAllTokenAndCloseAccount(connection: Connection, mint: PublicKey, payer: Keypair, sources: Keypair[], target: PublicKey) {
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
        const instructions = await getAllTokenTransferInstructions(connection, accounts, targetAta)
        if (instructions.length > 0) {
            instructionAndSigners.push(...instructions)
        }
    }
    const instructionAndSignerGroup = group(instructionAndSigners, 5)
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
        transaction.add(...instructionAndSigner.map((item) => item.closeInstruction!))
        transaction.feePayer = payer.publicKey
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        try {

            const tx = await sendAndConfirmTransaction(connection, transaction, [payer, ...instructionAndSigner.map((item) => item.signers)])
            console.log(tx)
            console.table(instructionAndSigner.map(item => ({ address: item.signers.publicKey.toBase58(), amount: item.amount })))
        } catch (error) {
            console.warn(`Maybe collect token and close account failed ${instructionAndSigner.map(item => item.signers.publicKey.toBase58())}, Please view from blockchain browser!`, error)
        }
    }
}

