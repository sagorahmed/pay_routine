"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { useMemo, useState } from "react";
import { WagmiProvider } from "wagmi";
import type { Chain } from "viem";
import { arcChain } from "@/lib/chain";
import { CCTP_DESTINATION_CHAINS } from "@/lib/cctp";
import "@rainbow-me/rainbowkit/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const wagmiConfig = useMemo(
    () =>
      getDefaultConfig({
        appName: "PayRoutine",
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "walletconnect-project-id",
        // Arc Network is always the CCTP source chain; destination chains are
        // included so the wallet can switch networks to mint on them.
        chains: [arcChain, ...CCTP_DESTINATION_CHAINS.map((destinationChain) => destinationChain.chain)] as [
          Chain,
          ...Chain[],
        ],
        ssr: true,
      }),
    [],
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
          theme={darkTheme({
            accentColor: "#06b6d4",
            accentColorForeground: "#03131f",
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
