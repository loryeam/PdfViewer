import {
    AnnotationLayer as PDFJSAnnotationLayer,
    PDFPageProxy,
    PageViewport,
} from "pdfjs-dist";
import { IPDFLinkService } from "pdfjs-dist/types/web/interfaces";
import { Layer } from "../core";

export class AnnotationLayer implements Layer {
    private readonly div;
    private readonly linkService;

    private annotationLayer?: PDFJSAnnotationLayer;

    constructor(options: {
        container: HTMLDivElement,
        linkService: IPDFLinkService,
    }) {
        const div = document.createElement("div");
        div.className = "annotationLayer";
        options.container.appendChild(div);
        this.div = div;
        this.linkService = options.linkService;
    }

    async render(page: PDFPageProxy, viewport: PageViewport) {
        if (this.annotationLayer) {
            // @ts-expect-error only viewport parameter is needed
            this.annotationLayer.update({
                viewport: viewport.clone({ dontFlip: true }),
            });
            return;
        }

        const annotations = await page.getAnnotations();

        if (annotations.length === 0) {
            this.hide();
            return;
        }

        this.annotationLayer = new PDFJSAnnotationLayer({
            div: this.div,
            accessibilityManager: null,
            annotationCanvasMap: null,
            l10n: null,
            page,
            viewport: viewport.clone({ dontFlip: true }),
        });

        // @ts-expect-error not all parameters are needed
        await this.annotationLayer.render({
            annotations,
            imageResourcesPath: undefined,
            renderForms: false,
            linkService: this.linkService,
            downloadManager: undefined,
            annotationStorage: undefined,
            enableScripting: false,
            hasJSActions: false,
            fieldObjects: undefined,
        });
    }

    cancelRender() {
    }

    private hide() {
        this.div.hidden = true;
    }
}
