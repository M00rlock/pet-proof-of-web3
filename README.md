# Proof of Web3

Proof of Web3 — це навчальний Web3-проєкт: невеликий dApp, де користувач підключає гаманець, доводить, що пройшов навчальний Web3-челендж, і мінтить собі непередаваний on-chain badge.

Мета не в тому, щоб запустити спекулятивний токен-продукт. Мета — зрозуміти стек через побудову чогось реального, достатньо вузького за обсягом і безпечного для поступових ітерацій.

## R&D напрям

### Продуктова концепція

Перша версія — це "Proof of Learning Badge":

1. Користувач відкриває застосунок і підключає гаманець.
2. Застосунок показує короткий Web3-челендж або quiz.
3. Користувач підписує повідомлення, щоб підтвердити володіння гаманцем.
4. Після прийняття proof для цього гаманця можна замінтити badge.
5. Badge видно в застосунку, а контракт також публікує відповідні events.

Badge має поводитись як сертифікат, а не як колекційний актив для торгівлі. Тому v1 має дослідити непередаваний NFT-подібний токен, який часто називають soulbound token.

### Навчальні цілі

- Підключення гаманця та стан акаунта.
- Підпис повідомлень і перевірка підпису.
- Структура Solidity-контракту.
- Дозволи на mint і базовий access control.
- NFT metadata та event logs.
- Локальна blockchain-розробка.
- Шлях до деплою в testnet.
- Типові Web3 security pitfalls.

### Запропонований tech stack

- Smart contracts: Solidity.
- Інструменти для контрактів: Hardhat.
- Frontend: SvelteKit.
- Wallet/client libraries: `@wagmi/core` + viem.
- Styling: SCSS з невеликим набором design tokens і component-level styles.
- Локальна мережа: Hardhat Network.
- Testnet target: Sepolia.

### Архітектурні варіанти

#### Варіант A: повністю on-chain результат quiz

Контракт зберігає питання, відповіді та логіку перевірки.

Плюси:
- Дуже прозоро.
- Добре для вивчення on-chain state.

Мінуси:
- Дорого й незручно.
- Відповіді легко переглянути.
- Це не той підхід, який зазвичай використовують практичні застосунки.

Вердикт: корисно як навчальний контраст, але не ідеально для v1.

#### Варіант B: застосунок перевіряє quiz, контракт мінтить

Frontend локально перевіряє quiz, а потім викликає mint-функцію контракту.

Плюси:
- Просто й швидко.
- Легко зробити прототип.

Мінуси:
- Будь-хто може обійти frontend і напряму викликати контракт, якщо в контракті немає обмежень.

Вердикт: окей для іграшкового демо, але занадто легко обманути.

#### Варіант C: signed claim від issuer

Застосунок або backend перевіряє quiz і видає підписаний claim. Контракт перевіряє цей підпис перед mint.

Плюси:
- Навчає підписів повідомлень і їх перевірки.
- Тримає контракт простим.
- Більш реалістично для credentials і badge-систем.

Мінуси:
- Потрібен issuer key і обережний replay protection.
- Для реального flow потрібен backend або локальний script, який підписує claims.

Вердикт: найкраща цільова архітектура після першого локального прототипу.

### Рекомендована V1

Будуємо у дві фази:

1. Локальний прототип:
   - Smart contract з `mintBadge(address learner)`, обмеженим для owner/issuer.
   - Непередавана поведінка badge.
   - Svelte UI, який показує connect wallet, mint button і стан owned badge.

2. Signed-claim прототип:
   - Додати проходження quiz.
   - Додати signed mint claim.
   - Контракт перевіряє issuer signature.
   - Додати nonce або claim id, щоб запобігти replay.

### Початкова форма контракту

- Назва: `ProofOfLearningBadge`.
- Стандарт: ERC-721 compatible badge з вимкненими transfer-функціями.
- Ролі:
  - `owner`: deployer/admin.
  - `issuer`: акаунт, якому дозволено авторизувати claims.
- Основні функції:
  - `mint(address learner)` для issuer-only локальної v1.
  - `claimBadge(...)` для signed-claim v2.
  - `hasBadge(address learner)` як зручний read.
- Events:
  - `BadgeMinted(address indexed learner, uint256 indexed tokenId, string badgeType)`.

### Відкриті питання

- Один гаманець має мати лише один badge чи кілька badges для різних модулів?
- Metadata має жити на IPFS, у контракті чи у frontend для v1?
- Нам потрібен backend issuer service чи локальний script, який підписує claims?
- Проєкт має спершу пріоритезувати глибину Solidity чи wallet UX у frontend?

### Наступний milestone

Підняти мінімальний monorepo:

- `packages/contracts/` для Solidity, tests і deploy scripts.
- `apps/web/` для SvelteKit dApp.

Потім реалізувати локальний прототип і пройти повний end-to-end flow у локальній мережі.

## Структура проєкту

```text
.
├── apps/
│   └── web/                 # SvelteKit + SCSS dApp
├── packages/
│   └── contracts/           # Hardhat + Solidity contracts
├── package.json             # npm workspaces
└── README.md
```

## Базові команди

```bash
npm install
npm run web:dev
npm run contracts:compile
npm run contracts:test
```

Для локального blockchain flow:

```bash
npm run contracts:node
npm run contracts:deploy:local
```

Рекомендована Node.js версія для Hardhat: 20 або 22 LTS.
