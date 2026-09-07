import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { config } from "dotenv";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function compileContract(): { abi: Abi; bytecode: `0x${string}` } {
  const source = readFileSync(resolve(root, "contracts/VerificationRegistry.sol"), "utf-8");
  const input = {
    language: "Solidity",
    sources: { "VerificationRegistry.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors?.some((e: { severity: string }) => e.severity === "error")) {
    console.error(output.errors);
    throw new Error("Solidity compilation failed");
  }

  const contract = output.contracts["VerificationRegistry.sol"]["VerificationRegistry"];
  return {
    abi: contract.abi as Abi,
    bytecode: `0x${contract.evm.bytecode.object}` as `0x${string}`,
  };
}

async function main(): Promise<void> {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  const rpcUrl = process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

  if (!privateKey) {
    throw new Error("PRIVATE_KEY required in .env");
  }

  console.log("Compiling VerificationRegistry.sol…");
  const { abi, bytecode } = compileContract();

  const artifactsDir = resolve(root, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(resolve(artifactsDir, "VerificationRegistry.json"), JSON.stringify({ abi, bytecode }, null, 2));

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  const chainId = await publicClient.getChainId();
  console.log(`Deploying from ${account.address}…`);
  console.log(`RPC chainId: ${chainId} (expect 11155111 Ethereum Sepolia)`);
  console.log(`Balance: ${balance} wei`);
  if (chainId !== 11155111) {
    throw new Error(`Wrong chain: RPC returned ${chainId}, need Ethereum Sepolia 11155111`);
  }
  if (balance === 0n) {
    throw new Error(
      "Wallet has 0 ETH on Ethereum Sepolia. Get test ETH from a Sepolia faucet, then retry."
    );
  }

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    account,
    chain: sepolia,
  });

  console.log(`Transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });

  if (!receipt.contractAddress) {
    throw new Error("Deployment failed — no contract address in receipt");
  }

  console.log(`\n✓ Deployed VerificationRegistry to Ethereum Sepolia`);
  console.log(`  Address: ${receipt.contractAddress}`);
  console.log(`  Block:   ${receipt.blockNumber}`);
  console.log(`  Explorer: https://sepolia.etherscan.io/address/${receipt.contractAddress}`);
  console.log(`\nAdd to .env:\n  CONTRACT_ADDRESS=${receipt.contractAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
