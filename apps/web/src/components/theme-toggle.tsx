"use client";

import { Button } from "./ui/button";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/utils/ui";
import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuLabel,
} from "./ui/dropdown-menu";

interface ThemeToggleProps {
	className?: string;
	iconClassName?: string;
	onToggle?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}
const modes = [
	{ value: "light", label: "Light mode", icon: Sun },
	{ value: "dark", label: "Dark mode", icon: Moon },
	{ value: "system", label: "Follow system", icon: Monitor },
];
const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export function ThemeToggle({
	className,
	iconClassName,
	onToggle,
}: ThemeToggleProps) {
	const { t } = useTranslation();
	const { theme, setTheme } = useTheme();
	const hydrated = useSyncExternalStore(
		subscribeHydration,
		clientSnapshot,
		serverSnapshot,
	);
	const selectedTheme = hydrated ? (theme ?? "system") : "system";
	const current =
		modes.find((mode) => mode.value === selectedTheme) ?? modes[2];
	const Icon = current.icon;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					className={cn("h-8 gap-1.5 px-2", className)}
					aria-label={`${t("Theme")}: ${t(current.label)}`}
					title={`${t("Theme")}: ${t(current.label)}`}
					onClick={onToggle}
				>
					<Icon className={cn("size-[1.1rem]", iconClassName)} />
					<ChevronDown className="size-3 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuLabel>{t("Theme")}</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={selectedTheme} onValueChange={setTheme}>
					{modes.map(({ value, label, icon: ModeIcon }) => (
						<DropdownMenuRadioItem key={value} value={value}>
							<ModeIcon className="size-4" />
							{t(label)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
