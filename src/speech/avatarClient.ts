import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'
import { getSpeechToken } from './speechToken'
import { AVATAR_CHARACTER, AVATAR_STYLE } from './speechConfig'

export type AvatarSession = {
  speak(text: string, voice: string): Promise<void>
  stop(): Promise<void>
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function startAvatarSession(opts: {
  videoEl: HTMLVideoElement
  audioEl: HTMLAudioElement
  voice: string
}): Promise<AvatarSession> {
  const { authToken, region, iceServers } = await getSpeechToken()

  const pc = new RTCPeerConnection({ iceServers })

  pc.ontrack = (event) => {
    if (event.track.kind === 'video') {
      opts.videoEl.srcObject = event.streams[0] ?? new MediaStream([event.track])
      opts.videoEl.autoplay = true
      opts.videoEl.playsInline = true
    } else if (event.track.kind === 'audio') {
      opts.audioEl.srcObject = event.streams[0] ?? new MediaStream([event.track])
      opts.audioEl.autoplay = true
      opts.audioEl.muted = false
    }
  }

  pc.addTransceiver('video', { direction: 'sendrecv' })
  pc.addTransceiver('audio', { direction: 'sendrecv' })

  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(authToken, region)
  speechConfig.speechSynthesisVoiceName = opts.voice

  const avatarConfig = new SpeechSDK.AvatarConfig(AVATAR_CHARACTER, AVATAR_STYLE, new SpeechSDK.AvatarVideoFormat())
  const synth = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig)

  await synth.startAvatarAsync(pc)

  return {
    async speak(text: string, voice: string): Promise<void> {
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="und"><voice name="${voice}">${escapeXml(text)}</voice></speak>`
      const result = await synth.speakSsmlAsync(ssml)
      if (result.reason === SpeechSDK.ResultReason.Canceled) {
        throw new Error(`Avatar speak canceled: ${result.errorDetails ?? 'unknown error'}`)
      }
    },

    async stop(): Promise<void> {
      try {
        await synth.close()
      } finally {
        pc.close()
      }
    },
  }
}
