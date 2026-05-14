<script lang="ts">
  import {
    connect,
    createConfig,
    disconnect,
    getAccount,
    getConnectors,
    injected,
    reconnect,
    watchAccount
  } from '@wagmi/core';
  import { http } from 'viem';
  import { sepolia } from 'viem/chains';
  import { onMount } from 'svelte';
  import Quiz from '$lib/Quiz.svelte';

  const badgeSteps = [
    { label: 'Підключити wallet', desc: 'Підключи MetaMask або інший browser wallet' },
    { label: 'Пройти Web3 quiz', desc: 'Відповідай на 5 питань про основи Web3' },
    { label: 'Підписати proof', desc: 'Підпиши повідомлення — без транзакції і gas' },
    { label: 'Отримати badge', desc: 'Замінти непередаваний on-chain сертифікат' }
  ];

  const walletConfig = createConfig({
    chains: [sepolia],
    connectors: [injected()],
    transports: {
      [sepolia.id]: http()
    }
  });

  let walletStatus = 'disconnected';
  let address: string | undefined;
  let chainName: string | undefined;
  let chainId: number | undefined;
  let connectorName: string | undefined;
  let connectError = '';
  let hasInjectedWallet = false;
  let hasCheckedWallet = false;
  let isConnecting = false;
  let quizPassed = false;
  let proof: string | null = null;
  let isSigning = false;
  let signError = '';
  let isMinting = false;
  let mintError = '';
  let tokenId: number | null = null;
  let hasBadge = false;

  function loadQuizState() {
    quizPassed = localStorage.getItem('quizPassed') === '1';
    proof = localStorage.getItem('proof');
    const saved = localStorage.getItem('tokenId');
    if (saved) { tokenId = Number(saved); hasBadge = true; }
  }

  const CONTRACT_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

  async function checkBadge(addr: string) {
    const provider = getBrowserEthereumProvider();
    if (!provider) return;
    const result = await provider.request({
      method: 'eth_call',
      params: [{
        to: CONTRACT_ADDRESS,
        data: '0x5e50864f000000000000000000000000' + addr.slice(2).toLowerCase()
      }, 'latest']
    });
    hasBadge = result !== '0x' + '0'.repeat(64);
  }

  async function mintBadge() {
    mintError = '';
    isMinting = true;
    try {
      const res = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learner: address })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Не вдалося замінтити badge.');

      hasBadge = true;
      tokenId = data.tokenId;
      localStorage.setItem('tokenId', String(tokenId));
    } catch (error) {
      mintError = error instanceof Error ? error.message.split('\n')[0] : 'Не вдалося замінтити badge.';
    } finally {
      isMinting = false;
    }
  }

  async function signProof() {
    signError = '';
    isSigning = true;
    try {
      const provider = getBrowserEthereumProvider();
      if (!provider || !address) throw new Error('Гаманець не підключено.');

      const nonce = crypto.randomUUID();
      const message = `Я пройшов Web3 quiz.\nАдреса: ${address}\nNonce: ${nonce}`;

      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, address]
      });

      if (typeof signature !== 'string') throw new Error('Підпис не отримано.');

      proof = signature;
      localStorage.setItem('proof', signature);
    } catch (error) {
      signError = error instanceof Error ? error.message.split('\n')[0] : 'Не вдалося підписати.';
    } finally {
      isSigning = false;
    }
  }

  $: shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  $: isConnected = walletStatus === 'connected' && Boolean(address);
  $: currentStep = !isConnected ? 0 : !quizPassed ? 1 : !proof ? 2 : !hasBadge ? 3 : 4;
  $: connectButtonLabel = isConnecting
    ? 'Connecting...'
    : hasCheckedWallet && !hasInjectedWallet
      ? 'No wallet found'
      : 'Connect wallet';

  function reportConnectError(message: string, error?: unknown) {
    connectError = message;
    console.error('[ProofOfWeb3] Connect wallet failed:', {
      message,
      error,
      hasCheckedWallet,
      hasInjectedWallet,
      walletStatus
    });
  }

  function getBrowserEthereumProvider() {
    if (typeof window === 'undefined') return undefined;

    const provider = window.ethereum;
    return provider?.providers?.find((candidate) => Boolean(candidate?.isMetaMask)) ?? provider;
  }

  function syncWalletState() {
    const account = getAccount(walletConfig);

    walletStatus = account.status;
    address = account.address;
    chainName = account.chain?.name;
    chainId = account.chainId;
    connectorName = account.connector?.name;
  }

  async function detectInjectedWallet() {
    const connectors = getConnectors(walletConfig);
    const providers = await Promise.all(
      connectors.map((connector) => connector.getProvider().catch(() => undefined))
    );
    const browserProvider = getBrowserEthereumProvider();

    hasInjectedWallet = providers.some(Boolean) || Boolean(browserProvider?.request);
    hasCheckedWallet = true;

    console.info('[ProofOfWeb3] Wallet detection:', {
      hasInjectedWallet,
      wagmiProviders: providers.filter(Boolean).length,
      hasWindowEthereum: Boolean(window.ethereum),
      selectedProviderIsMetaMask: Boolean(browserProvider?.isMetaMask)
    });
  }

  async function syncDirectProviderState(accounts: unknown[], provider = getBrowserEthereumProvider()) {
    const [firstAccount] = accounts;
    if (!provider || typeof firstAccount !== 'string') {
      throw new Error('Wallet did not return an account.');
    }

    const requestedChainId = await provider.request({ method: 'eth_chainId' });
    const nextChainId =
      typeof requestedChainId === 'string' ? Number.parseInt(requestedChainId, 16) : undefined;

    walletStatus = 'connected';
    address = firstAccount;
    chainId = nextChainId;
    chainName = nextChainId === sepolia.id ? sepolia.name : nextChainId ? `Chain ${nextChainId}` : undefined;
    connectorName = provider.isMetaMask ? 'MetaMask' : 'Injected wallet';
  }

  async function connectWallet() {
    connectError = '';
    isConnecting = true;

    try {
      const browserProvider = getBrowserEthereumProvider();

      console.info('[ProofOfWeb3] Connect wallet click:', {
        hasWindowEthereum: Boolean(window.ethereum),
        selectedProviderIsMetaMask: Boolean(browserProvider?.isMetaMask),
        hasProviderRequest: Boolean(browserProvider?.request)
      });

      if (browserProvider?.request) {
        hasInjectedWallet = true;
        hasCheckedWallet = true;

        const accounts = await browserProvider.request({ method: 'eth_requestAccounts' });
        if (!Array.isArray(accounts) || accounts.length === 0) {
          throw new Error('MetaMask did not return any accounts.');
        }

        await syncDirectProviderState(accounts, browserProvider);
        void checkBadge(accounts[0] as string);
        console.info('[ProofOfWeb3] Wallet connected:', {
          address,
          chainId,
          connectorName
        });
        return;
      }

      await detectInjectedWallet();

      if (!hasInjectedWallet) {
        reportConnectError(
          'Не знайшов browser wallet. Встанови MetaMask, Rabby або інший injected wallet.'
        );
        return;
      }

      const [connector] = getConnectors(walletConfig);
      await connect(walletConfig, { connector });
      syncWalletState();
    } catch (error) {
      reportConnectError(
        error instanceof Error ? error.message.split('\n')[0] : 'Не вдалося підключити wallet.',
        error
      );
    } finally {
      isConnecting = false;
    }
  }

  async function disconnectWallet() {
    connectError = '';
    await disconnect(walletConfig);
    syncWalletState();
  }

  onMount(() => {
    loadQuizState();
    const unwatch = watchAccount(walletConfig, {
      onChange: syncWalletState
    });

    syncWalletState();
    void detectInjectedWallet();
    void reconnect(walletConfig).then(syncWalletState).catch(syncWalletState);

    return unwatch;
  });
