import {
    GlobalWorkerOptions,
    PDFDocumentProxy,
    PasswordResponses,
    getDocument,
} from "pdfjs-dist";
import { EventBus, PDFLinkService } from "pdfjs-dist/web/pdf_viewer";
import { Channel, ScaleData, ScaleEvent } from "./core";
import { Log } from "./log";
import { PdfViewer } from "./pdf_viewer";

const DEFAULT_URL = "https://localhost/placeholder.pdf";

const TAG = "Index";

declare global {
    const channel: Channel;
    // eslint-disable-next-line no-var
    var pdfViewer: PdfViewer;
    // eslint-disable-next-line no-var
    var pdfLinkService: PDFLinkService;
    function onRenderPage(event: -1 | 0 | 1 | 2): Promise<void>;
    function isTextSelected(): void;
    function loadDocument(): void;
    function toggleTextLayerVisibility(): void;
}

GlobalWorkerOptions.workerSrc = "/viewer/js/worker.js";

let isTextLayerVisible = false;

const container = document.createElement("div");
container.className = "outerContainer";
document.body.appendChild(container);

const eventBus = new EventBus();

const linkService = new PDFLinkService({
    eventBus,
});

const pdfViewer = new PdfViewer({
    container,
    eventBus,
    linkService,
});
linkService.setViewer(pdfViewer);

globalThis.pdfViewer = pdfViewer;
globalThis.pdfLinkService = linkService;

globalThis.onRenderPage = async function (event) {
    Log.d(TAG, `scale mode is ${JSON.stringify(event)}`);
    if (event === -1) {
        await pdfViewer.setPageNumber(channel.getPage());
        await pdfViewer.setRotation(channel.getRotation());
    } else if (event === ScaleEvent.SCALE_BEGIN) {
        pdfViewer.onScaleBegin();
    } else {
        const ratio = globalThis.devicePixelRatio;
        const data: ScaleData = {
            scale: channel.getScale(),
            focusX: channel.getScaleFocusX() / ratio,
            focusY: channel.getScaleFocusY() / ratio,
        };
        if (event === ScaleEvent.SCALE) {
            pdfViewer.onScale(data);
        } else {
            await pdfViewer.onScaleEnd(data);
        }
    }
};

globalThis.isTextSelected = function () {
    return globalThis.getSelection()?.toString() !== "";
};

globalThis.loadDocument = function () {
    const pdfPassword = channel.getPassword();
    const loadingTask = getDocument({ url: DEFAULT_URL, password: pdfPassword });
    loadingTask.onPassword = (_: unknown, error: number) => {
        if (error === PasswordResponses.NEED_PASSWORD) {
            channel.showPasswordPrompt();
        } else if (error === PasswordResponses.INCORRECT_PASSWORD) {
            channel.invalidPassword();
        }
    };

    loadingTask.promise.then(async (pdfDocument: PDFDocumentProxy) => {
        channel.onLoaded();
        channel.setNumPages(pdfDocument.numPages);
        pdfDocument.getMetadata().then((data) => {
            channel.setDocumentProperties(JSON.stringify(data.info));
        }).catch((error) => {
            Log.e(TAG, "getMetadata error: " + error);
        });
        await pdfViewer.setDocument(pdfDocument);
        linkService.setDocument(pdfDocument);
        await pdfViewer.setPageNumber(channel.getPage());
    }, (reason) => {
        Log.e(TAG, reason.name + ": " + reason.message);
    });
};

globalThis.toggleTextLayerVisibility = function () {
    let textLayerForeground = "red";
    let textLayerOpacity = 1;
    if (isTextLayerVisible) {
        textLayerForeground = "transparent";
        textLayerOpacity = 0.25;
    }
    document.documentElement.style.setProperty("--text-layer-foreground", textLayerForeground);
    document.documentElement.style.setProperty("--text-layer-opacity", textLayerOpacity.toString());
    isTextLayerVisible = !isTextLayerVisible;
};
