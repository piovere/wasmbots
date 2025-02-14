<script lang="ts">
	import { onMount, type Snippet } from "svelte";
	import { base } from "$app/paths";
	import { navigating } from "$app/state";

	import { ListBullets, ArrowUDownLeft } from "phosphor-svelte";

	import ManaForge from "$lib/ui/ManaForge.svelte";
    import Spinner from "$lib/ui/Spinner.svelte";

	interface Props {
		children?: Snippet;
	}
	let { children }: Props = $props();

	let navUnfolded: boolean = $state(false);

	let mainHeader: HTMLElement;
	let mainHeaderVisible = $state(true);
	onMount(() => {
		const observer = new IntersectionObserver(([entry]) => {
			mainHeaderVisible = entry.isIntersecting;
		}, { threshold: [0.0] });
		observer.observe(mainHeader);
		return () => observer.disconnect();
	});

	let isNavigating = $derived(navigating.from !== null);
</script>

<div class="container">
	<header bind:this={mainHeader} class="mainHeader">
		<ManaForge />
		<a href="{base}/">
			<img class="logo" src="{base}/img/logo-cropped.svg" alt="WasmBots Logo">
		</a>
	</header>
	<main>
		<nav class:unfolded={navUnfolded}>
			<header class="navHeader" class:pinned={!mainHeaderVisible}>
				<ManaForge />
				<a href="{base}/">
					<img class="logo" src="{base}/img/logo-cropped.svg" alt="WasmBots Logo">
				</a>
			</header>
			<ul>
				<li><a href="{base}/app">App</a></li>
				<li><a href="{base}/docs">Documentation</a>
					<ul>
						<li><a href="{base}/docs/history">Development History</a></li>
						<li><a href="{base}/docs/concepts">Concepts</a></li>
						<li><a href="{base}/docs/interface">Programming Interface</a></li>
						<li><a href="{base}/docs/libraries">Client Libraries</a></li>
						<li><a href="{base}/docs/trainers">Trainers</a></li>
					</ul>
				</li>
				<li><a href="{base}/embedded/">Embedded Example</a></li>
				<li class="githubLink"><a href="https://github.com/sjml/wasmbots" class="external github" target="_blank">Source Code<img src="{base}/img/github.svg" alt="GitHub Logo"></a></li>
			</ul>
		</nav>
		<button id="tocOverlay" onclick={() => navUnfolded = false} aria-label="Dismiss navigation"></button>
		<button class="navToggle" class:unfolded={navUnfolded} onclick={() => navUnfolded = !navUnfolded}>
			{#if navUnfolded}
				<ArrowUDownLeft size={32} />
			{:else}
				<ListBullets size={32} />
			{/if}
		</button>
		<section class="content">
			{#if !isNavigating}
				{@render children?.()}
			{:else}
				<Spinner />
			{/if}
		</section>
	</main>
</div>

<style>
	.container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		max-width: 950px;
		margin: 0 auto;

		--transition-timing: 200ms;
	}

	@media (prefers-reduced-motion: reduce) {
		.container {
			--transition-timing: 0ms;
		}
	}

	.container > header {
		padding: 15px;
		text-align: center;
	}

	#tocOverlay {
		all: unset; /* Svelte must be appeased */

		position: fixed;
		top:0;
		left:0;
		z-index: 5;

		height: 100vh;
		width: 100vw;
		background-color: hsl(221, 10%, 10%);
		opacity: 0;
		pointer-events: none;

		transition-property: opacity;
		transition-duration: var(--transition-timing);
	}

	header .logo {
		filter: invert(0.9) drop-shadow(0px 0px 10px hsl(221, 10%, 10%));
		max-height: 50px;
		margin: 8px;
	}

	header.navHeader .logo {
		max-width: 80%;
		margin: 8px auto;
	}

	header {
		background-color: hsl(221, 10%, 10%);
	}

	header a {
		text-decoration: none;
		color: inherit;
	}

	.mainHeader {
		position: relative;
		z-index: 50;
	}

	main {
		display: flex;
		flex-grow: 1;
	}

	nav {
		max-width: 200px;
		flex-shrink: 0;
		background-color: hsl(221, 10%, 15%);
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-y: auto;

		z-index: 10;
		transition-property: margin-left, transform, box-shadow;
		transition-duration: var(--transition-timing);
	}

	nav header.navHeader {
		/* display: none; */
		display: flex;
		align-items: center;
		min-height: 45px;
		text-align: center;
		transform: translateY(-100%);
		transition-property: transform;
		transition-duration: var(--transition-timing);
	}

	header.navHeader.pinned {
		/* display: block; */
		transform: translateY(0);
	}

	header.navHeader a {
		display: flex;
		align-items: center;
	}

	nav ul {
		list-style: none;
		flex-grow: 1;
		margin: 20px 0px;
		padding-left: 0px 35px;
	}

	nav li {
		margin-bottom: 15px;
	}

	nav ul ul {
		margin-top: 15px;
		margin-left: 25px;
		padding-left: 0;
	}

	li.githubLink a {
		display: flex;
	}

	li.githubLink img {
		width: 20px;
		margin-left: 5px;
	}

	.navToggle {
		height: 40px;
		width: 40px;
		background-color: hsl(221, 10%, 85%);
		position: sticky;
		top: 0;
		z-index: 100;
		margin-right: -40px;
		padding: 5px;
		justify-content: center;
		color: inherit;

		opacity: 0;
		pointer-events: none;

		border: none;
		display: flex;
		align-items: center;
		transition-property: opacity, transform;
		transition-duration: var(--transition-timing);
	}

	@media screen and (max-width: 649px) {
		nav {
			margin-left: -200px;
			transform: translateX(0);
		}

		nav.unfolded {
			transform: translateX(200px);
			box-shadow: hsl(221, 10%, 10%) 10px 40px 15px;
		}

		.navToggle {
			opacity: 1.0;
			cursor: pointer;
			pointer-events: all;
		}

		.navToggle.unfolded {
			transform: translateX(200px);
		}

		nav.unfolded + #tocOverlay {
			opacity: 0.3;
			pointer-events: all;
		}
	}

	.content {
		flex-grow: 1;
		position: relative;
		overflow: hidden;
		padding: 0 25px 20px 20px;
		font-size: 18px;
		background-color: hsl(221, 8%, 20%);
		color: rgba(255, 255, 255, 0.85);

		line-height: 1.4;
		/* arguably if I'm making this kind of adjustment I should just pick a different font */
		/* letter-spacing: 0.2px; */
	}
</style>
