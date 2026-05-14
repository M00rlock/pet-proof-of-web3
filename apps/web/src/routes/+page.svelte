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
    'Підключити wallet',
    'Пройти Web3 quiz',
    'Підписати proof',
    'Замінтити soulbound badge'
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

  function loadQuizState() {
    quizPassed = localStorage.getItem('quizPassed') === '1';
    proof = localStorage.getItem('proof');
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
  $: walletSummary = isConnected
    ? 'Wallet підключено. Тепер можна додавати перевірку badge і mint action.'
    : hasCheckedWallet && !hasInjectedWallet
      ? 'У цьому браузері немає injected wallet, тому connect prompt не може відкритися.'
    : 'Підключи browser wallet, щоб продовжити локальний Web3 flow.';
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
      <h1 id="page-title">Навчальний Web3 badge, який не продається.</h1>
      <p class="lead">
        Перший прототип навчить нас wallet connect, підписам, Solidity mint-flow і
        непередаваним on-chain credentials.
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
      <h2>V1 flow</h2>
      <ol class="steps">
        {#each badgeSteps as step}
          <li>{step}</li>
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
        <h2>Proof підписано ✓</h2>
        <p class="panel--action__hint">Підпис отримано. Тепер можна мінтити badge.</p>
        <div class="proof-preview">{proof.slice(0, 20)}...{proof.slice(-10)}</div>
        <button type="button" disabled>Замінтити badge (незабаром)</button>
        <button type="button" class="button-secondary" onclick={disconnectWallet}>Disconnect wallet</button>
      {:else}
        <h2>Wallet state</h2>
        <p>{walletSummary}</p>
        <dl class="wallet-details" aria-label="Wallet details">
          <div><dt>Status</dt><dd>{walletStatus}</dd></div>
          <div><dt>Account</dt><dd>{shortAddress || 'Not connected'}</dd></div>
          <div><dt>Network</dt><dd>{chainName ? `${chainName} (${chainId})` : 'Unknown'}</dd></div>
          <div><dt>Connector</dt><dd>{connectorName || 'Injected wallet'}</dd></div>
        </dl>
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
