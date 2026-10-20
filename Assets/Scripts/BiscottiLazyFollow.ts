/**
 * BiscottiLazyFollow — keeps an object low in the user's view, about 1 m away,
 * following gently instead of being locked to the face.
 *
 * Owns: the follow behaviour only (dead zone + eased catch-up + turn to face the eyes).
 * Expects (@input): the world camera. Lives on the Recap SceneObject.
 * Must not: decide visibility — when the object is re-enabled it snaps into place.
 */
@component
export class BiscottiLazyFollow extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">BiscottiLazyFollow – gentle low-in-view follow</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The world camera (Camera Object)")
  camera: Camera
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(50, 200, 5))
  @hint("Distance from the eyes in cm (brief: about 1 m)")
  distanceCm: number = 100

  @input
  @widget(new SliderWidget(0, 25, 0.5))
  @hint("How far below the centre of view, in degrees (brief: low rather than high)")
  lowAngleDeg: number = 14

  @input
  @widget(new SliderWidget(0.5, 10, 0.1))
  @hint("Catch-up speed once it starts following (higher = snappier)")
  followSpeed: number = 2.5

  @input
  @widget(new SliderWidget(0, 30, 0.5))
  @hint("Dead zone in cm: small head moves don't drag the strip along")
  deadZoneCm: number = 8
  @ui.group_end

  private following = false

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.createEvent("OnEnableEvent").bind(() => this.snap())
    this.createEvent("OnStartEvent").bind(() => this.snap())
  }

  /** Jump straight to the follow point (used when the object is shown). */
  snap(): void {
    if (!this.camera) return
    const t = this.sceneObject.getTransform()
    t.setWorldPosition(this.targetPosition())
    t.setWorldRotation(this.faceRotation(t.getWorldPosition()))
    this.following = false
  }

  private targetPosition(): vec3 {
    const camT = this.camera.getTransform()
    const look = camT.back // the camera looks down its local -Z
    const a = (this.lowAngleDeg * Math.PI) / 180
    const dir = look.uniformScale(Math.cos(a)).add(camT.down.uniformScale(Math.sin(a))).normalize()
    return camT.getWorldPosition().add(dir.uniformScale(this.distanceCm))
  }

  private faceRotation(pos: vec3): quat {
    const camT = this.camera.getTransform()
    const toEye = camT.getWorldPosition().sub(pos).normalize()
    return quat.lookAt(toEye, camT.up)
  }

  private onUpdate(): void {
    if (!this.camera) return
    const t = this.sceneObject.getTransform()
    const pos = t.getWorldPosition()
    const target = this.targetPosition()
    const dist = pos.distance(target)
    if (dist > this.deadZoneCm) this.following = true
    if (this.following) {
      const k = 1 - Math.exp(-this.followSpeed * getDeltaTime())
      const next = vec3.lerp(pos, target, k)
      t.setWorldPosition(next)
      if (next.distance(target) < 0.5) this.following = false
    }
    const k2 = 1 - Math.exp(-6 * getDeltaTime())
    t.setWorldRotation(quat.slerp(t.getWorldRotation(), this.faceRotation(t.getWorldPosition()), k2))
  }
}
