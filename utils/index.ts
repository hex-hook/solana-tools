import { Keypair } from "@solana/web3.js";
import { HDKey } from "micro-ed25519-hdkey";
import * as bip39 from 'bip39'

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

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}