</script>

<svelte:head>
  <title>Proof of Web3</title>
  <meta
    name="description"
    content="Навчальний Web3 dApp для mint непередаваного Proof of Learning badge."
  />
</svelte:head>

<main class="shell">
  <section class="hero" aria-labelledby="page-title">
    <div class="hero__copy">
      <p class="eyebrow">Proof of Learning Badge</p>
      <h1 id="page-title">Докажи, що знаєш Web3.</h1>
      <p class="lead">
        Пройди quiz, підпиши proof гаманцем і отримай непередаваний on-chain badge.
        Це твій верифікований сертифікат у блокчейні.
      </p>
    </div>

    <div class="badge-preview" aria-label="Попередній вигляд badge">
      <span class="badge-preview__chain">Sepolia ready</span>
      <strong>Proof of Web3</strong>
      <small>Soulbound learning badge</small>
    </div>
  </section>

  <section class="workspace" aria-label="Поточний flow">
    <div class="panel">
      <h2>Як це працює</h2>
      <ol class="steps">
        {#each badgeSteps as step, i}
          <li class="step" class:step--active={i === currentStep} class:step--done={i < currentStep || hasBadge}>
            <span class="step__label">{step.label}</span>
            <span class="step__desc">{step.desc}</span>
          </li>
        {/each}
      </ol>
    </div>

    <div class="panel panel--action">
      {#if isConnected && !quizPassed}
        <h2>Web3 Quiz</h2>
        <p class="panel--action__hint">Відповідай на питання, щоб отримати badge.</p>
        <Quiz onComplete={() => { quizPassed = true; localStorage.setItem('quizPassed', '1'); }} />
        <button type="button" class="button-secondary" onclick={disconnectWallet}>Disconnect wallet</button>
      {:else if isConnected && quizPassed && !proof}
        <h2>Підписати proof</h2>
        <p class="panel--action__hint">Підпиши повідомлення гаманцем, щоб довести що це ти пройшов quiz.</p>
        {#if signError}
          <p class="wallet-error" role="alert">{signError}</p>
        {/if}
        <button type="button" onclick={signProof} disabled={isSigning}>
          {isSigning ? 'Очікуй підтвердження...' : 'Підписати proof →'}
        </button>
        <button type="button" class="button-secondary" onclick={disconnectWallet}>Disconnect wallet</button>
      {:else if isConnected && quizPassed && proof}
        {#if hasBadge}
          <h2>Badge отримано ✓</h2>
          <p class="panel--action__hint">Твій soulbound badge живе в блокчейні. Його не можна передати, продати або підробити.</p>
          <div class="badge-minted">
            <span>🏅</span>
            <strong>Proof of Web3</strong>
            <small>Web3 Foundations</small>
            <code>{shortAddress}</code>
          </div>
          <button type="button" class="button-secondary" onclick={disconnectWallet}>Disconnect wallet</button>
        {:else}
          <h2>Proof підписано ✓</h2>
          <p class="panel--action__hint">Підпис отримано. Тепер можна мінтити badge.</p>
          <div class="proof-preview">{proof.slice(0, 20)}...{proof.slice(-10)}</div>
          {#if mintError}
            <p class="wallet-error" role="alert">{mintError}</p>
          {/if}
          <button type="button" onclick={mintBadge} disabled={isMinting}>
            {isMinting ? 'Очікуй підтвердження...' : 'Замінтити badge →'}
          </button>
          <button type="button" class="button-secondary" onclick={disconnectWallet}>Disconnect wallet</button>
        {/if}
      {:else}
        <h2>Підключи гаманець</h2>
        <p class="panel--action__hint">Підключи browser wallet, щоб розпочати.</p>
        {#if connectError}
          <p class="wallet-error" role="alert">{connectError}</p>
        {/if}
        <button type="button" onclick={connectWallet} disabled={isConnecting}>
          {connectButtonLabel}
        </button>
      {/if}
    </div>
  </section>
</main>
