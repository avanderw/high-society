<script lang="ts">
	import { Clock } from 'lucide-svelte';

	interface Props {
		timeRemaining: number;
		totalTime: number;
		playerName?: string;
	}

	let { timeRemaining, totalTime, playerName }: Props = $props();

	const percentage = $derived((timeRemaining / totalTime) * 100);
	const color = $derived(
		percentage > 50 ? 'var(--pico-ins-color)' :
		percentage > 25 ? 'orange' :
		'var(--pico-del-color)'
	);
	
	// Calculate stroke dasharray for circular progress
	const radius = 45;
	const circumference = 2 * Math.PI * radius;
	const strokeDashoffset = $derived(circumference - (percentage / 100) * circumference);
</script>

<div class="timer-container">
	<svg class="timer-circle" viewBox="0 0 100 100">
		<!-- Background circle -->
		<circle
			cx="50"
			cy="50"
			r={radius}
			fill="none"
			stroke="var(--pico-muted-border-color)"
			stroke-width="4"
		/>
		<!-- Progress circle -->
		<circle
			cx="50"
			cy="50"
			r={radius}
			fill="none"
			stroke={color}
			stroke-width="6"
			stroke-linecap="round"
			style="
				stroke-dasharray: {circumference};
				stroke-dashoffset: {strokeDashoffset};
				transform: rotate(-90deg);
				transform-origin: 50% 50%;
				transition: stroke-dashoffset 1s linear, stroke 0.3s ease;
			"
		/>
	</svg>
	<div class="timer-content">
		<Clock size={24} color={color} />
		<span class="timer-value" style="color: {color}">{timeRemaining}s</span>
		{#if playerName}
			<span class="timer-player">{playerName}</span>
		{/if}
	</div>
</div>

<style>
	.timer-container {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 1000;
		width: 100px;
		height: 100px;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.05);
		}
	}

	.timer-circle {
		width: 100%;
		height: 100%;
	}

	.timer-content {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
		pointer-events: none;
	}

	.timer-value {
		font-size: 1.25rem;
		font-weight: bold;
		line-height: 1;
	}

	.timer-player {
		font-size: 0.625rem;
		color: var(--pico-muted-color);
		text-align: center;
		max-width: 70px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 480px) {
		.timer-container {
			width: 80px;
			height: 80px;
			top: 0.5rem;
			right: 0.5rem;
		}

		.timer-value {
			font-size: 1rem;
		}

		.timer-player {
			font-size: 0.55rem;
			max-width: 60px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.timer-container {
			animation: none;
		}
		
		.timer-circle circle {
			transition: none !important;
		}
	}
</style>
