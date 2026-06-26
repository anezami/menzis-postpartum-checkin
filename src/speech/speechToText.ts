import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'
import { getSpeechToken } from './speechToken'

export function sttAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

export async function recognizeOnce(locale: string): Promise<string> {
  const { authToken, region } = await getSpeechToken()

  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(authToken, region)
  speechConfig.speechRecognitionLanguage = locale

  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig)

  return new Promise<string>((resolve, reject) => {
    recognizer.recognizeOnceAsync(
      (result) => {
        recognizer.close()
        if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          resolve(result.text)
        } else {
          resolve('')
        }
      },
      (err) => {
        recognizer.close()
        reject(new Error(String(err)))
      },
    )
  })
}
