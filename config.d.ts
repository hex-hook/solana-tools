declare module '@/config.toml' {
    type Config = {
        wallet: {
            mnemonic: string
            count: number
            keys: string[]
        }
        network: {
            rpc: string[]
            sleep: number
        }
    }

    const config: Config
    export default config
}