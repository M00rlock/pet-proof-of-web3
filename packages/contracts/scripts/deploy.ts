import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();

  const Badge = await ethers.getContractFactory('ProofOfLearningBadge');
  const badge = await Badge.deploy(deployer.address, deployer.address);
  await badge.waitForDeployment();

  console.log(`ProofOfLearningBadge deployed to ${await badge.getAddress()}`);
  console.log(`Owner and issuer: ${deployer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

