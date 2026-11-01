// Scroll-driven 3D house: a stylised home assembles piece by piece as the visitor scrolls through #journey.
// Colors are read from the CSS tokens in styles.css so the model always matches the brand palette.
(async () => {
  const section = document.getElementById('journey');
  if (!section) return;

  const canvas = section.querySelector('.journey-canvas');
  const chapters = [...section.querySelectorAll('.chapter')];
  const hudSteps = [...section.querySelectorAll('.hud-steps li')];
  const bar = section.querySelector('.journey-progress-bar');
  const header = document.querySelector('.site-header');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const goStatic = () => section.classList.add('is-static');

  let THREE, renderer;
  try {
    THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    goStatic();
    section.classList.add('no-webgl');
    return;
  }

  // ---------- Palette ----------
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const C = {
    navy: css('--navy'),
    gold: css('--gold'),
    blue: css('--blue'),
    sand: css('--sand'),
    sky: css('--sky'),
    walls: '#f6ead2',
    stone: '#f1e2c2',
    band: '#e2cfa6',
    path: '#d9c193',
    olive: '#6f9a3e',
    cypress: '#2f6a3c',
    trunk: '#8a6a45',
  };
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
  const M = {
    stone: mat(C.stone),
    path: mat(C.path),
    roof: mat(C.navy, { roughness: 0.6 }),
    gold: mat(C.gold, { roughness: 0.4, metalness: 0.4 }),
    glass: mat(C.navy, { roughness: 0.15, metalness: 0.2, emissive: new THREE.Color(C.gold), emissiveIntensity: 0 }),
    olive: mat(C.olive, { flatShading: true }),
    cypress: mat(C.cypress, { flatShading: true }),
    trunk: mat(C.trunk),
  };

  // Box whose origin sits on its bottom face, so scaling on Y "grows" it upwards.
  const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  const group = (...children) => {
    const g = new THREE.Group();
    children.forEach((c) => g.add(c));
    return g;
  };
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const tiny = 0.0001;

  // ---------- Scene ----------
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(C.sky, 40, 90);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight('#ffffff', C.sand, 1.7));
  const sun = new THREE.DirectionalLight('#fff0d2', 2.8);
  sun.position.set(9, 15, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Blueprint grid floor; the fog fades it out towards the horizon
  const grid = new THREE.GridHelper(120, 120, C.blue, C.blue);
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  grid.material.depthWrite = false;
  grid.position.y = 0.002;
  scene.add(grid);

  const BASE = 0.35; // plinth height; everything else stands on it

  // 1. Plinth and front path
  const plinth = group(
    box(13, BASE, 9.5, M.stone),
    box(1.6, 0.03, 2.4, M.path, -1.2, BASE, 3.55),
  );

  // 2. Walls, laid brick by brick in running bond: main block plus a lower side wing.
  // Each block is four wall segments; bricks are ordered course by course so the walls rise row after row.
  const T = 0.3;          // wall thickness
  const BRICK = 0.62;     // nominal brick length
  const COURSE = 0.25;    // nominal course height
  const GAP = 0.025;      // mortar joint
  const bricks = [];      // { x, y, z, len, h, rotY, course }
  const layBlock = (w, h, d, cx, cz) => {
    const rows = Math.round(h / COURSE);
    const ch = h / rows;
    const segments = [
      { x: cx - w / 2, z: cz + d / 2 - T / 2, len: w, rotY: 0 },              // front
      { x: cx - w / 2, z: cz - d / 2 + T / 2, len: w, rotY: 0 },              // back
      { x: cx - w / 2 + T / 2, z: cz - d / 2 + T, len: d - 2 * T, rotY: 1 },  // left
      { x: cx + w / 2 - T / 2, z: cz - d / 2 + T, len: d - 2 * T, rotY: 1 },  // right
    ];
    for (let r = 0; r < rows; r++) {
      segments.forEach((s) => {
        const n = Math.max(1, Math.round(s.len / BRICK));
        const b = s.len / n;
        const cuts = [0];
        for (let a = r % 2 ? b / 2 : b; a < s.len - 0.01; a += b) cuts.push(a);
        cuts.push(s.len);
        for (let i = 0; i < cuts.length - 1; i++) {
          const mid = (cuts[i] + cuts[i + 1]) / 2;
          bricks.push({
            x: s.rotY ? s.x : s.x + mid,
            z: s.rotY ? s.z + mid : s.z,
            y: r * ch,
            len: cuts[i + 1] - cuts[i],
            h: ch,
            rotY: s.rotY,
            course: r,
          });
        }
      });
    }
  };
  layBlock(6.2, 3.2, 4.6, -1.2, 0);
  layBlock(3.6, 2.4, 3.8, 3.4, 0.4);
  bricks.sort((a, b) => a.course - b.course);

  const brickGeo = new THREE.BoxGeometry(1, 1, T);
  brickGeo.translate(0, 0.5, 0);
  const walls = new THREE.InstancedMesh(brickGeo, mat('#ffffff'), bricks.length);
  walls.castShadow = walls.receiveShadow = true;
  walls.position.y = BASE;
  // Jerusalem-stone tones: slight per-brick variation, darker for the two base courses
  const brickColor = new THREE.Color();
  bricks.forEach((b, i) => {
    brickColor.set(b.course < 2 ? C.band : C.walls).offsetHSL(0, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.05);
    walls.setColorAt(i, brickColor);
  });
  const dummy = new THREE.Object3D();
  const placeBricks = (p) => {
    const laid = p * (bricks.length + 24);
    bricks.forEach((b, i) => {
      // each brick drops into place over the time it takes to lay the next ~24 bricks
      const t = clamp01((laid - i) / 24);
      dummy.position.set(b.x, b.y + (1 - t) * 1.5, b.z);
      dummy.rotation.set(0, b.rotY ? Math.PI / 2 : 0, 0);
      const s = t > 0 ? 1 : tiny;
      dummy.scale.set((b.len - GAP) * s, (b.h - GAP) * s, s);
      dummy.updateMatrix();
      walls.setMatrixAt(i, dummy.matrix);
    });
    walls.instanceMatrix.needsUpdate = true;
  };

  // 3. Roof: navy gable over the main block, flat roof over the wing, gold fascia trim
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-3.6, 0);
  gableShape.lineTo(3.6, 0);
  gableShape.lineTo(0, 2.1);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 5.3, bevelEnabled: false });
  gableGeo.translate(0, 0, -2.65);
  const gable = new THREE.Mesh(gableGeo, M.roof);
  gable.castShadow = gable.receiveShadow = true;
  gable.position.set(-1.2, 3.2, 0);
  const roof = group(
    gable,
    box(7.3, 0.14, 5.4, M.gold, -1.2, 3.12, 0),
    box(0.6, 1.5, 0.6, M.roof, 0.2, 3.6, -1.1),
    box(4.1, 0.28, 4.3, M.roof, 3.4, 2.4, 0.4),
    box(4.2, 0.1, 4.4, M.gold, 3.4, 2.36, 0.4),
  );
  const ROOF_Y = BASE;
  roof.position.y = ROOF_Y;

  // 4. Openings: gold door, glowing windows, gold sills
  const FRONT_MAIN = 2.3;
  const FRONT_WING = 0.4 + 1.9;
  const windowPane = (w, h, x, y, z, rotY = 0) => {
    const g = group(box(w, h, 0.1, M.glass), box(w + 0.2, 0.08, 0.22, M.gold, 0, -0.08, 0.04));
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    return g;
  };
  const door = group(box(1.1, 2.2, 0.12, M.gold), box(1.3, 0.12, 0.2, M.roof, 0, 2.2, 0));
  door.position.set(-1.2, BASE, FRONT_MAIN + 0.03);
  const openings = group(
    door,
    windowPane(1.1, 1.4, -3.15, BASE + 1.1, FRONT_MAIN + 0.03),
    windowPane(1.1, 1.4, 0.75, BASE + 1.1, FRONT_MAIN + 0.03),
    windowPane(2.0, 1.1, 3.4, BASE + 0.9, FRONT_WING + 0.03),
    windowPane(1.1, 1.4, -4.33, BASE + 1.1, -0.6, -Math.PI / 2),
    windowPane(1.1, 1.4, 5.23, BASE + 0.9, 0.4, Math.PI / 2),
  );

  // 5. Garden: cypresses, an olive tree, low hedges and path lanterns
  const cypress = (x, z, h) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, h, 7), M.cypress);
    cone.position.y = 0.3 + h / 2;
    cone.castShadow = true;
    const g = group(box(0.18, 0.4, 0.18, M.trunk), cone);
    g.position.set(x, BASE, z);
    return g;
  };
  const oliveTree = (x, z) => {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 0), M.olive);
    crown.position.y = 2;
    crown.scale.y = 0.8;
    crown.castShadow = true;
    const g = group(box(0.25, 1.4, 0.25, M.trunk), crown);
    g.position.set(x, BASE, z);
    return g;
  };
  const hedge = (x, z) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), M.olive);
    m.castShadow = true;
    const g = group(m);
    g.position.set(x, BASE + 0.3, z);
    return g;
  };
  const lantern = (x, z) => {
    const g = group(box(0.12, 0.6, 0.12, M.roof), box(0.24, 0.24, 0.24, M.gold, 0, 0.6, 0));
    g.position.set(x, BASE, z);
    return g;
  };
  const garden = group(
    cypress(-5.6, -2.8, 3.4),
    cypress(-5.7, -1.2, 2.8),
    cypress(-5.5, 0.9, 3.1),
    oliveTree(4.9, 3.3),
    hedge(-3.6, 3.2),
    hedge(-2.7, 3.4),
    hedge(0.3, 3.4),
    hedge(1.2, 3.2),
    lantern(-2.2, 4.4),
    lantern(-0.2, 4.4),
  );

  const porch = new THREE.PointLight(C.gold, 0, 9, 1.6);
  porch.position.set(-1.2, BASE + 2.6, FRONT_MAIN + 1.2);

  // Blue blueprint outline shown before anything is built; fades out as the real house goes up
  const lineMat = new THREE.LineBasicMaterial({ color: C.blue, transparent: true, opacity: 0 });
  const outline = (geo, x, y, z) => {
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat);
    l.position.set(x, y, z);
    return l;
  };
  const blueprint = group(
    outline(new THREE.BoxGeometry(13, BASE, 9.5).translate(0, BASE / 2, 0), 0, 0, 0),
    outline(new THREE.BoxGeometry(6.2, 3.2, 4.6).translate(0, 1.6, 0), -1.2, BASE, 0),
    outline(new THREE.BoxGeometry(3.6, 2.4, 3.8).translate(0, 1.2, 0), 3.4, BASE, 0.4),
    outline(gableGeo, -1.2, BASE + 3.2, 0),
    outline(new THREE.BoxGeometry(1.1, 2.2, 0.12).translate(0, 1.1, 0), -1.2, BASE, FRONT_MAIN),
  );

  const house = group(plinth, walls, roof, openings, garden, porch, blueprint);
  scene.add(house);

  const navyColor = new THREE.Color(C.navy);
  const litColor = new THREE.Color('#ffd98a');

  // ---------- Scroll state -> scene ----------
  const state = { plinth: 0, walls: 0, roof: 0, openings: 0, garden: 0, lights: 0, cam: 0 };
  const pointer = { x: 0, y: 0 };
  const lerp = (a, b, t) => a + (b - a) * t;
  const backOut = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

  // Children of a group pop in one after another as `p` goes 0 -> 1
  const stagger = (g, p) => {
    const n = g.children.length;
    g.children.forEach((child, i) => {
      const t = clamp01((p - (i / n) * 0.6) / 0.4);
      const s = Math.max(backOut(t), tiny);
      child.scale.set(s, s, s);
      child.visible = t > 0;
    });
  };

  let fit = 1;
  let placedWalls = -1;
  const apply = () => {
    plinth.visible = state.plinth > 0;
    plinth.scale.set(Math.max(state.plinth, tiny), 1, Math.max(state.plinth, tiny));

    walls.visible = state.walls > 0;
    if (state.walls !== placedWalls) {
      placeBricks(state.walls);
      placedWalls = state.walls;
    }

    roof.visible = state.roof > 0;
    roof.position.y = ROOF_Y + (1 - state.roof) * 7;
    roof.rotation.z = (1 - state.roof) * 0.2;

    stagger(openings, state.openings);
    stagger(garden, state.garden);

    lineMat.opacity = 0.9 * (1 - state.openings);
    blueprint.visible = lineMat.opacity > 0.01;

    M.glass.color.lerpColors(navyColor, litColor, state.lights);
    M.glass.emissiveIntensity = state.lights * 0.5;
    porch.intensity = state.lights * 10;

    const c = state.cam;
    const theta = lerp(0.85, -0.42, c) + pointer.x * 0.08;
    const r = lerp(36, 27, c) * fit;
    camera.position.set(Math.sin(theta) * r, lerp(17, 5.5, c) + pointer.y * 0.8, Math.cos(theta) * r);
    camera.lookAt(0, lerp(1, 1.9, c), 0);
    scene.fog.near = r + 8;
    scene.fog.far = r + 45;
  };

  let dirty = true;
  const render = () => {
    if (!dirty) return;
    dirty = false;
    apply();
    renderer.render(scene, camera);
  };

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const mobile = w < 768;
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fit = camera.aspect < 1 ? 1.85 : camera.aspect < 1.3 ? 1.3 : 1;
    // Shift the house out from under the copy: right on desktop, up on mobile (the static layout has no overlay)
    if (section.classList.contains('is-static')) camera.clearViewOffset();
    else if (mobile) camera.setViewOffset(w, h, 0, h * 0.22, w, h);
    else camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    camera.updateProjectionMatrix();
    dirty = true;
    render();
  };
  new ResizeObserver(resize).observe(canvas);

  // Without GSAP or with reduced motion, show the finished house and all chapters at once
  if (reduceMotion || !window.gsap || !window.ScrollTrigger) {
    Object.keys(state).forEach((k) => (state[k] = 1));
    goStatic();
    resize();
    return;
  }

  // Timeline in "chapter time": chapter 0 is the intro (blueprint only); each later start is where that caption takes over
  const CHAPTER_STARTS = [0, 1.5, 2.7, 4.5, 6.1, 7.9];
  const TOTAL = 12;
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' }, onUpdate: () => (dirty = true) });
  tl.to(state, { plinth: 1, duration: 1 }, 1.5)
    .to(state, { walls: 1, duration: 1.6, ease: 'none' }, 2.7)
    .to(state, { roof: 1, duration: 1.3, ease: 'bounce.out' }, 4.5)
    .to(state, { openings: 1, duration: 1.5, ease: 'none' }, 6.1)
    .to(state, { garden: 1, duration: 1.5, ease: 'none' }, 7.9)
    .to(state, { lights: 1, duration: 1.2 }, 9.4)
    .to(state, { cam: 1, duration: 11.4, ease: 'power1.inOut' }, 0)
    .set({}, {}, TOTAL);

  let active = -1;
  const setChapter = (progress) => {
    const t = progress * TOTAL + 0.3;
    let idx = 0;
    CHAPTER_STARTS.forEach((start, i) => { if (t >= start) idx = i; });
    if (idx === active) return;
    active = idx;
    chapters.forEach((el, i) => el.classList.toggle('is-active', i === idx));
    // HUD steps map to chapters 1..5; the last one completes once the lights are on
    hudSteps.forEach((el, i) => {
      el.classList.toggle('is-done', i + 1 < idx || (idx === 5 && i === 4));
      el.classList.toggle('is-current', i + 1 === idx && idx !== 5);
    });
  };

  ScrollTrigger.create({
    trigger: section,
    start: () => `top ${header.offsetHeight}px`,
    end: 'bottom bottom',
    scrub: 0.8,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      setChapter(self.progress);
      bar.style.transform = `scaleX(${self.progress})`;
      section.classList.toggle('has-scrolled', self.progress > 0.02);
    },
  });

  // Subtle camera parallax that follows the mouse (fine pointers only)
  if (matchMedia('(pointer: fine)').matches) {
    section.addEventListener('pointermove', (e) => {
      const rect = section.querySelector('.journey-sticky').getBoundingClientRect();
      gsap.to(pointer, {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((e.clientY - rect.top) / rect.height) * 2 - 1,
        duration: 1.2,
        ease: 'power3.out',
        overwrite: true,
        onUpdate: () => (dirty = true),
      });
    });
  }

  setChapter(0);
  gsap.ticker.add(render);
  resize();
})();
