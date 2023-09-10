import { PDFPageProxy } from "pdfjs-dist";

export function isValidRotation(angle: number) {
    return Number.isInteger(angle) && angle % 90 === 0;
}

export function setElemSizeFromPage(
    element: HTMLElement,
    page: PDFPageProxy,
    rotation: number,
) {
    const viewport = page.getViewport({ scale: 1, rotation });
    element.style.height = `calc(var(--scale-factor) * ${viewport.height}px)`;
    element.style.width = `calc(var(--scale-factor) * ${viewport.width}px)`;
}
