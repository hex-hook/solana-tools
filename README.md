<div align="center">

  <h3 align="center">Solana Tools</h3>

  <p align="center">
    This project mainly provides batch scripts commonly used in solana to facilitate on-chain operations.
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
  </ol>
</details>


## About The Project

This project provides batch scripts for token and SOL operations

| Function | Type | Note |
| -- | -- | -- |
| SOL batch distribution | SOL | Batch create wallet |
| Batch query SOL assets | SOL | |
| SOL aggregation | SOL | |
| Create Token | Token | |
| Token aggregation | Token | Close account when fully transferred out |
| Batch query Token assets | Token | |


## Getting Started

To use this project, you need to have `nodejs` environment or `bun` environment, and it is recommended to use `bun`

### Prerequisites

Here it is recommended to use `bun` as the runtime, and you can install `bun` using `npm`
* [Bun](https://bun.sh)
  ```sh
  npm i bun -g
  ```

### Installation

Use `bun i` to install dependencies, the current dependency situation is as follows

| Library | Purpose | Note |
| -- | -- | -- |
| `@solana/web3.js` | Basic on-chain interaction | Official sdk |
| `@solana/spl-token` | token related | Official sdk |
| `@coral-xyz/anchor` | Smart contract call | anchor official sdk |
| `@metaplex-foundation/umi` | metadata operation related | Create and parse token metadata information |
| `@metaplex-foundation/umi-bundle-defaults` | metadata operation related | |
| `@metaplex-foundation/mpl-token-metadata` | metadata operation related | |
| `bip39` | Mnemonic related support | Generate mnemonic |
| `bs58` | Encoding | |
| `micro-ed25519-hdkey` | HD wallet derivation |  |

## Usage

This project uses `config.toml` to configure parameters such as network, mnemonic, and private key.

- `network.rpc` is used to configure the rpc node, and the configured rpc should be normal before executing the script
- `wallet.mnemonic` is used to configure the mnemonic, based on the `phantom` derivation path, after importing `phantom`, it can be used directly, which is convenient for managing a large number of wallets
- `wallet.privateKey` is used to configure the private key, which is used to configure the private key of the wallet, which is convenient for managing a small number of wallets

After completing the `config.toml` configuration, you can refer to the scripts in `examples` for writing, such as: use `bun run examples/query-sol.ts`

