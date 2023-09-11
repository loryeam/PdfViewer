import { PDFPageProxy, PageViewport, RenderTask } from "pdfjs-dist";
import { Layer } from "../core";
import { Log } from "../log";
import { setElemSizeFromPage } from "../utils";

const TAG = "CanvasLayer";

export class CanvasLayer implements Layer {
    private readonly div;
    private readonly maxCanvasPixels;

    private canvas?: HTMLCanvasElement;
    private renderTask?: RenderTask;

    constructor(options: { container: HTMLDivElement, maxCanvasPixels: number }) {
        const div = document.createElement("div");
        div.className = "canvasLayer";
        options.container.appendChild(div);
        this.div = div;
        this.maxCanvasPixels = options.maxCanvasPixels;
    }

    async render(page: PDFPageProxy, viewport: PageViewport) {
        const ratio = globalThis.devicePixelRatio;
        const height = viewport.height * ratio;
        const width = viewport.width * ratio;
        const canvasPixels = height * width;

        let newViewport = viewport;

        // Limit resolution to prevent high memory usage.
        if (canvasPixels > this.maxCanvasPixels) {
            Log.w(TAG, `drawing page "${page.pageNumber}" with reduced resolution`);
            // There are artifacts in HTML canvas when a viewport with high
            // scale is used to render page on the canvas. So, we create a new
            // viewport with lower scale.
            const scaleAdjustment = Math.sqrt(this.maxCanvasPixels / canvasPixels);
            newViewport = page.getViewport({
                scale: viewport.scale * scaleAdjustment,
                rotation: viewport.rotation,
            });
        }

        const div = this.div;
        const canvas = document.createElement("canvas");

        // We use the new viewport to set "resolution" of the canvas.
        canvas.height = newViewport.height * ratio;
        canvas.width = newViewport.width * ratio;

        setElemSizeFromPage(canvas, page, viewport.rotation);

        const canvasContext = canvas.getContext("2d", { alpha: false });
        if (!canvasContext) {
            throw new Error("canvas context is null");
        }
        canvasContext.scale(ratio, ratio);

        const renderTask = page.render({
            canvasContext,
            viewport: newViewport,
        });
        this.renderTask = renderTask;
        await renderTask.promise;

        // The canvas is attached to div after the page is rendered, to
        // workaround Chromium rendering issue. See https://crbug.com/1324536.
        if (!this.canvas) {
            div.appendChild(canvas);
        } else {
            this.canvas.replaceWith(canvas);
        }
        this.canvas = canvas;
    }

    cancelRender() {
        this.renderTask?.cancel();
    }
}
