"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useSyncExternalStore,
} from "react";
import { zhCN } from "./zh-CN";

export type InterfaceLanguage = "zh-CN" | "en";
const STORAGE_KEY = "opencut.interface-language";
const CHANGE_EVENT = "opencut:interface-language-changed";
let sessionLanguage: InterfaceLanguage = "zh-CN";
type Parameters = Record<string, string | number>;
type Translator = (text: string, parameters?: Parameters) => string;

const LanguageContext = createContext<{
	language: InterfaceLanguage;
	setLanguage: (language: InterfaceLanguage) => void;
	t: Translator;
} | null>(null);

function getLanguageSnapshot(): InterfaceLanguage {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === "zh-CN" || saved === "en") return saved;
	} catch {
		// Storage may be unavailable; retain the choice in this session.
	}
	return sessionLanguage;
}

function subscribeLanguage(listener: () => void) {
	const handleStorage = (event: StorageEvent) => {
		if (event.key === STORAGE_KEY || event.key === null) {
			sessionLanguage = event.newValue === "en" ? "en" : "zh-CN";
			listener();
		}
	};
	window.addEventListener("storage", handleStorage);
	window.addEventListener(CHANGE_EVENT, listener);
	return () => {
		window.removeEventListener("storage", handleStorage);
		window.removeEventListener(CHANGE_EVENT, listener);
	};
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
	const language = useSyncExternalStore<InterfaceLanguage>(
		subscribeLanguage,
		getLanguageSnapshot,
		() => "zh-CN",
	);

	useEffect(() => {
		document.documentElement.lang = language;
	}, [language]);

	const setLanguage = useCallback((next: InterfaceLanguage) => {
		sessionLanguage = next;
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// Continue applying the preference for the current session.
		}
		window.dispatchEvent(new Event(CHANGE_EVENT));
	}, []);

	const t = useCallback<Translator>(
		(text, parameters) => {
			const translated =
				language === "zh-CN" && Object.prototype.hasOwnProperty.call(zhCN, text)
					? zhCN[text]
					: text;
			return translated.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
				parameters?.[key] === undefined ? placeholder : String(parameters[key]),
			);
		},
		[language],
	);

	const value = useMemo(
		() => ({ language, setLanguage, t }),
		[language, setLanguage, t],
	);
	return (
		<LanguageContext.Provider value={value}>
			{children}
		</LanguageContext.Provider>
	);
}

export function useTranslation() {
	const context = useContext(LanguageContext);
	if (!context)
		throw new Error("useTranslation must be used inside LanguageProvider");
	return context;
}
