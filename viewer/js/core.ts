import { PDFPageProxy, PageViewport } from "pdfjs-dist";

export interface Channel {
    getPage(): number;
    setPageNumber(pageNumber: number): void;
    getScale(): number;
    setScale(ratio: number): void;
    getMinScale(): number;
    getMaxScale(): number;
    getScaleFocusX(): number;
    getScaleFocusY(): number;
    getRotation(): number;
    setNumPages(numPages: number): void;
    setDocumentProperties(properties: string): void;
    showPasswordPrompt(): void;
    invalidPassword(): void;
    onLoaded(): void;
    getPassword(): string;
}

export interface Layer {
    render(page: PDFPageProxy, viewport: PageViewport): Promise<void>;
    cancelRender(): void;
    prepareForScale?(): void;
}

export enum EventType {
    PAGES_INIT = "pagesinit",
}

export enum ScaleEvent {
    SCALE_BEGIN = 0,
    SCALE = 1,
    SCALE_END = 2,
}

export interface ScaleData {
    scale: number,
    focusX: number,
    focusY: number,
}
