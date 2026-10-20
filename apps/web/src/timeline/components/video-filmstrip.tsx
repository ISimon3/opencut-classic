"use client";

import { useEffect, useRef, useState } from "react";
import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from "mediabunny";
import type { MediaAsset } from "@/media/types";
import type { VideoElement } from "@/timeline/types";
import { mediaTimeToSeconds } from "opencut-wasm";

const frameCache = new WeakMap<File, Map<number, string>>();
const MAX_FRAMES = 48;
const MAX_CACHED_FRAMES = 256;

export function VideoFilmstrip({
	asset,
	element,
	height,
}: {
	asset: MediaAsset;
	element: VideoElement;
	height: number;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [count, setCount] = useState(1);
	const [strip, setStrip] = useState<{ key: string; frames: string[] } | null>(
		null,
	);
	const start = mediaTimeToSeconds({ time: element.trimStart });
	const duration = mediaTimeToSeconds({ time: element.duration });
	const rate = element.retime?.rate ?? 1;
	const key = `${asset.id}:${start}:${duration}:${rate}:${count}`;

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const observer = new ResizeObserver(([entry]) => {
			setCount(
				Math.min(
					MAX_FRAMES,
					Math.max(1, Math.ceil(entry.contentRect.width / ((height * 16) / 9))),
				),
			);
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [height]);

	useEffect(() => {
		let cancelled = false;
		let input: Input | null = null;
		const timer = setTimeout(async () => {
			try {
				input = new Input({
					source: new BlobSource(asset.file),
					formats: ALL_FORMATS,
				});
				const track = await input.getPrimaryVideoTrack();
				if (cancelled || !track || !(await track.canDecode())) return;
				const sourceDuration = await input.computeDuration();
				const sink = new VideoSampleSink(track);
				const cache = frameCache.get(asset.file) ?? new Map<number, string>();
				frameCache.set(asset.file, cache);
				const canvas = document.createElement("canvas");
				canvas.width = 160;
				canvas.height = 90;
				const context = canvas.getContext("2d");
				if (!context) return;
				const frames: string[] = [];
				for (let index = 0; index < count && !cancelled; index++) {
					const time = Math.max(
						0,
						Math.min(
							start + (duration * rate * index) / count,
							sourceDuration - 0.001,
						),
					);
					const timestamp = Math.round(time * 1000);
					let thumbnail = cache.get(timestamp);
					if (!thumbnail) {
						const sample = await sink.getSample(time);
						if (!sample) continue;
						try {
							context.clearRect(0, 0, 160, 90);
							sample.draw(context, 0, 0, 160, 90);
							thumbnail = canvas.toDataURL("image/jpeg", 0.7);
						} finally {
							sample.close();
						}
						cache.set(timestamp, thumbnail);
						if (cache.size > MAX_CACHED_FRAMES) {
							const oldest = cache.keys().next().value;
							if (oldest !== undefined) cache.delete(oldest);
						}
					}
					frames[index] = thumbnail;
					if (!cancelled) setStrip({ key, frames: [...frames] });
				}
			} catch (error) {
				if (!cancelled)
					console.warn("Could not generate timeline video thumbnails", error);
			} finally {
				input?.dispose();
				input = null;
			}
		}, 200);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [asset.file, count, duration, key, rate, start]);

	const frames = strip?.key === key ? strip.frames : [];
	return (
		<div
			ref={containerRef}
			className="absolute inset-0 flex pointer-events-none bg-muted"
			aria-hidden="true"
		>
			{Array.from({ length: count }, (_, index) => (
				<div
					key={index}
					className="h-full min-w-0 flex-1 bg-center bg-cover bg-no-repeat"
					style={{
						backgroundImage: frames[index]
							? `url(${frames[index]})`
							: undefined,
					}}
				/>
			))}
		</div>
	);
}
