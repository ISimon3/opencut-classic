"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n/provider";
import { useState } from "react";

export function DeleteProjectDialog({
	isOpen,
	onOpenChange,
	onConfirm,
	projectNames,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	projectNames: string[];
}) {
	const { t: translateUi } = useTranslation();
	const [confirmation, setConfirmation] = useState("");
	const canDelete = confirmation === "DELETE";
	const handleOpenChange = (open: boolean) => {
		setConfirmation("");
		onOpenChange(open);
	};
	const count = projectNames.length;
	const isSingle = count === 1;
	const singleName = isSingle ? projectNames[0] : null;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					event.stopPropagation();
				}}
			>
				<DialogHeader>
					<DialogTitle>
						{singleName ? (
							<>
								{translateUi("Delete '")}
								<span className="inline-block max-w-[300px] truncate align-bottom">
									{singleName}
								</span>
								{translateUi("'?")}
							</>
						) : (
							translateUi("Delete {value0} projects?", { value0: count })
						)}
					</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<Alert variant="destructive">
						<AlertTitle>{translateUi("Warning")}</AlertTitle>
						<AlertDescription>
							{translateUi("This will permanently delete")}{" "}
							{singleName
								? `"${singleName}"`
								: translateUi("{value0} projects", { value0: count })}{" "}
							{translateUi("and all associated files.")}
						</AlertDescription>
					</Alert>
					<div className="flex flex-col gap-3">
						<Label className="text-xs font-semibold text-slate-500">
							{translateUi('Type "DELETE" to confirm')}
						</Label>
						<Input
							value={confirmation}
							onChange={(event) => setConfirmation(event.target.value)}
							type="text"
							placeholder="DELETE"
							size="lg"
							variant="destructive"
						/>
					</div>
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						{translateUi("Cancel")}
					</Button>
					<Button
						variant="destructive"
						disabled={!canDelete}
						onClick={() => {
							if (!canDelete) return;
							setConfirmation("");
							onConfirm();
						}}
					>
						{translateUi("Delete project")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
