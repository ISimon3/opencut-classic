"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { DEFAULT_LOGO_URL } from "@/site/brand";
import { ArrowRight, Check, Languages, Monitor, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/provider";

const STORAGE_KEY = "opencut.desktop-welcome.hidden";
const CHANGE_EVENT = "opencut:desktop-welcome-changed";
let dismissedThisSession = false;

function getSnapshot() {
	if (dismissedThisSession) return false;
	try {
		return localStorage.getItem(STORAGE_KEY) !== "1";
	} catch {
		return true;
	}
}

function subscribe(listener: () => void) {
	window.addEventListener(CHANGE_EVENT, listener);
	window.addEventListener("storage", listener);
	return () => {
		window.removeEventListener(CHANGE_EVENT, listener);
		window.removeEventListener("storage", listener);
	};
}

export function DesktopWelcome() {
	const open = useSyncExternalStore(subscribe, getSnapshot, () => false);
	const { language } = useTranslation();
	const chinese = language === "zh-CN";
	const dismiss = (remember: boolean) => {
		if (remember) {
			try {
				localStorage.setItem(STORAGE_KEY, "1");
			} catch {
				/* Still dismiss the welcome for this session. */
			}
		}
		dismissedThisSession = true;
		window.dispatchEvent(new Event(CHANGE_EVENT));
	};
	const features = chinese
		? [
				{
					icon: Languages,
					title: "更熟悉的中文界面",
					description: "汉化主要界面，让创作少一点语言障碍。",
				},
				{
					icon: Wrench,
					title: "更顺手的编辑体验",
					description: "修复使用中遇到的问题，持续打磨细节。",
				},
				{
					icon: Monitor,
					title: "从网页走向桌面",
					description: "完成桌面适配、编译与打包，打开即可创作。",
				},
			]
		: [
				{
					icon: Languages,
					title: "A familiar Chinese interface",
					description:
						"Chinese localization across the main editing interface.",
				},
				{
					icon: Wrench,
					title: "A smoother editing experience",
					description:
						"Bug fixes and thoughtful improvements to everyday workflows.",
				},
				{
					icon: Monitor,
					title: "From the web to your desktop",
					description:
						"Desktop adaptation, compilation and packaging in one app.",
				},
			];

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) dismiss(false);
			}}
		>
			<DialogContent className="max-w-[620px] max-h-[90vh] overflow-y-auto rounded-3xl gap-0 shadow-2xl">
				<div className="relative overflow-hidden rounded-t-3xl border-b bg-linear-to-br from-teal-500/15 via-cyan-500/5 to-transparent px-8 pt-9 pb-7 sm:px-10">
					<div
						aria-hidden="true"
						className="absolute -right-12 -top-20 size-64 rounded-full border border-teal-500/15"
					/>
					<div
						aria-hidden="true"
						className="absolute -right-4 -top-12 size-48 rounded-full border border-teal-500/15"
					/>
					<div className="relative">
						<div className="mb-6 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-teal-700 dark:text-teal-300">
							<Image
								src={DEFAULT_LOGO_URL}
								width={28}
								height={28}
								alt="OpenCut"
								className="size-7"
							/>{" "}
							OPENCUT · DESKTOP
						</div>
						<DialogTitle className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
							{chinese
								? "欢迎，让灵感开始成片。"
								: "Welcome. Bring your ideas to life."}
						</DialogTitle>
						<DialogDescription className="mt-4 max-w-[470px] text-sm leading-7">
							{chinese ? (
								<>
									这是由{" "}
									<strong className="font-medium text-foreground">
										岑默之Simonius
									</strong>{" "}
									基于开源项目{" "}
									<strong className="font-medium text-foreground">
										OpenCut
									</strong>{" "}
									优化并打包的桌面应用。在原项目基础上，完成了界面汉化、部分问题修复，以及桌面端的编译与打包。
								</>
							) : (
								<>
									A desktop application refined and packaged by{" "}
									<strong className="font-medium text-foreground">
										岑默之Simonius
									</strong>
									, based on the open-source project{" "}
									<strong className="font-medium text-foreground">
										OpenCut
									</strong>
									. This edition includes Chinese localization, bug fixes, and
									desktop compilation and packaging.
								</>
							)}
						</DialogDescription>
					</div>
				</div>
				<div className="px-8 py-6 sm:px-10">
					<div className="flex flex-col gap-5">
						{features.map(({ icon: Icon, title, description }) => (
							<div key={title} className="flex items-start gap-4">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
									<Icon className="size-[18px] text-teal-700 dark:text-teal-300" />
								</div>
								<div className="pt-0.5">
									<h3 className="text-sm font-medium">{title}</h3>
									<p className="mt-1 text-xs leading-5 text-muted-foreground">
										{description}
									</p>
								</div>
							</div>
						))}
					</div>
					<p className="mt-6 border-t pt-4 text-xs leading-5 text-muted-foreground">
						{chinese
							? "感谢 OpenCut 团队与开源贡献者，让这次优化成为可能。"
							: "With thanks to the OpenCut team and open-source contributors."}
					</p>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-3 border-t bg-muted/20 px-8 py-5 sm:px-10 rounded-b-3xl">
					<Button
						variant="outline"
						className="rounded-xl"
						onClick={() => dismiss(true)}
					>
						<Check className="size-4" />
						{chinese ? "不再提示" : "Don't show again"}
					</Button>
					<Button
						className="rounded-xl px-7 bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-400 dark:text-teal-950 dark:hover:bg-teal-300"
						onClick={() => dismiss(false)}
					>
						{chinese ? "确认" : "Confirm"}
						<ArrowRight className="size-4" />
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
