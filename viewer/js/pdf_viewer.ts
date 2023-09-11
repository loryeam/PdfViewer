import { PDFDocumentProxy, PixelsPerInch } from "pdfjs-dist";
import { OptionalContentConfig } from "pdfjs-dist/types/src/display/optional_content_config";
import { IPDFLinkService } from "pdfjs-dist/types/web/interfaces";
import { EventBus, SimpleLinkService } from "pdfjs-dist/web/pdf_viewer";
import { EventType, ScaleData } from "./core";
import { Log } from "./log";
import { PdfPageView } from "./pdf_page_view";
import { isValidRotation } from "./utils";

export interface PdfViewerOptions {
    container: HTMLDivElement;
    eventBus: EventBus;
    linkService?: IPDFLinkService;
    maxCanvasPixels?: number;
}

export interface ScrollPageIntoViewParameters {
    pageNumber: number;
    destArray?: string[];
    allowNegativeOffset?: boolean;
    ignoreDestinationZoom?: boolean;
}

interface LoadPageParameters {
    pageNumber: number,
    useCached?: boolean,
    invalidateCache?: boolean,
    preRender?: boolean,
}

interface PdfViewerState {
    cachedPages: Set<number>;
    pageNumber: number;
    pageViews: PdfPageView[];
    rotation: number;
    scale: number;
    scaling: boolean;
    pdfDocument?: PDFDocumentProxy;
}

const DEFAULT_STATE = () => {
    return {
        cachedPages: new Set(),
        pageNumber: 0,
        pageViews: [],
        rotation: channel.getRotation(),
        scale: channel.getScale(),
        scaling: false,
    } as PdfViewerState;
};

const MAX_CACHE_SIZE = 10;

const TAG = "PdfViewer";

export class PdfViewer {
    private readonly container;
    private readonly viewer;
    private readonly eventBus;
    private readonly linkService;
    private readonly maxCanvasPixels;

    private state = DEFAULT_STATE();

    private _optionalContentConfigPromise?: Promise<OptionalContentConfig>;

    private get pdfSet() {
        return !!this.state.pdfDocument;
    }

    /**
     * shim
     */
    get currentPageNumber() {
        return this.state.pageNumber;
    }

    /**
     * shim
     */
    set currentPageNumber(value) {
        this.setPageNumber(value);
    }

    /**
     * shim
     */
    get isInPresentationMode() {
        return false;
    }

    /**
     * shim
     */
    get optionalContentConfigPromise(): Promise<OptionalContentConfig> | Promise<null> {
        return this._optionalContentConfigPromise ?? Promise.resolve(null);
    }

    /**
     * shim
     */
    set optionalContentConfigPromise(promise: Promise<OptionalContentConfig>) {
        if (!(promise instanceof Promise)) {
            throw new Error(`invalid optionalContentConfigPromise: ${promise}`);
        }
        if (!this.pdfSet) {
            return;
        }
        this._optionalContentConfigPromise = promise;
    }

    /**
     * shim
     */
    get pagesCount() {
        return this.state.pageViews.length;
    }

    /**
     * shim
     */
    get pagesRotation() {
        return this.state.rotation;
    }

    /**
     * shim
     */
    set pagesRotation(value) {
        this.setRotation(value);
    }

    constructor({
        container,
        eventBus,
        linkService = new SimpleLinkService(),
        maxCanvasPixels = channel.getMaxCanvasPixels(),
    }: PdfViewerOptions) {
        this.container = container;
        this.viewer = document.createElement("div");
        this.viewer.className = "pdfViewer";
        container.appendChild(this.viewer);

        this.eventBus = eventBus;
        this.linkService = linkService;
        this.maxCanvasPixels = maxCanvasPixels;
    }

    async setDocument(pdfDocument: PDFDocumentProxy) {
        if (this.pdfSet) {
            Log.w(TAG, "setDocument: pdf already set");
            return;
        }

        this.state.pdfDocument = pdfDocument;

        const optionalContentConfigPromise = pdfDocument.getOptionalContentConfig();
        this._optionalContentConfigPromise = optionalContentConfigPromise;

        const numPages = pdfDocument.numPages;
        for (let i = 1; i <= numPages; ++i) {
            const pageView = new PdfPageView({
                // TODO
                container: this.viewer,
                page: await pdfDocument.getPage(i),
                linkService: this.linkService,
                maxCanvasPixels: this.maxCanvasPixels,
            });
            this.state.pageViews.push(pageView);
        }

        this.eventBus.dispatch(EventType.PAGES_INIT, { source: this });
    }

    /**
     * shim
     */
    nextPage() {
        this.setPageNumber(this.state.pageNumber + 1);
    }

    /**
     * shim
     */
    previousPage() {
        this.setPageNumber(this.state.pageNumber - 1);
    }

    /**
     * shim
     */
    pageLabelToPageNumber(label: string): number {
        Log.d(TAG, `pageLabelToPageNumber: label: ${label}`);
        return 0;
    }

