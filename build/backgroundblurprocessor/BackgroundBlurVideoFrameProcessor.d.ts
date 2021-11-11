import Logger from '../logger/Logger';
import BackgroundBlurOptions from './BackgroundBlurOptions';
import BackgroundBlurProcessor from './BackgroundBlurProcessor';
import BackgroundFilterSpec from './BackgroundFilterSpec';
/**
 * [[BackgroundBlurVideoFrameProcessor]]
 * Creates a background blur processor which identifies the foreground person and blurs the background.
 */
export default class BackgroundBlurVideoFrameProcessor {
    /**
     * A factory method that will call the private constructor to instantiate the processor and asynchronously
     * initialize the worker, wasm, and ML models. Upon completion of the initialization the promise will either
     * be resolved or rejected.
     * @param spec The spec defines the assets that will be used for adding background blur to a frame
     * @param blurStrength How much blur to apply to a frame
     * @returns
     */
    static create(spec?: BackgroundFilterSpec, options?: BackgroundBlurOptions): Promise<BackgroundBlurProcessor | undefined>;
    /**
     * Based on the SDK version, return an asset group.
     *
     * @returns the default asset spec, based on the SDK version.
     */
    private static defaultAssetSpec;
    /**
     * Set the given parameters to the url. Existing parameters in the url are preserved.
     * If duplicate parameters exist, they are overwritten, so it's safe to call this method multiple
     * times on the same url.
     *
     * @param url the initial url, can include query parameters
     * @param queryParams the query parameters to set
     * @returns a new url with the given query parameters.
     */
    private static createUrlWithParams;
    /**
     * Based on the spec that is passed in set defaults for spec
     * @param spec the spec that was passed in
     * @returns An updated spec with defaults set
     */
    private static resolveSpec;
    /**
     * Based on the options that are passed in set defaults for options
     * @param options  the options that are passed in
     * @returns An updated set of options with defaults set
     */
    private static resolveOptions;
    /**
     * This method will detect the environment in which it is being used and determine if background
     * blur can be used.
     * @param spec The {@link BackgroundBlurSpec} spec that will be used to initialize asssets
     * @param options options such as logger
     * @returns a boolean promise that will resolve to true if supported and false if not
     */
    static isSupported(spec?: BackgroundFilterSpec, options?: {
        logger?: Logger;
    }): Promise<boolean>;
    private static supportsBackgroundBlur;
}
