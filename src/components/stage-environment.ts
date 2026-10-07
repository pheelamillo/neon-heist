import type * as Three from "three";
import type { HeistStage } from "@/lib/game/stages";

// Original procedural scenery. No external models, textures, or runtime services.
export function buildStageEnvironment(T: typeof Three, scene: Three.Scene, stage: HeistStage) {
  const decor = new T.Group(); scene.add(decor);
  const standard = (color: number, metalness = .3, roughness = .65) => new T.MeshStandardMaterial({ color, metalness, roughness });
  const lit = (color: number, strength = .7) => new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: .4 });
  const steel = standard(0x243347, .7);
  const light = lit(new T.Color(stage.accent).getHex(), 1.2);
  function box(parent: Three.Object3D, width: number, height: number, depth: number, material: Three.Material, x: number, y: number, z: number) {
    const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z); mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function sign(text: string, x: number, y: number, z: number, width = 4) {
    const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 144;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0b1423"; ctx.fillRect(0, 0, 768, 144);
    ctx.strokeStyle = stage.accent; ctx.lineWidth = 5; ctx.strokeRect(4, 4, 760, 136);
    ctx.font = "bold 66px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = stage.accent; ctx.fillText(text, 384, 76);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const material = new T.MeshBasicMaterial({ map: texture, toneMapped: false });
    const mesh = new T.Mesh(new T.PlaneGeometry(width, width * 144 / 768), material);
    mesh.position.set(x, y, z); decor.add(mesh);
  }
  const floor = new T.Mesh(new T.PlaneGeometry(60, 60), standard(stage.id === "gold" ? 0x20190f : stage.id === "sky" ? 0x233345 : 0x0b1420, .5, .45));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.14; floor.receiveShadow = true; decor.add(floor);
  const skyline = new T.Group(); decor.add(skyline);
  function city(parent: Three.Group, z: number, bright: boolean) {
    const tower = standard(bright ? 0x3c4d70 : 0x172739, .5, .5);
    const windows = lit(bright ? 0x96bbff : 0x54c2dd, bright ? .9 : .6);
    for (let i = 0; i < 22; i++) {
      const x = (i - 10.5) * 1.7;
      const height = 2.5 + ((i * 7) % 11) * .6;
      const building = new T.Group(); building.position.x = x; parent.add(building);
      box(building, 1.35, height, 1.4, tower, 0, height / 2 - 1, z - (i % 3) * 1.5);
      const rows = Math.floor(height / .55);
      const lights = new T.InstancedMesh(new T.BoxGeometry(.72, .1, .025), windows, rows);
      for (let level = 0; level < rows; level++) lights.setMatrixAt(level, new T.Matrix4().makeTranslation(0, -.6 + level * .55, z + .72 - (i % 3) * 1.5));
      building.add(lights);
      if (i % 4 === 0) box(building, .045, .6, .045, light, 0, height - .7, z);
    }
  }
  let animate = (_delta: number) => {};

  if (stage.id === "bank") {
    scene.background = new T.Color(0x081925); scene.fog = new T.Fog(0x081925, 22, 48);
    box(decor, 24, 4.6, .3, standard(0x142939), 0, 2, -3.6);
    for (const x of [-7, -4.7, 4.7, 7]) {
      box(decor, 1.7, 2.8, .06, standard(0x09202a), x, 2, -3.4);
      for (const edge of [-.87, .87]) box(decor, .05, 3, .08, light, x + edge, 2, -3.32);
      box(decor, 1.75, .05, .08, light, x, 3.45, -3.32);
      box(decor, 1.6, .035, .06, light, x, 1.6, -3.31);
    }
    sign("NEON BANK", 0, 3.65, -3.3, 4.8);
    for (const x of [-5.7, 5.7]) {
      box(decor, 1.5, .2, .65, steel, x, .45, -.6);
      for (const dx of [-.5, .5]) box(decor, .1, .6, .4, steel, x + dx, .16, -.6);
    }
    for (const z of [1.9, 3.4, 4.9]) box(decor, 7.6, .018, .025, light, 0, -.12, z);
  } else if (stage.id === "train") {
    scene.background = new T.Color(0x142638); scene.fog = new T.Fog(0x142638, 27, 50);
    city(skyline, -12, false);
    const carriage = standard(0x283646, .75, .4);
    box(decor, 20, .7, .3, carriage, 0, .2, -3.5);
    box(decor, 20, .6, .3, carriage, 0, 4, -3.5);
    for (const x of [-9, -6, -3, 0, 3, 6, 9]) box(decor, .13, 3.7, .3, steel, x, 2, -3.5);
    box(decor, 21, .18, 4, carriage, 0, 4.6, -1.8);
    for (const x of [-8, -4, 0, 4, 8]) {
      box(decor, .12, .15, 4.5, light, x, 4.43, -1.6);
      box(decor, .14, 4.6, .2, steel, x, 2.1, -3.3);
    }
    for (let i = 0; i < 24; i++) {
      const stripe = box(decor, .26, .025, .65, i % 2 ? lit(0xe4ab48, .2) : steel, (i - 11.5) * .4, -.11, 1.65);
      stripe.rotation.y = -.45;
    }
    sign("CARGO 02", 0, 4.02, -3.26, 3.3);
    const sleepers = new T.Group(); decor.add(sleepers);
    for (let i = 0; i < 18; i++) box(sleepers, .14, .09, 1.3, steel, (i - 9) * 1.4, -.05, -5.2);
    animate = (delta) => {
      skyline.children.forEach((building) => { building.position.x += delta * 4; if (building.position.x > 18.7) building.position.x -= 37.4; });
      sleepers.children.forEach((sleeper) => { sleeper.position.x += delta * 8; if (sleeper.position.x > 12.6) sleeper.position.x -= 25.2; });
    };
  } else if (stage.id === "sky") {
    scene.background = new T.Color(0x363459); scene.fog = new T.Fog(0x363459, 24, 50);
    city(skyline, -13, true);
    const frame = standard(0x8c9db5, .8, .25);
    for (const x of [-9, -6, -3, 0, 3, 6, 9]) box(decor, .06, 7, .1, frame, x, 2.8, -3.5);
    for (const y of [.35, 3.3, 5.6]) box(decor, 22, .06, .1, frame, 0, y, -3.5);
    const glass = new T.MeshPhysicalMaterial({ color: 0x86b9df, transparent: true, opacity: .09, metalness: .1, roughness: .05 });
    box(decor, 22, 6, .035, glass, 0, 2.7, -3.55);
    for (let x = -8; x <= 8; x += 2) box(decor, .025, .018, 12, light, x, -.115, 1);
    for (const z of [-2, 0, 2, 4, 6]) box(decor, 20, .018, .025, light, 0, -.115, z);
    sign("SKY BANK", 0, 4.25, -3.35, 3.9);
    const clouds = new T.Group(); decor.add(clouds);
    const cloud = new T.MeshBasicMaterial({ color: 0xbbaedc, transparent: true, opacity: .15, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const puff = new T.Mesh(new T.SphereGeometry(1, 12, 8), cloud);
      puff.scale.set(3.5, .45, 1); puff.position.set((i - 3) * 6, 5.7 + i % 2, -19); clouds.add(puff);
    }
    animate = (delta) => { clouds.position.x += delta * .12; if (clouds.position.x > 6) clouds.position.x -= 6; };
  } else {
    scene.background = new T.Color(0x17120d); scene.fog = new T.Fog(0x17120d, 22, 45);
    const gold = standard(0xcfa654, .85, .28); const bronze = standard(0x4d3923, .75, .4);
    box(decor, 26, 9, .5, standard(0x1a1717), 0, 3, -4.5);
    const gateway = new T.Mesh(new T.TorusGeometry(3.1, .22, 12, 80), gold);
    gateway.position.set(0, 2.1, -4); decor.add(gateway);
    const ring = new T.Mesh(new T.TorusGeometry(2.7, .035, 8, 80), light);
    ring.position.set(0, 2.1, -3.95); decor.add(ring);
    const backDoor = new T.Mesh(new T.CylinderGeometry(2.75, 2.75, .3, 64), bronze);
    backDoor.rotation.x = Math.PI / 2; backDoor.position.set(0, 2.1, -4.2); decor.add(backDoor);
    for (const x of [-8, -5.5, 5.5, 8]) {
      box(decor, .55, 6, .7, bronze, x, 2.7, -3.6);
      box(decor, .1, 5.7, .05, light, x, 2.7, -3.2);
      box(decor, 1, .25, 1, gold, x, .05, -3.6);
      box(decor, 1, .25, 1, gold, x, 5.6, -3.6);
    }
    sign("THE CROWN", 0, 4.95, -3.6, 4.5);
    for (const x of [-4.4, 4.4]) box(decor, .04, .025, 14, light, x, -.11, 2);
    for (const z of [1.8, 3.8, 5.8]) box(decor, 8.8, .025, .04, gold, 0, -.11, z);
    for (const x of [-6.5, 6.5]) {
      for (let i = 0; i < 7; i++) box(decor, .5, .22, .28, gold, x + (i % 3 - 1) * .55, .02 + Math.floor(i / 3) * .23, -.3);
    }
  }
  return { animate };
}
