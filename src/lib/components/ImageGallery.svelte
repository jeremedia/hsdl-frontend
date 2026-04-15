<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PhotoSwipeLightbox from 'photoswipe/lightbox';
	import 'photoswipe/style.css';

	interface GalleryImage {
		id: number | string;
		url: string;
		filename: string;
		width?: number;
		height?: number;
		content_type?: string;
		byte_size?: number;
	}

	let { images, thumbnailSize = 64, galleryId = 'issue-gallery' }: {
		images: GalleryImage[];
		thumbnailSize?: number;
		galleryId?: string;
	} = $props();

	let lightbox: PhotoSwipeLightbox | null = null;
	let galleryEl: HTMLElement;

	onMount(() => {
		lightbox = new PhotoSwipeLightbox({
			gallery: galleryEl,
			children: 'a',
			pswpModule: () => import('photoswipe'),
			bgOpacity: 0.9,
			padding: { top: 20, bottom: 20, left: 20, right: 20 }
		});
		lightbox.init();
	});

	onDestroy(() => {
		lightbox?.destroy();
	});
</script>

{#if images?.length}
	<div class="flex flex-wrap gap-1.5 mt-1.5" bind:this={galleryEl} id={galleryId}>
		{#each images as img (img.id)}
			<a
				href={img.url}
				data-pswp-width={img.width || 1200}
				data-pswp-height={img.height || 900}
				target="_blank"
				rel="noreferrer"
				class="block rounded border border-white/10 overflow-hidden hover:border-white/30 transition-colors"
				style="width: {thumbnailSize}px; height: {thumbnailSize}px;"
			>
				<img
					src={img.url}
					alt={img.filename}
					class="w-full h-full object-cover"
					loading="lazy"
				/>
			</a>
		{/each}
	</div>
{/if}
