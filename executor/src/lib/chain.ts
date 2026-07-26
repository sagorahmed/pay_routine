import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config";

const chain = defineChain({
  id: config.CHAIN_ID,
  name: "Arc Network",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [config.RPC_URL],
    },
  },
});

const recurringAbi = [
  {
    type: "function",
    name: "nextScheduleId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "executePayment",
    stateMutability: "nonpayable",
    inputs: [{ name: "scheduleId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getSchedule",
    stateMutability: "view",
    inputs: [{ name: "scheduleId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "recipient", type: "address" },
          { name: "token", type: "address" },
          { name: "amountPerPayment", type: "uint128" },
          { name: "totalPayments", type: "uint32" },
          { name: "remainingPayments", type: "uint32" },
          { name: "nextExecution", type: "uint64" },
          { name: "intervalSeconds", type: "uint64" },
          { name: "depositedAmount", type: "uint128" },
          { name: "active", type: "bool" },
          { name: "paused", type: "bool" },
          { name: "cancelled", type: "bool" },
          { name: "executorReward", type: "uint96" },
        ],
      },
    ],
  },
] as const;

const account = privateKeyToAccount(config.PRIVATE_KEY as `0x${string}`);

export const publicClient = createPublicClient({
  chain,
  transport: http(config.RPC_URL),
});

export const walletClient = createWalletClient({
  account,
  chain,
  transport: http(config.RPC_URL),
});

export const contract = {
  abi: recurringAbi,
  address: config.CONTRACT_ADDRESS as `0x${string}`,
};

export const executorAddress = account.address;
