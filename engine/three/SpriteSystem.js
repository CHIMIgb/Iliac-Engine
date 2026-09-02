import * as THREE from 'three';

export function buildSprites(scene, world, textures) {
  for (const sprite of world.sprites || []) {
    const tex = textures[sprite.tex];
    if (!tex) continue;

    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({ map: tex });
    const s = new THREE.Sprite(material);
    // Motor: X,Y son coordenadas del mundo plano; Z es altura.
    // Three.js: X,Y,Z con Y como altura.
    s.position.set(sprite.pos.x, sprite.pos.z, sprite.pos.y);
    const scale = sprite.scale ?? 1;
    s.scale.set(scale, scale, 1);
    scene.add(s);
  }
}
