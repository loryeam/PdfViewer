import {
    PDFPageProxy,
    PageViewport,
    TextLayerRenderTask,
    renderTextLayer,
    updateTextLayer,
} from "pdfjs-dist";
import { Layer } from "../core";

export class TextLayer implements Layer {
    private readonly div;
    private readonly textDivs = [];
    private readonly textDivProperties = new WeakMap();

    private renderTask?: TextLayerRenderTask;
    private renderingDone = false;
    private rotation = 0;
    private scale = 1;

    constructor(options: { container: HTMLDivElement }) {
        const div = document.createElement("div");
        div.className = "textLayer";
        options.container.appendChild(div);
        this.div = div;
        this.hide();
    }

    async render(page: PDFPageProxy, viewport: PageViewport) {
        if (this.renderingDone) {
            this.update(viewport);
            return;
        }

        const renderTask = renderTextLayer({
            textContentSource: page.streamTextContent(),
            container: this.div,
            viewport,
            textDivs: this.textDivs,
            textDivProperties: this.textDivProperties,
        });
        this.renderTask = renderTask;
        await renderTask.promise;
        this.finishRendering();
        this.rotation = viewport.rotation;
        this.scale = viewport.scale;
        this.show();
    }

    cancelRender() {
        this.renderTask?.cancel();
    }

    prepareForScale() {
        this.hide();
    }

    private update(viewport: PageViewport) {
        const { rotation, scale } = viewport;
        const mustRotate = rotation !== this.rotation;
        const mustRescale = scale !== this.scale;
        if (mustRotate || mustRescale) {
            this.hide();
            updateTextLayer({
                container: this.div,
                viewport,
                textDivs: this.textDivs,
                textDivProperties: this.textDivProperties,
                mustRotate,
                mustRescale,
            });
            this.rotation = rotation;
            this.scale = scale;
        }
        this.show();
    }

    private finishRendering() {
        this.renderingDone = true;

        const endOfContent = document.createElement("div");
        endOfContent.className = "endOfContent";
        this.div.append(endOfContent);
    }

    private hide() {
        if (!this.div.hidden) {
            this.div.hidden = true;
        }
    }

    private show() {
        if (this.div.hidden && this.renderingDone) {
            this.div.hidden = false;
        }
    }
}
