<div align="center">

  <h3 align="center">Solana 工具</h3>

  <p align="center">
    这个项目主要提供 Solana 常用的批量脚本，方便链上操作。
  </p>
</div>



<details>
  <summary>目录</summary>
  <ol>
    <li>
      <a href="#项目说明">项目说明</a>
    </li>
    <li>
      <a href="#开始">开始</a>
      <ul>
        <li><a href="#前置准备">前置准备</a></li>
        <li><a href="#依赖安装">依赖安装</a></li>
      </ul>
    </li>
    <li><a href="#使用说明">使用说明</a></li>
  </ol>
</details>



## 项目说明

这个项目提供了代币和 SOL 的批量操作脚本

| 功能 | 类型 | 备注 |
| -- | -- | -- |
| SOL 批量分发 | SOL | 批量创建钱包 |
| 批量查询 SOL 资产 | SOL | |
| SOL 归集 | SOL | |
| 创建 Token | Token | |
| Token 归集 | Token | 全转出时关闭账户 |
| 批量查询 Token 资产 | Token | |


## 开始

要使用该项目，需要有 `nodejs` 环境或 `bun` 环境，推荐使用 `bun`

### 前置准备

这里推荐使用 `bun` 作为运行时，使用 `npm` 安装 `bun` 即可
* [Bun](https://bun.sh)
  ```sh
  npm i bun -g
  ```

### 依赖安装

使用 `bun i` 安装依赖，当前依赖情况如下：

| 库 | 用途 | 备注 |
| -- | -- | -- |
| `@solana/web3.js` | 基础链上交互 | 官方 sdk |
| `@solana/spl-token` | token 相关 | 官方 sdk |
| `@coral-xyz/anchor` | 智能合约调用 | anchor 官方 sdk |
| `@metaplex-foundation/umi` | metadata 操作相关 | 创建、解析代币 metadata 信息 |
| `@metaplex-foundation/umi-bundle-defaults` | metadata 操作相关 | |
| `@metaplex-foundation/mpl-token-metadata` | metadata 操作相关 | |
| `bip39` | 助记词相关支持 | 生成助记词 |
| `bs58` | 编码 | |
| `micro-ed25519-hdkey` | HD 钱包派生 |  |



## 使用说明

这个项目使用 `config.toml` 来配置网络、助记词和私钥等参数。

- `network.rpc` 用于配置 rpc 节点，在执行脚本前应确保配置的 rpc 正常
- `wallet.mnemonic` 用于配置助记词，基于 `phantom` 派生路径，导入 `phantom` 后可直接使用，方便大批量钱包管理
- `wallet.keys` 用于配置多个私钥

在完成 `config.toml` 配置后，可参考 `examples` 中的脚本进行编写，如: 使用 `bun run examples/query-sol.ts`


