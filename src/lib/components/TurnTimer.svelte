<script lang="ts">
	import { Clock } from 'lucide-svelte';
	import { onDestroy } from 'svelte';

	interface Props {
		duration: number; // Total duration in seconds
		playerName?: string;
		paused?: boolean;
		onExpired?: () => void;
		compact?: boolean; // New prop for compact mode (for header)
	}

	let { duration, playerName, paused = false, onExpired, compact = false }: Props = $props();

	// Internal state - component manages its own countdown
	let timeRemaining = $state(duration);
	let intervalId: number | null = null;

	// Reset timer when duration changes
	$effect(() => {
		timeRemaining = duration;
	});

	// Manage countdown interval - explicitly watch duration and paused
	$effect(() => {
		// Use duration in the effect body to create a dependency
		const currentDuration = duration;
		const currentPaused = paused;
		
		// Clear any existing interval
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}

		// Don't run if paused
		if (currentPaused) {
			return;
		}

		// Start countdown
		intervalId = window.setInterval(() => {
			if (timeRemaining > 0) {
				timeRemaining--;
				
				if (timeRemaining === 0 && onExpired) {
					onExpired();
				}
			}
		}, 1000);

		// Cleanup on unmount or when effect reruns
		return () => {
			if (intervalId !== null) {
				clearInterval(intervalId);
				intervalId = null;
			}
		};
	});

	const percentage = $derived((timeRemaining / duration) * 100);
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

<div class="timer-container" class:compact>
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
		<Clock size={compact ? 16 : 24} color={color} />
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

	.timer-container.compact {
		position: relative;
		top: auto;
		right: auto;
		z-index: auto;
		width: 60px;
		height: 60px;
		animation: none;
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

	.compact .timer-value {
		font-size: 0.875rem;
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

	.compact .timer-player {
		display: none; /* Hide player name in compact mode */
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
