import ApplicationMetadata from '../applicationmetadata/ApplicationMetadata';
/**
 * [[SignalingClientJoin]] contains settings for the Join SignalFrame.
 */
export default class SignalingClientJoin {
    maxVideos: number;
    sendBitrates: boolean;
    readonly applicationMetadata?: ApplicationMetadata;
    /** Initializes a SignalingClientJoin with the given properties.
     *
     * @param maxVideos The maximum number of video tiles to send.
     * @param sendBitrates Whether the server should send Bitrates messages.
     * @param applicationMetadata [[ApplicationMetadata]].
     */
    constructor(maxVideos: number, sendBitrates: boolean, applicationMetadata?: ApplicationMetadata);
}
