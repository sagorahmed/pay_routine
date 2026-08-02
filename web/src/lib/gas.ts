import type { Account, Address, PublicClient } from "viem";

const GAS_BUFFER_NUMERATOR = 12n;
const GAS_BUFFER_DENOMINATOR = 10n;

type EstimateGasParams<TAbi extends readonly unknown[], TFunctionName extends string> = {
  client: PublicClient;
  account?: Account | Address;
  abi: TAbi;
  address: Address;
  functionName: TFunctionName;
  args?: readonly unknown[];
};

export async function estimateBufferedContractGas<TAbi extends readonly unknown[], TFunctionName extends string>({
  client,
  account,
  abi,
  address,
  functionName,
  args,
}: EstimateGasParams<TAbi, TFunctionName>) {
  const estimatedGas = await client.estimateContractGas({
    account,
    abi: abi as any,
    address,
    functionName: functionName as any,
    args: args as any,
  } as any);

  return (estimatedGas * GAS_BUFFER_NUMERATOR) / GAS_BUFFER_DENOMINATOR;
}