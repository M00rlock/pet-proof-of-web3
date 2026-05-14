<script lang="ts">
  const questions = [
    {
      question: 'Що таке приватний ключ у Web3?',
      options: [
        'Пароль до акаунта на біржі',
        'Секретний рядок, який дає повний контроль над гаманцем',
        'Публічна адреса гаманця',
        'PIN-код для MetaMask'
      ],
      correct: 1
    },
    {
      question: 'Що відбувається, коли ти підписуєш повідомлення гаманцем?',
      options: [
        'Відправляється транзакція в мережу',
        'Списується gas fee',
        'Доводиш, що контролюєш адресу, без on-chain транзакції',
        'Смарт-контракт автоматично виконується'
      ],
      correct: 2
    },
    {
      question: 'Що таке gas у Ethereum?',
      options: [
        'Назва нативного токена Ethereum',
        'Плата за обчислення, яку отримують валідатори',
        'Комісія біржі за обмін токенів',
        'Одиниця виміру швидкості транзакції'
      ],
      correct: 1
    },
    {
      question: 'Що таке soulbound token (SBT)?',
      options: [
        'NFT з обмеженим тиражем',
        "Токен, прив'язаний до конкретного гаманця і непередаваний",
        'Токен для стейкінгу в DeFi',
        'Governance токен DAO'
      ],
      correct: 1
    },
    {
      question: 'Що таке смарт-контракт?',
      options: [
        'Юридичний документ у цифровому форматі',
        'Програма, яка виконується на блокчейні і не може бути змінена після деплою',
        'API сервіс для Web3 застосунків',
        'Протокол шифрування транзакцій'
      ],
      correct: 1
    }
  ];

  let { onComplete }: { onComplete: () => void } = $props();

  let current = $state(0);
  let selected = $state<number | null>(null);
  let answered = $state(false);
  let score = $state(0);
  let finished = $state(false);

  function choose(index: number) {
    if (answered) return;
    selected = index;
    answered = true;
    if (index === questions[current].correct) score++;
  }

  function next() {
    if (current < questions.length - 1) {
      current++;
      selected = null;
      answered = false;
    } else {
      finished = true;
    }
  }

  const passed = $derived(score >= 4);
</script>

{#if finished}
  <div class="quiz-result">
    <p class="quiz-result__score">{score}/{questions.length}</p>
    {#if passed}
      <p class="quiz-result__message quiz-result__message--pass">
        Відмінно! Ти довів знання Web3 основ.
      </p>
      <button type="button" onclick={onComplete}>Підписати proof →</button>
    {:else}
      <p class="quiz-result__message quiz-result__message--fail">
        Недостатньо правильних відповідей. Спробуй ще раз.
      </p>
      <button
        type="button"
        class="button-secondary"
        onclick={() => {
          current = 0;
          selected = null;
          answered = false;
          score = 0;
          finished = false;
        }}
      >
        Спробувати знову
      </button>
    {/if}
  </div>
{:else}
  {@const q = questions[current]}
  <div class="quiz">
    <p class="quiz__progress">{current + 1} / {questions.length}</p>
    <p class="quiz__question">{q.question}</p>
    <ul class="quiz__options">
      {#each q.options as option, i}
        <li>
          <button
            type="button"
            class="quiz__option"
            class:quiz__option--correct={answered && i === q.correct}
            class:quiz__option--wrong={answered && i === selected && i !== q.correct}
            class:quiz__option--selected={i === selected}
            disabled={answered}
            onclick={() => choose(i)}
          >
            {option}
          </button>
        </li>
      {/each}
    </ul>
    {#if answered}
      <button type="button" onclick={next}>
        {current < questions.length - 1 ? 'Далі →' : 'Завершити'}
      </button>
    {/if}
  </div>
{/if}
