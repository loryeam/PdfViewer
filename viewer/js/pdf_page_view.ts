import { PDFPageProxy, PixelsPerInch } from "pdfjs-dist";
import { IPDFLinkService } from "pdfjs-dist/types/web/interfaces";
import { Layer } from "./core";
import { AnnotationLayer } from "./layers/annotation_layer";
import { CanvasLayer } from "./layers/canvas_layer";
import { TextLayer } from "./layers/text_layer";
import { setElemSizeFromPage } from "./utils";

export interface PdfPageViewOptions {
    container: HTMLDivElement;
    page: PDFPageProxy;
    linkService: IPDFLinkService;
}

interface PdfPageViewRenderOptions {
    rotation: number;
    scale: number;
    useCached?: boolean;
    attachToContainer?: boolean;
}

interface PdfPageViewState {
    div?: HTMLDivElement;
    layers: Layer[];
    attached: boolean;
}

const DEFAULT_STATE = () => {
    return {
        layers: [],
        attached: false,
    } as PdfPageViewState;
};

export class PdfPageView {
    private readonly container;
    private readonly page;
    private readonly linkService;

    private state = DEFAULT_STATE();

    constructor(options: PdfPageViewOptions) {
        this.container = options.container;
        this.page = options.page;
        this.linkService = options.linkService;
    }

    async render({
        rotation,
        scale,
        useCached = true,
        attachToContainer = true,
    }: PdfPageViewRenderOptions) {
        let div = this.state.div;

        if (div !== undefined) {
            if (!useCached) {
                await this.renderLayers(rotation, scale);
            }
        } else {
            div = document.createElement("div");
            div.className = "page";
            this.state.div = div;

            const layers = this.state.layers;
            layers.push(new CanvasLayer({ container: div }));
            layers.push(new TextLayer({ container: div }));
            layers.push(new AnnotationLayer({
                container: div,
                linkService: this.linkService,
            }));

            await this.renderLayers(rotation, scale);
        }

        if (attachToContainer && !this.state.attached) {
            this.container.appendChild(div);
            this.state.attached = true;
        }
    }

    reset() {
        this.cancelLayerRender();
        if (this.state.div && this.state.attached) {
            this.container.removeChild(this.state.div);
        }
        this.state = DEFAULT_STATE();
    }

    detachFromContainer() {
        if (this.state.div && this.state.attached) {
            this.container.removeChild(this.state.div);
            this.state.attached = false;
        }
    }

    prepareForScale() {
        for (const layer of this.state.layers) {
            layer.prepareForScale?.();
        }
    }

    private async renderLayers(rotation: number, scale: number) {
        const viewport = this.page.getViewport({
            scale: scale * PixelsPerInch.PDF_TO_CSS_UNITS,
            rotation,
        });
        for (const layer of this.state.layers) {
            await layer.render(this.page, viewport);
        }
        if (this.state.div) {
            setElemSizeFromPage(this.state.div, this.page, rotation);
        }
    }

    private cancelLayerRender() {
        for (const layer of this.state.layers) {
            layer.cancelRender();
        }
    }
}
