<script lang="ts">
	interface Props {
		onStart: (playerNames: string[]) => void;
	}

	let { onStart }: Props = $props();

	let playerCount = $state(3);
	let playerNames = $state<string[]>([]);
	let placeholderNames = $state<string[]>([]);

	const allRandomNames = [
		'Baron von Bling', 'Duchess Diamond', 'Count Cashmore', 'Lady Luxe',
		'Sir Spendwell', 'Princess Prestige', 'Duke Dapper', 'Madame Moneybags',
		'Lord Lavish', 'Baroness Bling', 'Captain Cash', 'Miss Fortune',
		'Earl Elegant', 'Countess Couture', 'Sir Status', 'Lady Lush',
		'Baron Bountiful', 'Duchess Decadent', 'Lord Luxury', 'Miss Magnificent'
	];

	function generateRandomNames(count: number): string[] {
		const shuffled = [...allRandomNames].sort(() => Math.random() - 0.5);
		return shuffled.slice(0, count);
	}

	function handlePlayerCountChange(count: number) {
		playerCount = count;
		placeholderNames = generateRandomNames(count);
		// Keep existing non-empty names, add empty strings for new players
		const newNames = [...playerNames];
		while (newNames.length < count) {
			newNames.push('');
		}
		playerNames = newNames.slice(0, count);
	}

	function handleStart() {
		// Use placeholder names for empty inputs
		const finalNames = playerNames.map((name, index) => 
			name.trim() !== '' ? name.trim() : placeholderNames[index]
		);
		if (finalNames.length >= 2) {
			onStart(finalNames);
		}
	}

	// Initialize with random names
	placeholderNames = generateRandomNames(3);
	playerNames = ['', '', ''];
</script>

<article>
	<header>
		<h2>Setup Game</h2>
	</header>

	<section>
		<label for="player-count">
			Number of Players (2-5)
			<input
				id="player-count"
				type="range"
				min="2"
				max="5"
				bind:value={playerCount}
				onchange={() => handlePlayerCountChange(playerCount)}
			/>
			<small>{playerCount} players</small>
		</label>

		<fieldset>
			<legend>Player Names</legend>
			{#each playerNames as name, index}
				<label for="player-{index}">
					Player {index + 1}
					<input
						id="player-{index}"
						type="text"
						bind:value={playerNames[index]}
						placeholder={placeholderNames[index]}
					/>
				</label>
			{/each}
		</fieldset>

		<button onclick={handleStart} class="primary">Start Game</button>
	</section>

	<footer>
		<small>A game of luxury, prestige, and strategic bidding for 2-5 players</small>
	</footer>
</article>

<style>
	article {
		max-width: 600px;
		margin: 0 auto;
	}

	button {
		width: 100%;
		margin-top: 1rem;
	}
</style>
