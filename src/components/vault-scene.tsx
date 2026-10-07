"use client";

import { useEffect, useRef, useState } from "react";
import { Coins, LockKeyhole, Move, Pause, Play, RotateCcw } from "lucide-react";
import type * as Three from "three";

export type SceneVault = { id: number; name: string; loot: number };
export const VAULT_COLORS = ["#67e7dd", "#b399ff", "#ffd273"];

export function VaultPlayground() {
  const [opened, setOpened] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setOpened(true), 2500);
    return () => clearTimeout(timer);
  }, [touched]);
  function toggle() { setTouched(true); setOpened(!opened); }
  return <><VaultScene vaults={[{ id: 2, name: "Gold Vault", loot: 14000 }]} selected={2} open={opened ? [2] : []} onSelect={toggle}/><button className="playground-toggle" onClick={toggle}>{opened ? <LockKeyhole size={15}/> : <Coins size={15}/>} {opened ? "Close the vault" : "Open the vault"}<span>Just a preview · try it!</span></button></>;
}

// This scene is presentation only. Opening it never changes a room or payout.
export function VaultScene({ vaults, selected = null, open = [], alarms = [], disabled = false, onSelect,
  className = "" }: { vaults: SceneVault[]; selected?: number | null; open?: number[]; alarms?: number[];
  disabled?: boolean; onSelect?: (id: number) => void; className?: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const latest = useRef({ selected, open, alarms, disabled, onSelect });
  latest.current = { selected, open, alarms, disabled, onSelect };
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [paused, setPaused] = useState(false);
  const pause = useRef(false);
  pause.current = paused;
  const reset = useRef<() => void>(() => {});
  const identity = vaults.map((vault) => vault.id).join(",");

  useEffect(() => {
    const container = mount.current!;
    let disposed = false;
    let cleanup = () => {};
    async function start() {
      const [T, { OrbitControls }, { RoomEnvironment }] = await Promise.all([
        import("three"), import("three/addons/controls/OrbitControls.js"), import("three/addons/environments/RoomEnvironment.js"),
      ]);
      if (disposed) return;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.4;
      renderer.domElement.setAttribute("aria-hidden", "true");
      container.appendChild(renderer.domElement);
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(40, 1, .1, 60);
      const pmrem = new T.PMREMGenerator(renderer);
      const environment = new RoomEnvironment();
      const environmentMap = pmrem.fromScene(environment, .04);
      scene.environment = environmentMap.texture;
      environment.dispose(); pmrem.dispose();
      scene.add(new T.HemisphereLight(0xbdeaff, 0x162030, 2));
      const key = new T.DirectionalLight(0xe8f6ff, 4);
      key.position.set(-4, 7, 7); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -6, right: 6, top: 5, bottom: -5 });
      key.shadow.bias = -.001;
      scene.add(key);
      const rim = new T.PointLight(0x9a79ff, 30, 20); rim.position.set(0, 4, -4); scene.add(rim);
      const floor = new T.Mesh(new T.PlaneGeometry(50, 50), new T.MeshStandardMaterial({ color: 0x070d18, metalness: .25, roughness: .8 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -.14; floor.receiveShadow = true; scene.add(floor);
      const grid = new T.GridHelper(36, 36, 0x23394c, 0x1a293a); grid.position.y = -.13;
      const gridMaterial = grid.material as Three.Material; gridMaterial.transparent = true; gridMaterial.opacity = .28; scene.add(grid);
      const wall = new T.Mesh(new T.PlaneGeometry(28, 9), new T.MeshStandardMaterial({ color: 0x101b2b, metalness: .3, roughness: .8 }));
      wall.position.set(0, 3, -2.1); scene.add(wall);
      const stripMaterial = new T.MeshStandardMaterial({ color: 0x6baed8, emissive: 0x327da9, emissiveIntensity: .6 });
      for (const x of [-7, -4.5, 4.5, 7]) {
        const strip = new T.Mesh(new T.BoxGeometry(.035, 6, .025), stripMaterial); strip.position.set(x, 2, -2); scene.add(strip);
      }
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 1.15, 0);
      controls.enablePan = false; controls.enableZoom = false; controls.enableDamping = true;
      controls.minAzimuthAngle = -.55; controls.maxAzimuthAngle = .55;
      controls.minPolarAngle = Math.PI / 3; controls.maxPolarAngle = Math.PI / 2.1;
      renderer.domElement.style.touchAction = "pan-y";
      const single = vaults.length === 1;
      function resize() {
        const width = container.clientWidth; const height = container.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height); camera.aspect = width / height;
        camera.position.set(0, single ? 2.9 : 3.2, single ? Math.max(5.8, 4.7 / camera.aspect) : Math.max(5.5, 11.5 / camera.aspect));
        camera.updateProjectionMatrix(); controls.update();
      }
      reset.current = resize;
      const observer = new ResizeObserver(resize); observer.observe(container); resize();

      function material(color: string | number, metalness = .8, roughness = .3) {
        return new T.MeshStandardMaterial({ color, metalness, roughness });
      }
      function mesh(parent: Three.Object3D, geometry: Three.BufferGeometry, mat: Three.Material, x = 0, y = 0, z = 0) {
        const value = new T.Mesh(geometry, mat); value.position.set(x, y, z);
        value.castShadow = true; value.receiveShadow = true; parent.add(value); return value;
      }
      function disc(parent: Three.Object3D, radius: number, depth: number, mat: Three.Material, x: number, y: number, z: number) {
        const value = mesh(parent, new T.CylinderGeometry(radius, radius, depth, 48), mat, x, y, z);
        value.rotation.x = Math.PI / 2; return value;
      }
      const models = vaults.map((vault, index) => {
        const root = new T.Group(); root.userData.vaultId = vault.id;
        root.position.set(single ? 0 : (index - 1) * 2.8, 1.28, 0); scene.add(root);
        const metal = material(0x5a687d); const trim = material(0xb9c9d9, .95, .22);
        const dark = material(0x111b2a, .6, .5); const gold = material(0xffc64b, .9, .22);
        const color = VAULT_COLORS[vault.id % 3];
        const glow = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .5, metalness: .5, roughness: .3 });
        // A thick steel shell with an actual circular opening, rather than a box behind the door.
        const shape = new T.Shape(); shape.moveTo(-1.06, -1.1); shape.lineTo(1.06, -1.1); shape.lineTo(1.06, 1.1); shape.lineTo(-1.06, 1.1); shape.closePath();
        const hole = new T.Path(); hole.absarc(0, 0, .79, 0, Math.PI * 2, true); shape.holes.push(hole);
        mesh(root, new T.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2, steps: 1, curveSegments: 48 }), metal, 0, 0, -.52);
        mesh(root, new T.BoxGeometry(1.8, 1.8, .08), dark, 0, 0, -.5);
        mesh(root, new T.TorusGeometry(.84, .055, 12, 64), trim, 0, 0, .64);
        mesh(root, new T.TorusGeometry(.9, .016, 8, 64), glow, 0, 0, .66);
        mesh(root, new T.BoxGeometry(2.3, .18, 1.5), dark, 0, -1.2, 0);
        mesh(root, new T.BoxGeometry(1.55, .04, .045), glow, 0, -.98, .69);
        for (let side = -1; side <= 1; side += 2) {
          mesh(root, new T.BoxGeometry(.08, 1.6, .06), trim, side * .96, 0, .62);
          for (const y of [-.74, .74]) disc(root, .045, .04, dark, side * .96, y, .69);
        }
        const pivot = new T.Group(); pivot.position.set(-.82, 0, .74); root.add(pivot);
        disc(pivot, .79, .17, trim, .82, 0, 0);
        disc(pivot, .69, .06, metal, .82, 0, .12);
        mesh(pivot, new T.TorusGeometry(.61, .02, 8, 64), dark, .82, 0, .165);
        const wheel = new T.Group(); wheel.position.set(.82, 0, .24); pivot.add(wheel);
        mesh(wheel, new T.TorusGeometry(.3, .04, 12, 48), trim);
        disc(wheel, .085, .1, dark, 0, 0, .03);
        for (let spoke = 0; spoke < 5; spoke++) {
          const angle = spoke / 5 * Math.PI * 2;
          const bar = mesh(wheel, new T.BoxGeometry(.035, .28, .035), trim, Math.sin(angle) * .15, Math.cos(angle) * .15, 0);
          bar.rotation.z = -angle;
        }
        for (let bolt = 0; bolt < 12; bolt++) {
          const angle = bolt / 12 * Math.PI * 2;
          disc(pivot, .032, .04, dark, .82 + Math.sin(angle) * .73, Math.cos(angle) * .73, .12);
        }
        for (const y of [-.5, .5]) mesh(root, new T.CylinderGeometry(.085, .085, .33, 12), trim, -.83, y, .76);
        for (let pile = 0; pile < 5; pile++) {
          for (let level = 0; level < 5 + pile % 3; level++) mesh(root, new T.CylinderGeometry(.15, .15, .04, 16), gold, (pile % 3 - 1) * .29, -.65 + level * .045, -.15 + Math.floor(pile / 3) * .32);
        }
        const coins = Array.from({ length: 8 }, (_, coin) => {
          const value = disc(root, .12, .04, gold, 0, 0, 0); value.visible = false; return { value, seed: coin };
        });
        const halo = mesh(root, new T.TorusGeometry(1.2, .013, 6, 80), glow, 0, -1.28, 0);
        halo.rotation.x = Math.PI / 2;
        return { root, pivot, wheel, glow, coins, opened: false, openedAt: 0 };
      });
      const raycaster = new T.Raycaster(); const pointer = new T.Vector2();
      let down = { x: 0, y: 0 }; let hovered: number | null = null;
      function hit(event: PointerEvent) {
        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        let object: Three.Object3D | null = raycaster.intersectObjects(models.map((model) => model.root), true)[0]?.object ?? null;
        while (object && object.userData.vaultId === undefined) object = object.parent;
        return object?.userData.vaultId as number | undefined;
      }
      const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
      const pointerMove = (event: PointerEvent) => { hovered = hit(event) ?? null; renderer.domElement.style.cursor = hovered !== null && !latest.current.disabled ? "pointer" : "grab"; };
      const pointerUp = (event: PointerEvent) => {
        if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6 || latest.current.disabled) return;
        const id = hit(event); if (id !== undefined) latest.current.onSelect?.(id);
      };
      const pointerLeave = () => { hovered = null; };
      renderer.domElement.addEventListener("pointerdown", pointerDown);
      renderer.domElement.addEventListener("pointermove", pointerMove);
      renderer.domElement.addEventListener("pointerup", pointerUp);
      renderer.domElement.addEventListener("pointerleave", pointerLeave);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (reduced.matches) { pause.current = true; setPaused(true); }
      const preferenceChange = () => { if (reduced.matches) { pause.current = true; setPaused(true); } };
      reduced.addEventListener("change", preferenceChange);
      let visible = true; let frame = 0; let last = 0;
      const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }); intersection.observe(container);
      function draw(time: number) {
        frame = requestAnimationFrame(draw);
        if (!visible || document.hidden || time - last < 32) return;
        const delta = Math.min((time - last) / 1000, .06); last = time;
        // A player can explicitly resume after the reduced-motion default.
        const moving = !pause.current;
        models.forEach((model) => {
          const id = model.root.userData.vaultId;
          const opened = latest.current.open.includes(id);
          if (opened !== model.opened) { model.opened = opened; model.openedAt = time; }
          const desired = opened ? -Math.PI * .68 : 0;
          model.pivot.rotation.y = moving ? T.MathUtils.damp(model.pivot.rotation.y, desired, 6, delta) : desired;
          if (moving && (hovered === id || latest.current.selected === id || opened)) model.wheel.rotation.z += delta * (opened ? 1 : .45);
          model.glow.emissive.set(latest.current.alarms.includes(id) ? "#ff6c82" : VAULT_COLORS[id % 3]);
          model.glow.emissiveIntensity = latest.current.selected === id ? 1.6 : hovered === id ? 1 : .35;
          model.coins.forEach(({ value, seed }) => {
            const elapsed = (time - model.openedAt) / 1000 - seed * .07;
            value.visible = moving && opened && elapsed > 0 && elapsed < 2.1 && !latest.current.alarms.includes(id);
            if (!value.visible) return;
            value.position.set(Math.sin(seed * 7) * elapsed * .65, -.5 + Math.sin(Math.min(elapsed / 2, 1) * Math.PI) * 1.5, .5 + elapsed * 1.5);
            value.rotation.y = elapsed * 6 + seed; value.rotation.z = elapsed * 3;
          });
        });
        controls.update(); renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(draw);
      const contextLost = (event: Event) => { event.preventDefault(); setStatus("fallback"); };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      cleanup = () => {
        cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); controls.dispose();
        reduced.removeEventListener("change", preferenceChange);
        renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointermove", pointerMove);
        renderer.domElement.removeEventListener("pointerup", pointerUp); renderer.domElement.removeEventListener("pointerleave", pointerLeave);
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        const geometries = new Set<Three.BufferGeometry>(); const materials = new Set<Three.Material>();
        scene.traverse((object) => { if (object instanceof T.Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach((mat) => materials.add(mat)); } });
        geometries.forEach((geometry) => geometry.dispose()); materials.forEach((mat) => mat.dispose());
        grid.geometry.dispose(); (grid.material as Three.Material).dispose(); key.shadow.dispose();
        environmentMap.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); reset.current = () => {};
      };
      setStatus("ready");
    }
    void start().catch(() => { cleanup(); if (!disposed) { container.replaceChildren(); setStatus("fallback"); } });
    return () => { disposed = true; cleanup(); };
    // The model collection changes only when the collection of vault IDs changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  return <div className={`vault-scene ${vaults.length === 1 ? "single-vault" : ""} ${className}`} data-renderer={status} data-motion={paused ? "paused" : "playing"}>
    <div className="vault-canvas" ref={mount}/>
    {status !== "ready" && <div className="vault-fallback" aria-hidden="true">{vaults.map((vault) => <div key={vault.id} className={`css-safe ${open.includes(vault.id) ? "open" : ""}`} style={{ "--vault-color": VAULT_COLORS[vault.id % 3] } as React.CSSProperties}><span className="css-safe-door"><span>✣</span></span><i/><b>● ● ●</b></div>)}</div>}
    <div className="scene-tools"><span><Move size={13}/>{status === "ready" ? "Drag to look around" : "Choose with the buttons below"}</span><div><button type="button" aria-label={paused ? "Resume motion" : "Pause motion"} onClick={() => setPaused(!paused)}>{paused ? <Play size={14}/> : <Pause size={14}/>}</button><button type="button" aria-label="Reset vault view" onClick={() => reset.current()}><RotateCcw size={14}/></button></div></div>
  </div>;
}
