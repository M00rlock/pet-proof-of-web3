import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import type { RequestHandler } from './$types';

const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const CONTRACT_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

const abi = parseAbi([
  'function mintBadge(address learner) returns (uint256)',
  'function hasBadge(address learner) view returns (bool)'
]);

const account = privateKeyToAccount(DEPLOYER_KEY);

const publicClient = createPublicClient({
  chain: hardhat,
  transport: http('http://127.0.0.1:8545')
});

const walletClient = createWalletClient({
  account,
  chain: hardhat,
  transport: http('http://127.0.0.1:8545')
});

export const POST: RequestHandler = async ({ request }) => {
  const { learner } = await request.json();

  if (!learner || !/^0x[0-9a-fA-F]{40}$/.test(learner)) {
    return new Response(JSON.stringify({ error: 'Invalid address' }), { status: 400 });
  }

  const already = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'hasBadge',
    args: [learner]
  });

  if (already) {
    return new Response(JSON.stringify({ error: 'Badge already minted' }), { status: 409 });
  }

  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'mintBadge',
    args: [learner]
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return new Response(JSON.stringify({ hash, tokenId: Number(receipt.logs[0]?.topics[2] ?? 1) }), {
    status: 200
  });
};
