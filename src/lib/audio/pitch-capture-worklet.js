// AudioWorkletProcessor for mic input capture (docs/09-improvement-plan.md
// §16.3). Deliberately plain JS, not TS: Vite bundles a worklet module
// referenced via `new URL(..., import.meta.url)` as a raw static asset, not
// through its normal transform pipeline, so TypeScript syntax here would
// ship as invalid runtime JS. Kept minimal on purpose — no imports, no
// bundler-resolved dependencies, since the worklet global scope can't see
// the rest of the app; detection itself runs on the main thread (frames are
// just forwarded via port.postMessage), matching the plan's explicit
// allowance ("no need to run detection inside the worklet for v1").
class PitchCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const bufferSize = (options && options.processorOptions && options.processorOptions.bufferSize) || 2048;
    this.buffer = new Float32Array(bufferSize);
    this.writeIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.writeIndex++] = channel[i];
        if (this.writeIndex >= this.buffer.length) {
          this.port.postMessage(this.buffer.slice());
          this.writeIndex = 0;
        }
      }
    }
    return true; // keep the processor alive for the life of the node
  }
}

registerProcessor('pitch-capture-processor', PitchCaptureProcessor);
