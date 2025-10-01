<script lang="ts">
	interface Props {
		onStart: (playerNames: string[]) => void;
	}

	let { onStart }: Props = $props();

	let playerCount = $state(3);
	let playerNames = $state<string[]>(['Alice', 'Bob', 'Charlie']);

	function handlePlayerCountChange(count: number) {
		playerCount = count;
		const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
		playerNames = names.slice(0, count);
	}

	function handleStart() {
		const validNames = playerNames.filter(name => name.trim() !== '');
		if (validNames.length >= 2) {
			onStart(validNames);
		}
	}
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
						placeholder="Enter name"
						required
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
