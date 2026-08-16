// jsdom (used in tests) doesnt implement HTMLDialogElement.showModal() 
//so let it fall back to the open attribute there rather than throwing and failing every dialog test
export function openDialog(dialog: HTMLDialogElement | null) {
    if (!dialog) {
        return;
    }
    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    }
    else {
        dialog.setAttribute("open", "");
    }
}