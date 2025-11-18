<script lang="ts">
	import { Volume2, VolumeX, Vibrate } from 'lucide-svelte';
	import { setSoundEnabled, setSoundVolume, isSoundEnabled, getSoundVolume } from '$lib/utils/audio';
	import { setHapticEnabled, isHapticEnabled, isHapticSupported } from '$lib/utils/haptics';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let soundEnabled = $state(isSoundEnabled());
	let soundVolume = $state(getSoundVolume());
	let hapticEnabled = $state(isHapticEnabled());

	function handleSoundToggle() {
		soundEnabled = !soundEnabled;
		setSoundEnabled(soundEnabled);
	}

	function handleVolumeChange(e: Event) {
		const target = e.target as HTMLInputElement;
		soundVolume = parseFloat(target.value);
		setSoundVolume(soundVolume);
	}

	function handleHapticToggle() {
		hapticEnabled = !hapticEnabled;
		setHapticEnabled(hapticEnabled);
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}
</script>

<div class="modal-backdrop" onclick={handleBackdropClick} role="presentation">
	<dialog open>
		<article>
			<header>
				<h3>⚙️ Settings</h3>
			</header>
			<section>
				<div class="setting-group">
					<div class="setting-header">
						<label for="sound-toggle">
							{#if soundEnabled}
								<Volume2 size={20} />
							{:else}
								<VolumeX size={20} />
							{/if}
							Sound Effects
						</label>
						<input 
							id="sound-toggle"
							type="checkbox" 
							role="switch"
							checked={soundEnabled}
							onchange={handleSoundToggle}
						/>
					</div>
					{#if soundEnabled}
						<div class="setting-control">
							<label for="volume-slider">Volume</label>
							<input 
								id="volume-slider"
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={soundVolume}
								oninput={handleVolumeChange}
							/>
							<small>{Math.round(soundVolume * 100)}%</small>
						</div>
					{/if}
				</div>

				{#if isHapticSupported()}
					<div class="setting-group">
						<div class="setting-header">
							<label for="haptic-toggle">
								<Vibrate size={20} />
								Haptic Feedback
							</label>
							<input 
								id="haptic-toggle"
								type="checkbox"
								role="switch"
								checked={hapticEnabled}
								onchange={handleHapticToggle}
							/>
						</div>
						<small class="setting-description">
							Vibration feedback for card selections and actions
						</small>
					</div>
				{/if}
			</section>
			<footer>
				<button onclick={onClose} class="primary">Close</button>
			</footer>
		</article>
	</dialog>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9998;
		padding: 1rem;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	dialog {
		margin: 0;
		padding: 0;
		border: none;
		background: transparent;
		max-width: min(450px, calc(100vw - 2rem));
		width: 100%;
		animation: scaleIn 0.2s ease-out;
	}

	@keyframes scaleIn {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	article {
		margin: 0;
	}

	header h3 {
		margin: 0;
		font-size: clamp(1.1rem, 3vw, 1.25rem);
	}

	.setting-group {
		padding: 1rem;
		background: var(--pico-card-sectioning-background-color);
		border-radius: var(--pico-border-radius);
		margin-bottom: 1rem;
	}

	.setting-group:last-child {
		margin-bottom: 0;
	}

	.setting-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.setting-header label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-weight: 600;
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	.setting-control {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.setting-control label {
		font-size: clamp(0.875rem, 2vw, 1rem);
		margin: 0;
	}

	.setting-control small {
		text-align: right;
		color: var(--pico-muted-color);
	}

	.setting-description {
		display: block;
		margin-top: 0.5rem;
		color: var(--pico-muted-color);
		font-size: clamp(0.75rem, 1.8vw, 0.875rem);
		line-height: 1.4;
	}

	input[type="range"] {
		width: 100%;
		margin: 0.25rem 0;
	}

	button {
		margin: 0;
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	@media (prefers-reduced-motion: reduce) {
		.modal-backdrop,
		dialog {
			animation: none;
		}
	}
</style>
