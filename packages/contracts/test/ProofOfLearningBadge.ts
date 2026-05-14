import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('ProofOfLearningBadge', function () {
  async function deployBadge() {
    const [owner, issuer, learner, other] = await ethers.getSigners();

    const Badge = await ethers.getContractFactory('ProofOfLearningBadge');
    const badge = await Badge.deploy(owner.address, issuer.address);
    await badge.waitForDeployment();

    return { badge, owner, issuer, learner, other };
  }

  it('allows the issuer to mint one badge for a learner', async function () {
    const { badge, issuer, learner } = await deployBadge();

    await expect(badge.connect(issuer).mintBadge(learner.address))
      .to.emit(badge, 'BadgeMinted')
      .withArgs(learner.address, 1, 'web3-foundations');

    expect(await badge.hasBadge(learner.address)).to.equal(true);
    expect(await badge.ownerOf(1)).to.equal(learner.address);
  });

  it('prevents duplicate badges for one learner', async function () {
    const { badge, issuer, learner } = await deployBadge();

    await badge.connect(issuer).mintBadge(learner.address);

    await expect(badge.connect(issuer).mintBadge(learner.address))
      .to.be.revertedWithCustomError(badge, 'BadgeAlreadyMinted')
      .withArgs(learner.address);
  });

  it('prevents token transfers after minting', async function () {
    const { badge, issuer, learner, other } = await deployBadge();

    await badge.connect(issuer).mintBadge(learner.address);

    await expect(
      badge.connect(learner).transferFrom(learner.address, other.address, 1)
    ).to.be.revertedWithCustomError(badge, 'SoulboundToken');
  });
});

