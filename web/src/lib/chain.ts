import { defineChain } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? "11155111");

export const arcChain = defineChain({
  id: chainId,
  name: process.env.NEXT_PUBLIC_ARC_CHAIN_NAME ?? "Arc Network",
  nativeCurrency: {
    name: process.env.NEXT_PUBLIC_ARC_NATIVE_NAME ?? "Arc",
    symbol: process.env.NEXT_PUBLIC_ARC_NATIVE_SYMBOL ?? "ARC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.arc.example"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://explorer.arc.example",
    },
  },
});
