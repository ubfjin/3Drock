import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function disposeModel(object) {
  const materials = new Set();
  const textures = new Set();
  object?.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    for (const material of (Array.isArray(child.material) ? child.material : [child.material])) if (material) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}

export default function Viewer({ url, sampleNo }) {
  const host = useRef(null);
  const runtime = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setError('이 브라우저에서 3D 화면을 시작할 수 없습니다.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#c6c4ba');
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 10000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.7;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x96958e, 1.8));
    const key = new THREE.DirectionalLight(0xfff6ea, 2.1);
    key.position.set(4, 6, 5);
    scene.add(key);
    scene.add(key.target);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ color: 0x252b23, opacity: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const resize = () => {
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      if (runtime.current?.model) runtime.current.frameModel(runtime.current.model);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let frame;
    const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();
    runtime.current = { scene, camera, controls, renderer, floor, key, environment, pmrem, frameModel(object) {
      const bounds = new THREE.Box3().setFromObject(object);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.length() * 0.5, 0.01);
      const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.aspect);
      const distance = radius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov)) * 0.9;
      camera.near = Math.max(radius / 1000, 0.001);
      camera.far = Math.max(radius * 1000, 100);
      camera.position.copy(center).add(new THREE.Vector3(0.8, 0.55, 1).normalize().multiplyScalar(distance));
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.minDistance = radius * 0.12;
      controls.maxDistance = radius * 30;
      controls.update();
      floor.position.y = bounds.min.y - radius * 0.035;
      key.position.copy(center).add(new THREE.Vector3(3, 5, 4).multiplyScalar(radius * 3));
      key.target.position.copy(center);
    } };
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      disposeModel(runtime.current?.model);
      controls.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      element.removeChild(renderer.domElement);
      runtime.current = null;
    };
  }, []);

  useEffect(() => {
    const rt = runtime.current;
    if (!rt || !url) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    if (rt.model) {
      rt.scene.remove(rt.model);
      disposeModel(rt.model);
      rt.model = null;
    }
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.load(url, (gltf) => {
      if (cancelled) { disposeModel(gltf.scene); return; }
      const object = gltf.scene;
      if (new THREE.Box3().setFromObject(object).isEmpty()) { setError('표시할 형상이 없는 모델입니다.'); setLoading(false); return; }
      object.traverse((child) => { if (child.isMesh) child.castShadow = true; });
      rt.scene.add(object);
      rt.model = object;
      rt.frameModel(object);
      setLoading(false);
    }, undefined, () => { if (!cancelled) { setError('모델을 불러오지 못했습니다.'); setLoading(false); } });
    return () => { cancelled = true; draco.dispose(); };
  }, [url]);

  return <div className="viewer-shell">
    <div className="viewer-canvas" ref={host} />
    <div className="viewer-top"><span className="viewer-badge">3D OBSERVATION</span><span className="viewer-counter">시료 {String(sampleNo).padStart(2, '0')}</span></div>
    {loading && !error && <div className="viewer-message"><span className="loader-ring" />모델을 불러오는 중입니다…</div>}
    {error && <div className="viewer-message error">{error}</div>}
    <div className="viewer-bottom"><span>드래그 회전 · 스크롤 확대 · 우클릭 이동</span><div className="viewer-buttons"><button type="button" onClick={() => runtime.current?.model && runtime.current.frameModel(runtime.current.model)} aria-label="시점 초기화">시점 초기화</button><button type="button" onClick={() => host.current?.parentElement?.requestFullscreen?.()} aria-label="전체 화면">전체 화면</button></div></div>
  </div>;
}
