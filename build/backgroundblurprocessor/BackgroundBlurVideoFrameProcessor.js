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
const support_1 = require("../../libs/voicefocus/support");
const DefaultBrowserBehavior_1 = require("../browserbehavior/DefaultBrowserBehavior");
const ConsoleLogger_1 = require("../logger/ConsoleLogger");
const LogLevel_1 = require("../logger/LogLevel");
const Versioning_1 = require("../versioning/Versioning");
const NoOpVideoFrameProcessor_1 = require("../videoframeprocessor/NoOpVideoFrameProcessor");
const BackgroundBlurProcessorBuiltIn_1 = require("./BackgroundBlurProcessorBuiltIn");
const BackgroundBlurProcessorProvided_1 = require("./BackgroundBlurProcessorProvided");
const BackgroundBlurStrength_1 = require("./BackgroundBlurStrength");
const ModelSpecBuilder_1 = require("./ModelSpecBuilder");
/** @internal */
const CREATE_DEFAULT_MODEL_SPEC = () => ModelSpecBuilder_1.default.builder().withSelfieSegmentationDefaults().build();
/** @internal */
const DEFAULT_CDN = 'https://static.sdkassets.chime.aws';
/** @internal */
const DEFAULT_PATHS = {
    worker: `${DEFAULT_CDN}/bgblur/workers/worker.js`,
    wasm: `${DEFAULT_CDN}/bgblur/wasm/_cwt-wasm.wasm`,
    simd: `${DEFAULT_CDN}/bgblur/wasm/_cwt-wasm-simd.wasm`,
};
/**
 * No-op implementation of the blur processor. An instance of this class will be returned when a user attempts
 * to create a blur processor when it is not supported.
 */
/** @internal */
class NoOpBackgroundBlurProcessor extends NoOpVideoFrameProcessor_1.default {
    /**
     * no-op
     */
    setBlurStrength() { }
    /**
     * no-op
     * @returns
     */
    loadAssets() {
        return __awaiter(this, void 0, void 0, function* () {
            return;
        });
    }
    /**
     * no-op
     */
    addObserver() { }
    /**
     * no-op
     */
    removeObserver() { }
}
/**
 * [[BackgroundBlurVideoFrameProcessor]]
 * Creates a background blur processor which identifies the foreground person and blurs the background.
 */
