"use strict";
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const loader_1 = require("../../libs/voicefocus/loader");
const CanvasVideoFrameBuffer_1 = require("../videoframeprocessor/CanvasVideoFrameBuffer");
const BackgroundBlurStrength_1 = require("./BackgroundBlurStrength");
const BackgroundBlurVideoFrameProcessorDelegate_1 = require("./BackgroundBlurVideoFrameProcessorDelegate");
const BackgroundFilterFrameCounter_1 = require("./BackgroundFilterFrameCounter");
/** @internal */
class DeferredObservable {
    constructor() {
        /** Access the last-resolved value of next() */
        this.value = undefined;
        this.resolve = null;
    }
    /** Create a promise that resolves once next() is called */
    whenNext() {
        /* istanbul ignore else */
        if (!this.promise) {
            // externally-resolvable promise
            this.promise = new Promise(resolve => (this.resolve = resolve));
        }
        return this.promise;
    }
    /** Update the value and resolve */
    next(value) {
        // store the value, for sync access
        this.value = value;
        // resolve the promise so anyone awaiting whenNext resolves
        this.resolve(value);
        // delete the promise so future whenNext calls get a new promise
        delete this.promise;
    }
}
/**
 * [[BackgroundBlurProcessorProvided]] implements [[BackgroundBlurProcessor]].
 * It's a background blur processor and input is passed into a worker that will apply a segmentation
 * to separate the foreground from the background. Then the background will have a blur applied.
 *
 * The [[BackgroundBlurProcessorProvided]] uses WASM and TensorFlow Lite to apply the blurring of the
 * background image as apposed to [[BackgroundBlurProcessorBuiltIn]] that uses the browser's built-in
 * capability to apply the blur.
 */
