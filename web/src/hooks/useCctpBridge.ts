"use client";

import { useCallback, useState } from "react";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { createPublicClient, http, pad } from "viem";
import { arcChain } from "@/lib/chain";
import {
  ARC_CCTP_DOMAIN,
  ARC_TOKEN_MESSENGER_ADDRESS,
  ARC_USDC_ADDRESS,
  cctpErc20Abi,
  cctpMessageTransmitterAbi,
  cctpTokenMessengerAbi,
  pollCctpAttestation,
  type CctpDestinationChainConfig,
} from "@/lib/cctp";

export type CctpBridgeStep =
  | "idle"
  | "switching-to-arc"
  | "approving"
  | "burning"
  | "waiting-attestation"
  | "switching-to-destination"
  | "minting"
  | "completed"
  | "error";

const EMPTY_DESTINATION_CALLER = pad("0x", { size: 32 });

/**
 * Standalone CCTP bridge hook. Arc Network is always the source chain; the
 * caller selects the destination chain. This is intentionally separate from
 * useRecurringContract and does not modify any recurring-payment behavior.
 */
export function useCctpBridge() {
  const { address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<CctpBridgeStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [burnTxHash, setBurnTxHash] = useState<`0x${string}` | null>(null);
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | null>(null);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setBurnTxHash(null);
    setMintTxHash(null);
  }, []);

  const bridge = useCallback(
    async (destinationChain: CctpDestinationChainConfig, amount: bigint, recipient: `0x${string}`) => {
      setError(null);
      setBurnTxHash(null);
      setMintTxHash(null);

      if (!address) {
        setError("Connect a wallet first.");
        setStep("error");
        return;
      }

      if (amount <= BigInt(0)) {
        setError("Amount must be greater than zero.");
        setStep("error");
        return;
      }

      const arcPublicClient = createPublicClient({ chain: arcChain, transport: http() });
      const destinationPublicClient = createPublicClient({ chain: destinationChain.chain, transport: http() });

      try {
        setStep("switching-to-arc");
        await switchChainAsync({ chainId: arcChain.id });

        setStep("approving");
        const approveHash = await writeContractAsync({
          chainId: arcChain.id,
          abi: cctpErc20Abi,
          address: ARC_USDC_ADDRESS,
          functionName: "approve",
          args: [ARC_TOKEN_MESSENGER_ADDRESS, amount],
        });
        const approveReceipt = await arcPublicClient.waitForTransactionReceipt({ hash: approveHash });
        if (approveReceipt.status !== "success") {
          throw new Error("Approve transaction failed on Arc Network.");
        }

        setStep("burning");
        const mintRecipientBytes32 = pad(recipient, { size: 32 });

        const burnHash = await writeContractAsync({
          chainId: arcChain.id,
          abi: cctpTokenMessengerAbi,
          address: ARC_TOKEN_MESSENGER_ADDRESS,
          functionName: "depositForBurn",
          args: [
            amount,
            destinationChain.domain,
            mintRecipientBytes32,
            ARC_USDC_ADDRESS,
            EMPTY_DESTINATION_CALLER,
            BigInt(0), // maxFee: Standard Transfer has no protocol fee.
            2000, // minFinalityThreshold >= 2000 selects Standard Transfer.
          ],
        });
        const burnReceipt = await arcPublicClient.waitForTransactionReceipt({ hash: burnHash });
        if (burnReceipt.status !== "success") {
          throw new Error("Burn transaction failed on Arc Network.");
        }
        setBurnTxHash(burnHash);

        setStep("waiting-attestation");
        const attestation = await pollCctpAttestation(ARC_CCTP_DOMAIN, burnHash);

        setStep("switching-to-destination");
        await switchChainAsync({ chainId: destinationChain.chain.id });

        setStep("minting");
        const mintHash = await writeContractAsync({
          chainId: destinationChain.chain.id,
          abi: cctpMessageTransmitterAbi,
          address: destinationChain.messageTransmitterAddress,
          functionName: "receiveMessage",
          args: [attestation.message as `0x${string}`, attestation.attestation as `0x${string}`],
        });
        const mintReceipt = await destinationPublicClient.waitForTransactionReceipt({ hash: mintHash });
        if (mintReceipt.status !== "success") {
          throw new Error(`Mint transaction failed on ${destinationChain.label}.`);
        }
        setMintTxHash(mintHash);

        setStep("completed");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bridge failed");
        setStep("error");
      }
    },
    [address, switchChainAsync, writeContractAsync],
  );

  return { bridge, reset, step, error, burnTxHash, mintTxHash };
}
