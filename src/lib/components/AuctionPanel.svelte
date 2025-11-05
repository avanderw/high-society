<script lang="ts">
	import type { Auction } from '$lib/domain/auction';
	import type { Player } from '$lib/domain/player';

	interface Props {
		auction: Auction | null;
		currentPlayer: Player;
		localPlayer?: Player; // The player at this client (for showing their personal bid)
		currentPlayerIndex: number;
		allPlayers: Player[];
		onBid: () => void;
		onPass: () => void;
		selectedTotal: number;
		updateKey?: number;
		isMultiplayer?: boolean;
		isMyTurn?: boolean;
	}

	let { auction, currentPlayer, localPlayer, currentPlayerIndex, allPlayers, onBid, onPass, selectedTotal, updateKey = 0, isMultiplayer = false, isMyTurn = true }: Props = $props();

	const isActive = $derived((playerId: string) => 
		auction?.getActivePlayers().has(playerId) ?? false
	);

	const currentBid = $derived(updateKey >= 0 ? auction?.getCurrentHighestBid() ?? 0 : 0);
	// Use localPlayer for bid calculations if available, otherwise fall back to currentPlayer
	const playerForBid = $derived(localPlayer ?? currentPlayer);
	const playerCurrentBid = $derived(updateKey >= 0 ? playerForBid.getCurrentBidAmount() : 0);
	const newTotalBid = $derived(playerCurrentBid + selectedTotal);
	const canBid = $derived(newTotalBid > currentBid);
</script>

<article>
	<header>
		<h3>Auction</h3>
	</header>

	<section>
		<p><strong>Current Player:</strong> {currentPlayer.name}</p>
		<p><strong>Current Highest Bid:</strong> {currentBid.toLocaleString()} Francs</p>
		{#if playerCurrentBid > 0}
			<p><strong>Your Current Bid:</strong> {playerCurrentBid.toLocaleString()} Francs</p>
			<p><strong>Adding:</strong> {selectedTotal.toLocaleString()} Francs</p>
			<p><strong>New Total:</strong> {newTotalBid.toLocaleString()} Francs</p>
		{:else}
			<p><strong>Your Selected Bid:</strong> {selectedTotal.toLocaleString()} Francs</p>
		{/if}

		<details>
			<summary>Active Players</summary>
			<ul>
				{#each allPlayers as player, index}
					<li>
						<span style="color: {player.color};">●</span>
						{player.name}
						{#if index === currentPlayerIndex}
							<mark>Current Turn</mark>
						{/if}
						{#if !isActive(player.id)}
							<small>(Passed)</small>
						{/if}
					</li>
				{/each}
			</ul>
		</details>
	</section>

	<footer>
		{#if isMultiplayer && !isMyTurn}
			<div class="not-your-turn">
				<p>⏳ Waiting for {currentPlayer.name} to take their turn...</p>
			</div>
		{:else}
			<div class="grid">
				<button 
					onclick={onBid} 
					disabled={!canBid || selectedTotal === 0}
					class="primary"
				>
					Place Bid ({selectedTotal.toLocaleString()})
				</button>
				<button 
					onclick={onPass}
					class="secondary"
				>
					Pass
				</button>
			</div>
			{#if !canBid && selectedTotal > 0}
				<small style="color: var(--pico-del-color);">
					Your new total ({newTotalBid.toLocaleString()}) must be higher than {currentBid.toLocaleString()}
				</small>
			{/if}
		{/if}
	</footer>
</article>

<style>
	ul {
		list-style: none;
		padding: 0;
	}

	li {
		padding: 0.5rem;
		margin: 0.25rem 0;
	}

	mark {
		padding: 0.25rem 0.5rem;
		margin-left: 0.5rem;
	}

	footer {
		margin-top: 1rem;
	}

	.not-your-turn {
		text-align: center;
		padding: 1rem;
		background-color: var(--pico-card-background-color);
		border-radius: var(--pico-border-radius);
		color: var(--pico-muted-color);
	}

	.not-your-turn p {
		margin: 0;
	}
</style>
