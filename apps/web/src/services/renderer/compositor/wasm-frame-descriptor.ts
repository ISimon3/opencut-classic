import type { FrameDescriptor } from "./types";

export function toWasmFrameDescriptor(frame: FrameDescriptor) {
	return {
		...frame,
		items: frame.items.map((item) =>
			item.type === "sceneEffect"
				? {
						...item,
						// opencut-wasm 0.2.10 uses snake_case for this enum field.
						// Retain camelCase for compatibility with corrected WASM builds.
						effect_pass_groups: item.effectPassGroups,
					}
				: item,
		),
	};
}
