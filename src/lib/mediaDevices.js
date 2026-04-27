/**
 * WebRTC / MediaRecorder need `navigator.mediaDevices.getUserMedia`, which is
 * missing on insecure origins (non-HTTPS except localhost), some in-app browsers,
 * or older environments.
 */
export function canUseGetUserMedia() {
  return (
    typeof navigator !== "undefined" &&
    navigator.mediaDevices != null &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  )
}

export function getUserMediaUnsupportedMessage() {
  return "Camera and microphone need a supported browser and a secure connection (https:// or http://localhost). Open the app there and allow permissions."
}

/**
 * @param {MediaStreamConstraints} constraints
 * @returns {Promise<MediaStream>}
 */
export async function getUserMedia(constraints) {
  if (!canUseGetUserMedia()) {
    throw new TypeError(getUserMediaUnsupportedMessage())
  }
  return navigator.mediaDevices.getUserMedia(constraints)
}
