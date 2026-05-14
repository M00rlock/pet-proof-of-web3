import { ethers } from 'hardhat';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();

  const Badge = await ethers.getContractFactory('ProofOfLearningBadge');
  const badge = await Badge.deploy(deployer.address, deployer.address);
  await badge.waitForDeployment();

  const address = await badge.getAddress();
  console.log(`ProofOfLearningBadge deployed to ${address}`);
  console.log(`Owner and issuer: ${deployer.address}`);

  const outDir = join(__dirname, '../../apps/web/src/lib/contract');
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    join(outDir, 'deployment.json'),
    JSON.stringify({ address, deployer: deployer.address }, null, 2)
  );

  const artifact = await ethers.getContractFactory('ProofOfLearningBadge');
  writeFileSync(
    join(outDir, 'abi.json'),
    JSON.stringify(artifact.interface.fragments, null, 2)
  );

  console.log(`Deployment info saved to apps/web/src/lib/contract/`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
