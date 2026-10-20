import { expect, test } from "bun:test";
import { toWasmFrameDescriptor } from "./wasm-frame-descriptor";
import type { FrameDescriptor } from "./types";

test("scene effects supply the field required by the shipped WASM without changing layer fields", () => {
	const passes = [[{ shader: "test-shader", uniforms: { amount: 0.5 } }]];
	const frame: FrameDescriptor = {
		width: 1920,
		height: 1080,
		clear: { color: [0, 0, 0, 0] },
		items: [
			{ type: "sceneEffect", effectPassGroups: passes },
			{
				type: "layer",
				textureId: "video",
				transform: {
					centerX: 0,
					centerY: 0,
					width: 1920,
					height: 1080,
					rotationDegrees: 0,
					flipX: false,
					flipY: false,
				},
				opacity: 1,
				blendMode: "normal",
				effectPassGroups: passes,
				mask: null,
			},
		],
	};
	const converted = toWasmFrameDescriptor(frame);
	expect(converted.items[0]).toEqual({
		type: "sceneEffect",
		effectPassGroups: passes,
		effect_pass_groups: passes,
	});
	expect(converted.items[1] === frame.items[1]).toBe(true);
	expect(frame.items[0]).not.toHaveProperty("effect_pass_groups");
});