/** @internal */
class BackgroundBlurProcessorProvided {
    /**
     * A constructor that will apply default values if spec and strength are not provided.
     * If no spec is provided the selfie segmentation model is used with default paths to CDN for the
     * worker and wasm files used to process each frame.
     * @param spec The spec defines the assets that will be used for adding background blur to a frame
     * @param options How much blur to apply to a frame
     */
    constructor(spec, options) {
        this.targetCanvas = document.createElement('canvas');
        this.canvasCtx = this.targetCanvas.getContext('2d');
        this.canvasVideoFrameBuffer = new CanvasVideoFrameBuffer_1.default(this.targetCanvas);
        this.mask$ = new DeferredObservable();
        this.sourceWidth = 0;
        this.sourceHeight = 0;
        this.blurAmount = 0;
        this.initWorkerPromise = BackgroundBlurProcessorProvided.createWorkerPromise();
        this.loadModelPromise = BackgroundBlurProcessorProvided.createWorkerPromise();
        this.modelInitialized = false;
        this.validateSpec(spec);
        this.validateOptions(options);
        this.spec = spec;
        this.logger = options.logger;
        this.setBlurStrength(options.blurStrength);
        this.delegate = new BackgroundBlurVideoFrameProcessorDelegate_1.default();
        this.frameCounter = new BackgroundFilterFrameCounter_1.default(this.delegate, options.reportingPeriodMillis, this.logger);
        this.logger.info('BackgroundBlur processor successfully created');
        this.logger.info(`BackgroundBlur spec: ${this.stringify(this.spec)}`);
        this.logger.info(`BackgroundBlur options: ${this.stringify(options)}`);
    }
    static createWorkerPromise() {
        const resolver = { resolve: null, reject: null, promise: null };
        resolver.promise = new Promise((resolve, reject) => {
            resolver.resolve = resolve;
            resolver.reject = reject;
        });
        return resolver;
    }
    validateSpec(spec) {
        if (!spec) {
            throw new Error('processor has null spec');
        }
        if (!spec.model) {
            throw new Error('processor spec has null model');
        }
        if (!spec.paths) {
            throw new Error('processor spec has null paths');
        }
    }
    validateOptions(options) {
        if (!options) {
            throw new Error('processor has null options');
        }
        if (!options.blurStrength) {
            throw new Error('processor has null options - blurStrength');
        }
        if (!options.logger) {
            throw new Error('processor has null options - logger');
        }
        if (!options.reportingPeriodMillis) {
            throw new Error('processor has null options - reportingPeriodMillis');
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stringify(value) {
        return JSON.stringify(value, null, 2);
    }
    handleInitialize(msg) {
        this.logger.info(`received initialize message: ${this.stringify(msg)}`);
        if (!msg.payload) {
            this.logger.error('failed to initialize module');
            this.initWorkerPromise.reject(new Error('failed to initialize the module'));
            return;
        }
        const model = this.spec.model;
        this.worker.postMessage({
            msg: 'loadModel',
            payload: {
                modelUrl: model.path,
                inputHeight: model.input.height,
                inputWidth: model.input.width,
                inputChannels: 4,
                modelRangeMin: model.input.range[0],
                modelRangeMax: model.input.range[1],
                blurPixels: 0,
            },
        });
        this.initWorkerPromise.resolve({});
    }
    handleLoadModel(msg) {
        this.logger.info(`received load model message: ${this.stringify(msg)}`);
        if (msg.payload !== 2) {
            this.logger.error('failed to load model! status: ' + msg.payload);
            this.loadModelPromise.reject(new Error('failed to load model! status: ' + msg.payload));
            return;
        }
        this.modelInitialized = true;
        this.loadModelPromise.resolve({});
    }
    handlePredict(msg) {
        this.mask$.next(msg.payload.output);
    }
    /**
     * This method will handle the asynchronous messaging between the main JS thread
     * and the worker thread.
     * @param evt An event that was sent from the worker to the JS thread.
     * @returns
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleWorkerEvent(evt) {
        const msg = evt.data;
        switch (msg.msg) {
            case 'initialize':
                this.handleInitialize(msg);
                break;
            case 'loadModel':
                this.handleLoadModel(msg);
                break;
            case 'predict':
                this.handlePredict(msg);
                break;
            default:
                this.logger.info(`unexpected event msg: ${this.stringify(msg)}`);
                break;
        }
    }
    /**
     * This method initializes all of the resource necessary to processs background blur. It returns
     * a promise and resolves or rejects the promise once the initialization is complete.
     * @returns
     * @throws An error will be thrown
     */
    loadAssets() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.info('start initializing the processor');
            try {
                this.worker = yield loader_1.loadWorker(this.spec.paths.worker, 'BackgroundBlurWorker', {}, null);
                this.worker.addEventListener('message', ev => this.handleWorkerEvent(ev));
                this.worker.postMessage({
                    msg: 'initialize',
                    payload: {
                        wasmPath: this.spec.paths.wasm,
                        simdPath: this.spec.paths.simd,
                    },
                });
                yield this.initWorkerPromise.promise;
                this.logger.info('successfully initialized the worker');
                yield this.loadModelPromise.promise;
                this.logger.info('successfully loaded worker segmentation model');
            }
            catch (error) {
                throw new Error(`could not initialize the background blur video frame processor due to '${error.message}'`);
            }
            this.logger.info('successfully initialized the background blur processor');
        });
    }
    /**
     * Processes the VideoFrameBuffer by applying a segmentation mask and blurring the background.
     * @param buffers object that contains the canvas element that will be used to obtain the image data to process
     * @returns the updated buffer that contains the image with the background blurred.
     */
    process(buffers) {
        return __awaiter(this, void 0, void 0, function* () {
            this.frameCounter.frameReceived(buffers[0].framerate);
            const inputCanvas = buffers[0].asCanvasElement();
            if (!inputCanvas) {
                return buffers;
            }
            if (!this.modelInitialized) {
                // return existing buffer, if any
                buffers[0] = this.canvasVideoFrameBuffer;
                return buffers;
            }
            const frameWidth = inputCanvas.width;
            const frameHeight = inputCanvas.height;
            if (frameWidth === 0 || frameHeight === 0) {
                return buffers;
            }
            // on first execution of process the source width will be zero
            if (this.sourceWidth === 0) {
                this.sourceWidth = frameWidth;
                this.sourceHeight = frameHeight;
                // update target canvas size to match the frame size
                this.targetCanvas.width = this.sourceWidth;
                this.targetCanvas.height = this.sourceHeight;
                this.logger.info(`background blur source width: ${this.sourceWidth}`);
                this.logger.info(`background blur source height: ${this.sourceHeight}`);
                this.logger.info(`background blur strength set to ${this._blurStrength}`);
                this.setBlurPixels();
            }
            try {
                this.frameCounter.filterSubmitted();
                let mask = this.mask$.value;
                const hscale = this.spec.model.input.width / inputCanvas.width;
                const vscale = this.spec.model.input.height / inputCanvas.height;
                if (this.scaledCanvas === undefined) {
                    this.scaledCanvas = document.createElement('canvas');
                    this.scaledCanvas.width = inputCanvas.width * hscale;
                    this.scaledCanvas.height = inputCanvas.height * vscale;
                }
                const scaledCtx = this.scaledCanvas.getContext('2d');
                scaledCtx.save();
                scaledCtx.scale(hscale, vscale);
                scaledCtx.drawImage(inputCanvas, 0, 0);
                scaledCtx.restore();
                const imageData = scaledCtx.getImageData(0, 0, this.scaledCanvas.width, this.scaledCanvas.height);
                // process frame...
                const maskPromise = this.mask$.whenNext();
                this.worker.postMessage({ msg: 'predict', payload: imageData }, [imageData.data.buffer]);
                mask = yield maskPromise;
                this.drawImageWithMask(inputCanvas, mask);
            }
            catch (error) {
                this.logger.error(`could not process background blur frame buffer due to ${error}`);
                return buffers;
            }
            finally {
                this.frameCounter.filterComplete();
            }
            buffers[0] = this.canvasVideoFrameBuffer;
            return buffers;
        });
    }
    drawImageWithMask(inputCanvas, mask) {
        // Mask will not be set until the worker has completed handling the predict event. Until the first frame is processed,
        // the whole frame will be blurred.
        if (!mask) {
            mask = new ImageData(this.spec.model.input.width, this.spec.model.input.height);
        }
        const scaledCtx = this.scaledCanvas.getContext('2d');
        scaledCtx.putImageData(mask, 0, 0);
        const { canvasCtx, targetCanvas } = this;
        const { width, height } = targetCanvas;
        // draw the mask
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, width, height);
        canvasCtx.drawImage(this.scaledCanvas, 0, 0, width, height);
        // Only overwrite existing pixels.
        canvasCtx.globalCompositeOperation = 'source-in';
        // draw image over mask...
        canvasCtx.drawImage(inputCanvas, 0, 0, width, height);
        // draw under person
        canvasCtx.globalCompositeOperation = 'destination-over';
        canvasCtx.filter = `blur(${this.blurAmount}px)`;
        canvasCtx.drawImage(inputCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
        canvasCtx.restore();
    }
    setBlurStrength(blurStrength) {
        this._blurStrength = blurStrength;
        this.logger.info(`blur strength set to ${this._blurStrength}`);
        this.setBlurPixels();
    }
    /**
     * Calculate the blur amount based on the blur strength passed in and height of the image being blurred.
     */
    setBlurPixels() {
        this.blurAmount = BackgroundBlurStrength_1.BlurStrengthMapper.getBlurAmount(this._blurStrength, {
            height: this.sourceHeight,
        });
        this.logger.info(`background blur amount set to ${this.blurAmount}`);
    }
    /**
     * Clean up processor resources
     */
    destroy() {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            this.canvasVideoFrameBuffer.destroy();
            (_a = this.worker) === null || _a === void 0 ? void 0 : _a.postMessage({ msg: 'destroy' });
            (_b = this.worker) === null || _b === void 0 ? void 0 : _b.postMessage({ msg: 'close' });
            (_c = this.targetCanvas) === null || _c === void 0 ? void 0 : _c.remove();
            this.targetCanvas = undefined;
            (_d = this.scaledCanvas) === null || _d === void 0 ? void 0 : _d.remove();
            this.scaledCanvas = undefined;
            this.logger.info('Background blur frame process destroyed');
        });
    }
    addObserver(observer) {
        this.delegate.addObserver(observer);
    }
    removeObserver(observer) {
        this.delegate.removeObserver(observer);
    }
    static isSupported() {
        return __awaiter(this, void 0, void 0, function* () {
            const canvas = document.createElement('canvas');
            const supportsBlurFilter = canvas.getContext('2d').filter !== undefined;
            canvas.remove();
            return supportsBlurFilter;
        });
    }
}
exports.default = BackgroundBlurProcessorProvided;
//# sourceMappingURL=BackgroundBlurProcessorProvided.js.map