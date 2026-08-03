import { createPublicClient, createWalletClient, formatEther, http, pad } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  arbitrumSepolia,
  avalancheFuji,
  baseSepolia,
  optimismSepolia,
  polygonAmoy,
  sepolia,
  type Chain,
} from "viem/chains";
import { executorAddress, publicClient, walletClient } from "./chain";
import { config } from "./config";

// Conservative combined gas budget for the Arc-side approve + depositForBurn calls.
const ARC_BRIDGE_GAS_ESTIMATE = 250_000n;
const GAS_BUFFER_NUMERATOR = 12n;
const GAS_BUFFER_DENOMINATOR = 10n;
const MAX_REASONABLE_CCTP_MINT_GAS = 10_000_000n;

const cctpErc20Abi = [
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
] as const;

const cctpTokenMessengerAbi = [
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

const cctpMessageTransmitterAbi = [
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

const chainById = new Map<number, Chain>([
  [sepolia.id, sepolia],
  [avalancheFuji.id, avalancheFuji],
  [optimismSepolia.id, optimismSepolia],
  [arbitrumSepolia.id, arbitrumSepolia],
  [baseSepolia.id, baseSepolia],
  [polygonAmoy.id, polygonAmoy],
]);

function getDestinationRpcUrl(chainId: number, chain: Chain): string {
  if (chainId === sepolia.id && config.ETHEREUM_SEPOLIA_RPC_URL) return config.ETHEREUM_SEPOLIA_RPC_URL;
  if (chainId === avalancheFuji.id && config.AVALANCHE_FUJI_RPC_URL) return config.AVALANCHE_FUJI_RPC_URL;
  if (chainId === optimismSepolia.id && config.OPTIMISM_SEPOLIA_RPC_URL) return config.OPTIMISM_SEPOLIA_RPC_URL;
  if (chainId === arbitrumSepolia.id && config.ARBITRUM_SEPOLIA_RPC_URL) return config.ARBITRUM_SEPOLIA_RPC_URL;
  if (chainId === baseSepolia.id && config.BASE_SEPOLIA_RPC_URL) return config.BASE_SEPOLIA_RPC_URL;
  if (chainId === polygonAmoy.id && config.POLYGON_AMOY_RPC_URL) return config.POLYGON_AMOY_RPC_URL;

  const envVarName =
    chainId === sepolia.id
      ? "ETHEREUM_SEPOLIA_RPC_URL"
      : chainId === avalancheFuji.id
        ? "AVALANCHE_FUJI_RPC_URL"
        : chainId === optimismSepolia.id
          ? "OPTIMISM_SEPOLIA_RPC_URL"
          : chainId === arbitrumSepolia.id
            ? "ARBITRUM_SEPOLIA_RPC_URL"
            : chainId === baseSepolia.id
              ? "BASE_SEPOLIA_RPC_URL"
              : chainId === polygonAmoy.id
                ? "POLYGON_AMOY_RPC_URL"
                : null;

  if (envVarName) {
    throw new Error(
      `Missing ${envVarName} for destination chain ${chain.name} (${chainId}). ` +
        "Public fallback RPCs are disabled for CCTP minting because they are often rate-limited or blocked from VPS IPs.",
    );
  }

  throw new Error(`No RPC URL configured for destination chain id ${chainId}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

type AttestedMessage = {
  message: string;
  attestation: string;
  status: string;
};

async function pollAttestation(sourceDomain: number, burnTxHash: string): Promise<AttestedMessage> {
  const url = `${config.CCTP_ATTESTATION_API_BASE}/v2/messages/${sourceDomain}?transactionHash=${burnTxHash}`;

  for (let attempt = 0; attempt < config.CCTP_ATTESTATION_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetchWithTimeout(url, config.CCTP_HTTP_TIMEOUT_MS);
    } catch {
      await sleep(config.CCTP_ATTESTATION_POLL_MS);
      continue;
    }

    if (response.status === 429) {
      await sleep(config.CCTP_ATTESTATION_POLL_MS * 2);
      continue;
    }

    if (response.ok) {
      const payload = (await response.json()) as { messages?: AttestedMessage[] };
      const first = payload.messages?.[0];
      if (first?.status === "complete" && first.message && first.attestation) {
        return first;
      }
    }

    await sleep(config.CCTP_ATTESTATION_POLL_MS);
  }

  throw new Error(
    `Timed out waiting for CCTP attestation for burn tx ${burnTxHash} after ${config.CCTP_ATTESTATION_MAX_ATTEMPTS} attempts`,
  );
}

export async function bridgeDuePaymentFromArc(input: {
  amount: bigint;
  destinationChainId: number;
  destinationDomain: number;
  destinationRecipient: `0x${string}`;
  destinationUsdcAddress: `0x${string}`;
  messageTransmitterAddress: `0x${string}`;
  // Set when resuming a bridge whose burn already landed on Arc in a prior attempt.
  existingBurnTxHash?: `0x${string}`;
  // Invoked right after the burn confirms so the caller can persist it before attestation/mint.
  onBurnConfirmed?: (burnTxHash: `0x${string}`) => Promise<void>;
}): Promise<{ burnTxHash: `0x${string}`; mintTxHash: `0x${string}` }> {
  if (input.amount <= BigInt(0)) {
    throw new Error("Bridge amount must be greater than zero");
  }

  let burnTxHash = input.existingBurnTxHash;

  if (!burnTxHash) {
    const arcBalance = await publicClient.getBalance({ address: executorAddress });
    const arcGasPrice = await publicClient.getGasPrice();
    const estimatedArcGasCost = ARC_BRIDGE_GAS_ESTIMATE * arcGasPrice;

    if (arcBalance < estimatedArcGasCost) {
      throw new Error(
        [
          "Insufficient Arc-chain gas balance for CCTP approve/depositForBurn.",
          `Executor wallet: ${executorAddress}`,
          `Current balance: ${formatEther(arcBalance)} ARC`,
          `Estimated required: ${formatEther(estimatedArcGasCost)} ARC`,
        ].join(" "),
      );
    }

    const approveHash = await walletClient.writeContract({
      abi: cctpErc20Abi,
      address: config.ARC_USDC_ADDRESS as `0x${string}`,
      functionName: "approve",
      args: [config.ARC_TOKEN_MESSENGER_ADDRESS as `0x${string}`, input.amount],
    });

    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    if (approveReceipt.status !== "success") {
      throw new Error("CCTP approve transaction failed on Arc");
    }

    const mintRecipient = pad(input.destinationRecipient, { size: 32 });
    const destinationCaller = pad("0x", { size: 32 });

    burnTxHash = await walletClient.writeContract({
      abi: cctpTokenMessengerAbi,
      address: config.ARC_TOKEN_MESSENGER_ADDRESS as `0x${string}`,
      functionName: "depositForBurn",
      args: [
        input.amount,
        input.destinationDomain,
        mintRecipient,
        config.ARC_USDC_ADDRESS as `0x${string}`,
        destinationCaller,
        BigInt(0),
        config.CCTP_MIN_FINALITY_THRESHOLD,
      ],
    });

    const burnReceipt = await publicClient.waitForTransactionReceipt({ hash: burnTxHash });
    if (burnReceipt.status !== "success") {
      throw new Error("CCTP burn transaction failed on Arc");
    }

    if (input.onBurnConfirmed) {
      await input.onBurnConfirmed(burnTxHash);
    }
  }

  const attestedMessage = await pollAttestation(config.ARC_CCTP_DOMAIN, burnTxHash);

  const destinationChain = chainById.get(input.destinationChainId);
  if (!destinationChain) {
    throw new Error(`Unsupported destination chain id ${input.destinationChainId}`);
  }

  const destinationRpcUrl = getDestinationRpcUrl(input.destinationChainId, destinationChain);
  const account = privateKeyToAccount(config.PRIVATE_KEY as `0x${string}`);

  const destinationWalletClient = createWalletClient({
    account,
    chain: destinationChain,
    transport: http(destinationRpcUrl),
  });

  const destinationPublicClient = createPublicClient({
    chain: destinationChain,
    transport: http(destinationRpcUrl),
  });

  const destinationBalance = await destinationPublicClient.getBalance({
    address: account.address,
  });

  const estimatedGas = await destinationPublicClient.estimateContractGas({
    account: account.address,
    abi: cctpMessageTransmitterAbi,
    address: input.messageTransmitterAddress,
    functionName: "receiveMessage",
    args: [attestedMessage.message as `0x${string}`, attestedMessage.attestation as `0x${string}`],
  });

  const bufferedGas = (estimatedGas * GAS_BUFFER_NUMERATOR) / GAS_BUFFER_DENOMINATOR;
  if (bufferedGas > MAX_REASONABLE_CCTP_MINT_GAS) {
    throw new Error(
      [
        `Destination-chain gas estimate for CCTP mint is unreasonably high on ${destinationChain.name}.`,
        `Estimated gas: ${bufferedGas.toString()}`,
        "This usually means the RPC returned a malformed estimate or the message is not valid for receiveMessage.",
      ].join(" "),
    );
  }

  const gasPrice = await destinationPublicClient.getGasPrice();
  const estimatedNativeCost = bufferedGas * gasPrice;

  if (destinationBalance < estimatedNativeCost) {
    throw new Error(
      [
        `Insufficient destination-chain gas balance for CCTP mint on ${destinationChain.name}.`,
        `Executor wallet: ${account.address}`,
        `Current balance: ${formatEther(destinationBalance)} ${destinationChain.nativeCurrency.symbol}`,
        `Estimated required: ${formatEther(estimatedNativeCost)} ${destinationChain.nativeCurrency.symbol}`,
      ].join(" "),
    );
  }

  const mintTxHash = await destinationWalletClient.writeContract({
    abi: cctpMessageTransmitterAbi,
    address: input.messageTransmitterAddress,
    functionName: "receiveMessage",
    args: [attestedMessage.message as `0x${string}`, attestedMessage.attestation as `0x${string}`],
    gas: bufferedGas,
    gasPrice,
  });

  const mintReceipt = await destinationPublicClient.waitForTransactionReceipt({ hash: mintTxHash });
  if (mintReceipt.status !== "success") {
    throw new Error(`CCTP mint transaction failed on destination chain id ${input.destinationChainId}`);
  }

  return { burnTxHash, mintTxHash };
}
