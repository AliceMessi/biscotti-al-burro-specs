/**
 * BiscottiAudio — every sound cue in one place.
 *
 * Owns: the four generated SFX (container confirm, "Fatto" click, 60 s / 30 s
 *       reminder, end-of-phase chime) and their volumes.
 * Expects: the WAVs in Assets/GeneratedSFX (fixed internal assets → requireAsset).
 * Must not: decide when to play — BiscottiFlowController calls play*().
 */
const SFX_CONFIRM = requireAsset("../GeneratedSFX/BiscottiConfirm.wav") as AudioTrackAsset
const SFX_FATTO = requireAsset("../GeneratedSFX/BiscottiFatto.wav") as AudioTrackAsset
const SFX_REMINDER = requireAsset("../GeneratedSFX/BiscottiReminder.wav") as AudioTrackAsset
const SFX_PHASE_END = requireAsset("../GeneratedSFX/BiscottiPhaseEnd.wav") as AudioTrackAsset

@component
export class BiscottiAudio extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">BiscottiAudio – sound cues</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(0, 1, 0.05))
  @hint("Volume of the pinch / Fatto feedback sounds")
  feedbackVolume: number = 0.7

  @input
  @widget(new SliderWidget(0, 1, 0.05))
  @hint("Volume of the timer reminder and end-of-phase chimes (should be noticed in a kitchen)")
  chimeVolume: number = 1.0
  @ui.group_end

  private confirm: AudioComponent
  private fatto: AudioComponent
  private reminder: AudioComponent
  private phaseEnd: AudioComponent

  onAwake(): void {
    // Input-reactive cues → LowLatency; timer chimes tolerate latency → LowPower.
    this.confirm = this.makeSource("ConfirmSfx", SFX_CONFIRM, this.feedbackVolume, true)
    this.fatto = this.makeSource("FattoSfx", SFX_FATTO, this.feedbackVolume, true)
    this.reminder = this.makeSource("ReminderSfx", SFX_REMINDER, this.chimeVolume, false)
    this.phaseEnd = this.makeSource("PhaseEndSfx", SFX_PHASE_END, this.chimeVolume, false)
  }

  playConfirm(): void {
    this.play(this.confirm)
  }

  playFatto(): void {
    this.play(this.fatto)
  }

  playReminder(): void {
    this.play(this.reminder)
  }

  playPhaseEnd(): void {
    this.play(this.phaseEnd)
  }

  private play(src: AudioComponent): void {
    if (!src) return
    if (src.isPlaying()) src.stop(false)
    src.play(1)
  }

  private makeSource(name: string, track: AudioTrackAsset, volume: number, lowLatency: boolean): AudioComponent {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.sceneObject)
    const audio = so.createComponent("Component.AudioComponent") as AudioComponent
    audio.audioTrack = track
    audio.volume = volume
    audio.playbackMode = lowLatency ? Audio.PlaybackMode.LowLatency : Audio.PlaybackMode.LowPower
    return audio
  }
}
