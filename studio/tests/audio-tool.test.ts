/**
 * audio-tool.test.ts — setters de audio del documento (F4.6.a) y su contrato:
 * el Studio escribe audio[]/music, el motor los lee; ids únicos, invariantes y
 * round-trip por el Serializer. (El popover en sí necesita DOM: el motor de
 * audio y el playtest lo cubren test/engine/audio.test.js y los de arriba.)
 */
import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';
import { toProjectJson, fromProjectJson, validateProjectJson } from '../src/io/Serializer';

describe('EditorState · defs de audio (herramienta 9, MVP ambiente)', () => {
  it('addAudioDef genera ids únicos audio_<n> y avisa a los oyentes', () => {
    const s = new EditorState();
    let changes = 0;
    s.onChange(() => changes++);

    const a = s.addAudioDef({ src: '/audio/wind.wav', bus: 'ambience', loop: true, volume: 0.6 });
    const b = s.addAudioDef({ src: '/audio/water.wav', bus: 'ambience', loop: true });
    expect(a.id).toBe('audio_1');
    expect(b.id).toBe('audio_2');
    expect(changes).toBe(2);

    // Tras borrar, el id nuevo no colisiona con los existentes (audio_2 sigue vivo
    // → el generador salta al siguiente libre).
    s.removeAudioDef('audio_1');
    const c = s.addAudioDef({ src: 'x.wav', bus: 'ambience', loop: true });
    expect(c.id).toBe('audio_3');
    expect(s.audio.map((d) => d.id)).toEqual(['audio_2', 'audio_3']);
    expect(new Set(s.audio.map((d) => d.id)).size).toBe(s.audio.length);
  });

  it('updateAudioDef fusiona cambios sobre el def y rechaza ids inexistentes', () => {
    const s = new EditorState();
    const a = s.addAudioDef({ src: '/audio/wind.wav', bus: 'ambience', loop: true, volume: 0.6 });
    expect(s.updateAudioDef(a.id, { volume: 0.2 })).toBe(true);
    expect(s.audio[0]!.volume).toBe(0.2);
    expect(s.audio[0]!.src).toBe('/audio/wind.wav'); // el resto intacto
    expect(s.updateAudioDef('no-existe', { volume: 1 })).toBe(false);
  });

  it('removeAudioDef del track activo limpia doc.music (invariante del contrato)', () => {
    const s = new EditorState();
    const mus = s.addAudioDef({ src: '/audio/music-base.wav', bus: 'music', loop: true });
    s.setMusic({ id: mus.id });
    expect(s.music?.id).toBe(mus.id);

    s.removeAudioDef(mus.id);
    expect(s.audio.find((d) => d.id === mus.id)).toBeUndefined();
    expect(s.music).toBeNull();
  });

  it('el contrato round-tria por project.json y pasa la validación del motor', () => {
    const s = new EditorState();
    s.addAudioDef({ src: '/audio/wind.wav', bus: 'ambience', loop: true, volume: 0.7 });
    s.addAudioDef({ src: '/audio/water.wav', bus: 'ambience', loop: true, volume: 0.5 });
    const json = toProjectJson(s);
    expect(validateProjectJson(json)).toEqual([]);

    const restored = fromProjectJson(json);
    expect(restored.audio).toHaveLength(2);
    expect(restored.audio[0]).toMatchObject({ src: '/audio/wind.wav', bus: 'ambience', loop: true });
    expect(restored.music).toBeNull();
  });

  it('los defs escritos por la herramienta son exactamente lo que el motor consume', () => {
    const s = new EditorState();
    s.addAudioDef({ src: '/audio/wind.wav', bus: 'ambience', loop: true, volume: 0.7 });
    const def = (toProjectJson(s) as unknown as {
      audio: { id: string; src: string; bus: string; loop: boolean; volume: number }[];
    }).audio[0]!;
    // El motor arranca en bucle todo def { loop:true, bus:'ambience' } — nada
    // hace falta en el motor que no esté ya en los datos que escribe el Studio.
    expect(def.bus).toBe('ambience');
    expect(def.loop).toBe(true);
    expect(typeof def.volume).toBe('number');
  });
});