class BackgroundBlurVideoFrameProcessor {
    /**
     * A factory method that will call the private constructor to instantiate the processor and asynchronously
     * initialize the worker, wasm, and ML models. Upon completion of the initialization the promise will either
     * be resolved or rejected.
     * @param spec The spec defines the assets that will be used for adding background blur to a frame
     * @param blurStrength How much blur to apply to a frame
     * @returns
     */
    static create(spec, options) {
        return __awaiter(this, void 0, void 0, function* () {
            spec = BackgroundBlurVideoFrameProcessor.resolveSpec(spec);
            options = BackgroundBlurVideoFrameProcessor.resolveOptions(options);
            const { logger } = options;
            const supported = yield BackgroundBlurVideoFrameProcessor.isSupported(spec, options);
            // if blur is not supported do not initialize. The processor will become a no op if not supported.
            logger.info(`processor is ${supported ? '' : 'not'} supported`);
            if (!supported) {
                logger.warn('Using no-op processor because background blur is not supported');
                return new NoOpBackgroundBlurProcessor();
            }
            let processor;
            if (yield BackgroundBlurProcessorProvided_1.default.isSupported()) {
                logger.info('Using browser-provided background blur');
                processor = new BackgroundBlurProcessorProvided_1.default(spec, options);
            }
            else {
                logger.info('Using built-in background blur');
                processor = new BackgroundBlurProcessorBuiltIn_1.default(spec, options);
            }
            yield processor.loadAssets();
            return processor;
        });
    }
    /**
     * Based on the SDK version, return an asset group.
     *
     * @returns the default asset spec, based on the SDK version.
     */
    static defaultAssetSpec() {
        const version = Versioning_1.default.sdkVersionSemVer;
        return {
            assetGroup: `sdk-${version.major}.${version.minor}`,
        };
    }
    /**
     * Set the given parameters to the url. Existing parameters in the url are preserved.
     * If duplicate parameters exist, they are overwritten, so it's safe to call this method multiple
     * times on the same url.
     *
     * @param url the initial url, can include query parameters
     * @param queryParams the query parameters to set
     * @returns a new url with the given query parameters.
     */
    static createUrlWithParams(url, queryParams) {
        const u = new URL(url);
        const keys = Object.keys(queryParams);
        for (const key of keys) {
            if (queryParams[key] !== undefined) {
                u.searchParams.set(key, queryParams[key]);
            }
        }
        return u.toString();
    }
    /**
     * Based on the spec that is passed in set defaults for spec
     * @param spec the spec that was passed in
     * @returns An updated spec with defaults set
     */
    static resolveSpec(spec) {
        const { paths = DEFAULT_PATHS, model = CREATE_DEFAULT_MODEL_SPEC(), assetGroup = this.defaultAssetSpec().assetGroup, revisionID = this.defaultAssetSpec().revisionID, } = spec || {};
        const params = {
            assetGroup,
            revisionID,
            sdk: encodeURIComponent(Versioning_1.default.sdkVersion),
            ua: encodeURIComponent(Versioning_1.default.sdkUserAgentLowResolution),
        };
        paths.worker = this.createUrlWithParams(paths.worker, params);
        paths.wasm = this.createUrlWithParams(paths.wasm, params);
        paths.simd = this.createUrlWithParams(paths.simd, params);
        model.path = this.createUrlWithParams(model.path, params);
        return {
            paths,
            model,
            assetGroup,
            revisionID,
        };
    }
    /**
     * Based on the options that are passed in set defaults for options
     * @param options  the options that are passed in
     * @returns An updated set of options with defaults set
     */
    static resolveOptions(options) {
        options = options !== null && options !== void 0 ? options : {};
        if (!options.blurStrength) {
            options.blurStrength = BackgroundBlurStrength_1.default.MEDIUM;
        }
        if (!options.logger) {
            options.logger = new ConsoleLogger_1.default('BackgroundBlurProcessor', LogLevel_1.default.INFO);
        }
        if (!options.reportingPeriodMillis) {
            options.reportingPeriodMillis = 1000;
        }
        return options;
    }
    /**
     * This method will detect the environment in which it is being used and determine if background
     * blur can be used.
     * @param spec The {@link BackgroundBlurSpec} spec that will be used to initialize asssets
     * @param options options such as logger
     * @returns a boolean promise that will resolve to true if supported and false if not
     */
    static isSupported(spec, options) {
        spec = BackgroundBlurVideoFrameProcessor.resolveSpec(spec);
        options = BackgroundBlurVideoFrameProcessor.resolveOptions(options);
        const { logger } = options;
        // could not figure out how to remove globalThis to test failure case
        /* istanbul ignore next */
        if (typeof globalThis === 'undefined') {
            logger.info('Browser does not have globalThis.');
            return Promise.resolve(false);
        }
        const browser = new DefaultBrowserBehavior_1.default();
        if (!browser.supportsBackgroundFilter()) {
            logger.info('Browser is not supported.');
            return Promise.resolve(false);
        }
        if (!support_1.supportsWASM(globalThis, logger)) {
            logger.info('Browser does not support WASM.');
            return Promise.resolve(false);
        }
        return this.supportsBackgroundBlur(globalThis, spec, logger);
    }
    static supportsBackgroundBlur(
    /* istanbul ignore next */
    scope = globalThis, spec, logger) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!support_1.supportsWorker(scope, logger)) {
                logger.info('Browser does not support web workers.');
                return false;
            }
            // Use the actual worker path -- it's only 20KB, and it'll get the cache warm.
            const workerURL = spec.paths.worker;
            try {
                const worker = yield loader_1.loadWorker(workerURL, 'BackgroundBlurWorker', {}, null);
                try {
                    worker.terminate();
                }
                catch (e) {
                    logger.info(`Failed to terminate worker. ${e.message}`);
                }
                return true;
            }
            catch (e) {
                logger.info(`Failed to fetch and instantiate test worker ${e.message}`);
                return false;
            }
        });
    }
}
exports.default = BackgroundBlurVideoFrameProcessor;
//# sourceMappingURL=BackgroundBlurVideoFrameProcessor.js.map