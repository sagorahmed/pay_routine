"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { recurringPaymentAbi, recurringPaymentAddress } from "@/lib/contract";

export function useRecurringContract() {
  const { address } = useAccount();
  const write = useWriteContract();

  const scheduleIds = useReadContract({
    abi: recurringPaymentAbi,
    address: recurringPaymentAddress,
    functionName: "getSchedulesByUser",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && recurringPaymentAddress),
    },
  });

  return {
    ...write,
    scheduleIds,
    schedules: [],
  };
}
