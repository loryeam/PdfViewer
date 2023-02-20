"use strict";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";

const container = document.getElementById("viewerContainer");
let pdfDocument = null;
let pdfViewer = null;
let eventBus = null;
let pdfLinkService = null;
let pdfFindController = null;
let isRotating = false;

function initializeViewerComponents() {
    eventBus = new pdfjsViewer.EventBus();

    pdfLinkService = new pdfjsViewer.PDFLinkService({
        eventBus,
    });

    pdfFindController = new pdfjsViewer.PDFFindController({
        linkService: pdfLinkService,
        eventBus,
    });

    pdfViewer = new pdfjsViewer.PDFViewer({
        container,
        eventBus,
        linkService: pdfLinkService,
        findController: pdfFindController,
    });
    pdfLinkService.setViewer(pdfViewer);
}

function bindEvents() {
    // Events that originated from viewer code.
    eventBus.on("pagechanging", pageChanging);
    eventBus.on("pagesinit", pagesInit);
    eventBus.on("rotationchanging", rotationChanging);

    // Events that originated from Android code are prefixed with 'app'.
    eventBus.on("app_page_number_changed", pageNumberChanged);
    eventBus.on("app_document_rotation_changed", documentRotationChanged);
    eventBus.on("app_zoom_in", zoomIn);
    eventBus.on("app_zoom_out", zoomOut);
}

function pageChanging({ pageNumber }) {
    if (!isRotating) {
        channel.setPageNumber(pageNumber);
    }
}

function pageNumberChanged() {
    pdfViewer.currentPageNumber = channel.getPageNumber();
}

function pagesInit() {
    pageNumberChanged();
    pdfViewer.currentScaleValue = "page-width"
}

function documentRotationChanged() {
    isRotating = true;
    pdfViewer.pagesRotation = channel.getDocumentRotationDegrees();
}

function rotationChanging() {
    pageNumberChanged();
    isRotating = false;
}

function zoomIn() {
    // TODO
}

function zoomOut() {
    // TODO
}

function isTextSelected() {
    return window.getSelection().toString() !== "";
}

function loadDocument() {
    initializeViewerComponents();
    bindEvents();
    channel.onViewerInitialized();

    const pdfPassword = channel.getPassword();
    const loadingTask = pdfjsLib.getDocument({
        url: "https://localhost/placeholder.pdf",
        password: pdfPassword,
    });
    loadingTask.onPassword = (_, error) => {
        if (error === pdfjsLib.PasswordResponses.NEED_PASSWORD) {
            channel.showPasswordPrompt();
        } else if (error === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD) {
            channel.invalidPassword();
        }
    }

    loadingTask.promise.then(function (newDocument) {
        channel.onLoaded();
        pdfDocument = newDocument;
        channel.setNumPages(pdfDocument.numPages);
        pdfDocument.getMetadata().then(function (data) {
            channel.setDocumentProperties(JSON.stringify(data.info));
        }).catch(function (error) {
            console.log("getMetadata error: " + error);
        });
        pdfViewer.setDocument(pdfDocument);
        pdfLinkService.setDocument(pdfDocument, null);
    }, function (reason) {
        console.error(reason.name + ": " + reason.message);
    });
}
