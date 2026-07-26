import type { Chain } from "viem";
import { arbitrumSepolia, avalancheFuji, baseSepolia, optimismSepolia, polygonAmoy, sepolia } from "viem/chains";

/**
 * Cross-Chain Transfer Protocol (CCTP) configuration.
 *
 * This module is intentionally isolated from the recurring-payment escrow logic.
 * It powers a separate "bridge USDC out of Arc Network" feature and does not
 * affect createSchedule / executePayment / pauseSchedule / etc.
 *
 * Arc Network is always the CCTP source chain. The user selects which chain
 * to receive (mint) USDC on.
 *
 * Reference: https://developers.circle.com/cctp/references/contract-addresses
 * Reference: https://developers.circle.com/cctp/concepts/supported-chains-and-domains
 */

export type CctpDestinationChainKey =
  | "ethereumSepolia"
  | "avalancheFuji"
  | "optimismSepolia"
  | "arbitrumSepolia"
  | "baseSepolia"
  | "polygonAmoy";

export type CctpDestinationChainConfig = {
  key: CctpDestinationChainKey;
  label: string;
  chain: Chain;
  /** Circle-issued CCTP domain identifier for this chain (not the EVM chain id). */
  domain: number;
  usdcAddress: `0x${string}`;
  messageTransmitterAddress: `0x${string}`;
};

// CCTP V2 contracts are deployed at the same address on every supported EVM testnet.
const TESTNET_TOKEN_MESSENGER: `0x${string}` = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";
const TESTNET_MESSAGE_TRANSMITTER: `0x${string}` = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275";

// Arc is the fixed bridge source for PayRoutine. Domain 26 is Circle's official Arc domain.
export const ARC_CCTP_DOMAIN = Number(process.env.NEXT_PUBLIC_ARC_CCTP_DOMAIN ?? "26");

// TokenMessengerV2 on Arc, used to burn USDC when bridging out. Override via env
// if your Arc deployment differs.
export const ARC_TOKEN_MESSENGER_ADDRESS =
  (process.env.NEXT_PUBLIC_ARC_TOKEN_MESSENGER_ADDRESS as `0x${string}` | undefined) ?? TESTNET_TOKEN_MESSENGER;

// Official Arc Testnet USDC token address.
export const ARC_USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS as `0x${string}` | undefined) ??
  "0x3600000000000000000000000000000000000000";

// Circle attestation service base URL. Sandbox for testnet, production for mainnet.
export const CCTP_ATTESTATION_API_BASE =
  process.env.NEXT_PUBLIC_CCTP_ATTESTATION_API_BASE ?? "https://iris-api-sandbox.circle.com";

export const CCTP_DESTINATION_CHAINS: CctpDestinationChainConfig[] = [
  {
    key: "ethereumSepolia",
    label: "Ethereum Sepolia",
    chain: sepolia,
    domain: 0,
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    messageTransmitterAddress: TESTNET_MESSAGE_TRANSMITTER,
  },
  {
    key: "avalancheFuji",
    label: "Avalanche Fuji",
    chain: avalancheFuji,
    domain: 1,
    usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65",
    messageTransmitterAddress: TESTNET_MESSAGE_TRANSMITTER,
  },
  {
    key: "optimismSepolia",
    label: "OP Sepolia",
    chain: optimismSepolia,
    domain: 2,
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    messageTransmitterAddress: TESTNET_MESSAGE_TRANSMITTER,
  },
  {
    key: "arbitrumSepolia",
    label: "Arbitrum Sepolia",
    chain: arbitrumSepolia,
    domain: 3,
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    messageTransmitterAddress: TESTNET_MESSAGE_TRANSMITTER,
  },
  {
    key: "baseSepolia",
    label: "Base Sepolia",
    chain: baseSepolia,
    domain: 6,
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    messageTransmitterAddress: TESTNET_MESSAGE_TRANSMITTER,
  },
  {
    key: "polygonAmoy",
    label: "Polygon PoS Amoy",
    chain: polygonAmoy,
    domain: 7,
    usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    messageTransmitterAddress: TESTNET_MESSAGE_TRANSMITTER,
  },
];

export const cctpTokenMessengerAbi = [
  {
    type: "function",
    name: "depositForBurn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
  },
] as const;

export const cctpMessageTransmitterAbi = [
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const cctpErc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type CctpAttestationMessage = {
  message: string;
  attestation: string;
  status: string;
};

/**
 * Polls Circle's attestation API until the burn message is attested, or the
 * abort signal fires. Standard Transfer attestations can take several minutes
 * depending on source-chain finality.
 */
export async function pollCctpAttestation(
  sourceDomain: number,
  transactionHash: string,
  signal?: AbortSignal,
): Promise<CctpAttestationMessage> {
  const url = `${CCTP_ATTESTATION_API_BASE}/v2/messages/${sourceDomain}?transactionHash=${transactionHash}`;

  while (true) {
    if (signal?.aborted) {
      throw new Error("Bridge cancelled");
    }

    const response = await fetch(url, { signal });

    if (response.ok) {
      const data = (await response.json()) as { messages?: CctpAttestationMessage[] };
      const first = data.messages?.[0];
      if (first?.status === "complete" && first.message && first.attestation) {
        return first;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