    /**
     * shim
     */
    scrollPageIntoView({
        pageNumber,
        destArray = undefined,
        allowNegativeOffset = false,
        ignoreDestinationZoom = false,
    }: ScrollPageIntoViewParameters) {
        const msg = [
            `pageNumber: ${pageNumber}`,
            `destArray: ${JSON.stringify(destArray)}`,
            `allowNegativeOffset: ${allowNegativeOffset}`,
            `ignoreDestinationZoom: ${ignoreDestinationZoom}`,
        ];
        Log.d(TAG, `scrollPageIntoView: ${msg.join(" ")}`);
        this.setPageNumber(pageNumber)
            .then(() => channel.setPageNumber(pageNumber));
    }

    async setPageNumber(pageNumber: number) {
        if (!this.pdfSet) {
            throw new Error("no document set");
        }

        const prevPageNum = this.state.pageNumber;
        if (pageNumber === prevPageNum) {
            return;
        }

        this.unloadPage(prevPageNum);
        await this.loadPage({ pageNumber });
    }

    async setRotation(rotation: number) {
        if (!isValidRotation(rotation)) {
            throw new Error(`invalid pages rotation angle: ${rotation}`);
        }

        const state = this.state;

        if (rotation === state.rotation) {
            return;
        }
        state.rotation = rotation;

        if (!this.pdfSet || state.pageNumber === 0) {
            return;
        }

        await this.loadPage({
            pageNumber: state.pageNumber,
            useCached: false,
            invalidateCache: true,
        });
    }

    async setScale(scale: number) {
        const state = this.state;

        if (scale === state.scale && !this.state.scaling) {
            return;
        }
        this.setViewerDivScale(scale);
        state.scale = scale;

        if (!this.pdfSet || state.pageNumber === 0) {
            return;
        }

        await this.loadPage({
            pageNumber: state.pageNumber,
            useCached: false,
            invalidateCache: true,
        });
    }

    onScaleBegin() {
        this.state.scaling = true;
        this.getPageView(this.state.pageNumber)?.prepareForScale();
    }

    onScale(data: ScaleData) {
        this.setViewerDivScale(data.scale);

        const factor = data.scale / this.state.scale - 1;
        const focusX = globalThis.scrollX + data.focusX;
        const focusY = globalThis.scrollY + data.focusY;
        globalThis.scrollBy(focusX * factor, focusY * factor);

        this.state.scale = data.scale;
    }

    async onScaleEnd(data: ScaleData) {
        await this.setScale(data.scale);
        this.state.scaling = false;
    }

    private async loadPage({
        pageNumber,
        useCached = true,
        invalidateCache = false,
        preRender = false,
    }: LoadPageParameters) {
        const pageView = this.getPageView(pageNumber);
        if (!pageView) {
            throw new Error(`invalid page number: ${pageNumber}`);
        }

        const state = this.state;
        const cachedPages = state.cachedPages;

        if (invalidateCache) {
            // If we unload current page, the scroll location will reset, which
            // we don't want. So, temporarily mark current page as not cached.
            if (!preRender) {
                cachedPages.delete(pageNumber);
            }
            for (const pageNum of cachedPages) {
                this.getPageView(pageNum)?.reset();
            }
            cachedPages.clear();
            cachedPages.add(pageNumber);
        }

        this.pruneCache();

        await pageView.render({
            rotation: state.rotation,
            scale: state.scale,
            useCached,
            attachToContainer: !preRender,
        });

        cachedPages.delete(pageNumber);
        cachedPages.add(pageNumber);

        if (preRender) {
            return;
        }

        const prevPageNum = state.pageNumber;
        state.pageNumber = pageNumber;

        const pagesToPreRender = [];
        if (pageNumber < state.pageViews.length) {
            pagesToPreRender.push(pageNumber + 1);
        }
        if (pageNumber > 1) {
            pagesToPreRender.push(pageNumber - 1);
        }
        if (prevPageNum > pageNumber) {
            pagesToPreRender.reverse();
        }

        for (const pageNumber of pagesToPreRender) {
            await this.loadPage({ pageNumber, preRender: true });
        }
    }

    private unloadPage(pageNumber: number) {
        this.pruneCache();
        this.getPageView(pageNumber)?.detachFromContainer();
    }

    private getPageView(pageNumber: number): PdfPageView | undefined {
        const pageViews = this.state.pageViews;
        if (pageNumber <= 0 || pageNumber > pageViews.length) {
            return;
        }
        return pageViews[pageNumber - 1];
    }

    private pruneCache() {
        const cachedPages = this.state.cachedPages;
        while (cachedPages.size > MAX_CACHE_SIZE) {
            const pageToUnload = cachedPages.values().next().value;
            this.getPageView(pageToUnload)?.reset();
            cachedPages.delete(pageToUnload);
        }
    }

    private setViewerDivScale(scale: number) {
        const cssScale = scale * PixelsPerInch.PDF_TO_CSS_UNITS;
        this.viewer.style.setProperty("--scale-factor", cssScale.toString());
    }
}
