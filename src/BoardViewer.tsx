import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Environment, Html, Lightformer, OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import { Box3, Color, Group, Mesh, MeshStandardMaterial, Vector3, NeutralToneMapping, MathUtils } from 'three';
import type { Object3D } from 'three';
import type { OrbitControls as Controls } from 'three-stdlib';
import { categories, partMap } from './board-data';
import type { CategoryId } from './board-data';

export const modelUrl = import.meta.env.BASE_URL + 'models/stm32-interactive.glb';
export type ViewPreset = 'overview' | 'top' | 'front' | 'side' | 'back';
export type CameraAction = { view: ViewPreset; sequence: number; focus?: string; zoom?: number };
type Props = {
  selected: string | null; onSelect: (id: string | null) => void;
  visible: Record<CategoryId, boolean>; isolated: boolean; explode: number;
  rotating: boolean; labels: boolean; reducedMotion: boolean;
  cameraAction: CameraAction; onReady: () => void;
};
type Entry = {
  id: string; object: Object3D; center: Vector3; size: Vector3; offset: Vector3;
  materials: { material: MeshStandardMaterial; color: Color; emission: Color; intensity: number }[];
};
const origin = new Vector3(0.26, 0.52, 0);
const presets: Record<ViewPreset, [number, number, number]> = {
  overview: [-5.5, 7.5, 8.5], top: [0.001, 12, 0.001],
  front: [0, 2.1, 12], side: [12, 2.1, 0], back: [0, 2.1, -12],
};

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="viewer-failure" role="alert"><strong>暂时无法打开三维场景</strong><p>请检查模型是否加载成功，并在支持 WebGL 的浏览器中开启硬件加速。</p><button onClick={() => window.location.reload()}>重新加载</button></div>;
    return this.props.children;
  }
}
function LoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return <div className="loading-overlay"><div className="loading-card" role="status"><span className="loading-orbit" /><strong>正在载入电路板</strong><span>准备元件与材质 · {Math.round(progress)}%</span></div></div>;
}

function makeEntries(scene: Group): Entry[] {
  return scene.children.filter(o => o.name.startsWith('part_')).map((source, i) => {
    const id = source.name.replace('part_', '');
    if (!partMap[id]) throw new Error('Unknown component: ' + id);
    const object = source.clone(true);
    const materials: Entry['materials'] = [];
    object.traverse(child => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const originals = Array.isArray(child.material) ? child.material : [child.material];
        const copies = originals.map(m => {
          const material = m.clone() as MeshStandardMaterial;
          materials.push({ material, color: material.color.clone(), emission: material.emissive.clone(), intensity: material.emissiveIntensity });
          return material;
        });
        child.material = Array.isArray(child.material) ? copies : copies[0];
      }
    });
    object.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(object);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const category = partMap[id].category;
    let offset = new Vector3(center.x * 0.36, 0.012 + (i % 4) * 0.002, center.z * 0.65);
    if (category === 'core') offset = new Vector3(0, 0.024, 0);
    if (category === 'io') offset.y = 0.015;
    if (category === 'passive') { offset.y = 0.014 + (i % 5) * 0.002; offset.x *= 1.8; offset.z *= 1.8; }
    if (id === 'pcb') offset = new Vector3();
    return { id, object, center, size, offset, materials };
  });
}

function InteractivePart({ entry, active, hovered, labels, explode, reducedMotion, onSelect, onHover }: {
  entry: Entry; active: boolean; hovered: boolean; labels: boolean; explode: number; reducedMotion: boolean;
  onSelect: Props['onSelect']; onHover: (id: string | null) => void;
}) {
  const group = useRef<Group>(null);
  const invalidate = useThree(s => s.invalidate);
  const destination = useMemo(() => entry.offset.clone().multiplyScalar(explode), [entry, explode]);
  useEffect(() => {
    for (const { material, color, emission, intensity } of entry.materials) {
      material.color.copy(color);
      material.emissive.copy(emission);
      material.emissiveIntensity = intensity;
      if (active || hovered) {
        material.color.lerp(new Color('#63afc7'), active ? 0.20 : 0.08);
        material.emissive.set('#2393ba');
        material.emissiveIntensity = active ? 0.22 : 0.07;
      }
    }
    invalidate();
  }, [active, hovered, entry, invalidate]);
  useEffect(() => { invalidate(); }, [destination, invalidate]);
  useFrame((_, delta) => {
    if (!group.current) return;
    if (reducedMotion) group.current.position.copy(destination);
    else if (group.current.position.distanceToSquared(destination) > 1e-13) {
      group.current.position.lerp(destination, 1 - Math.exp(-delta * 9));
      invalidate();
    }
  });
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta < 5) onSelect(entry.id);
  };
  const showLabel = active || hovered || (labels && ['mcu', 'usb', 'crystal-hse', 'boot0', 'reset', 'swd'].includes(entry.id));
  return <group ref={group}
    onClick={click}
    onPointerOver={e => { e.stopPropagation(); onHover(entry.id); }}
    onPointerOut={() => onHover(null)}
  >
    <primitive object={entry.object} dispose={null} />
    {showLabel && <Html position={[entry.center.x, entry.center.y + entry.size.y / 2 + 0.0015, entry.center.z]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}><span className={'part-label' + (active ? ' is-selected' : '')}><i />{partMap[entry.id].ref}<span>{partMap[entry.id].name}</span></span></Html>}
  </group>;
}

function CameraController({ action, entries, explode, rotating, reducedMotion }: {
  action: CameraAction; entries: Entry[]; explode: number; rotating: boolean; reducedMotion: boolean;
}) {
  const controls = useRef<Controls>(null);
  const camera = useThree(s => s.camera);
  const invalidate = useThree(s => s.invalidate);
  const size = useThree(s => s.size);
  const transition = useRef<{ position: Vector3; target: Vector3 } | null>(null);
  const latest = useRef({ entries, explode });
  latest.current = { entries, explode };
  useEffect(() => {
    const ref = controls.current;
    if (!ref) return;
    if (action.zoom) {
      const direction = camera.position.clone().sub(ref.target);
      const distance = MathUtils.clamp(direction.length() * action.zoom, 0.4, 28);
      transition.current = { position: ref.target.clone().add(direction.setLength(distance)), target: ref.target.clone() };
    } else if (action.focus) {
      const entry = latest.current.entries.find(e => e.id === action.focus);
      if (!entry) return;
      const target = entry.center.clone().addScaledVector(entry.offset, latest.current.explode).multiplyScalar(100).sub(origin);
      const distance = Math.max(0.8, entry.size.length() * 100 * 2.4);
      const direction = camera.position.clone().sub(ref.target).normalize();
      transition.current = { position: target.clone().addScaledVector(direction, distance), target };
    } else {
      const direction = new Vector3(...presets[action.view]);
      if (size.width < 700) direction.multiplyScalar(1.2);
      transition.current = { position: direction, target: new Vector3(0, 0.15, 0) };
    }
    invalidate();
  }, [action, camera, invalidate, size.width]);
  useFrame((_, delta) => {
    const destination = transition.current;
    if (!destination || !controls.current) return;
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-delta * 8);
    camera.position.lerp(destination.position, alpha);
    controls.current.target.lerp(destination.target, alpha);
    if (camera.position.distanceTo(destination.position) < 0.001 && controls.current.target.distanceTo(destination.target) < 0.001) {
      camera.position.copy(destination.position);
      controls.current.target.copy(destination.target);
      transition.current = null;
    }
    invalidate();
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12}
    minDistance={0.35} maxDistance={28} minPolarAngle={0.001} maxPolarAngle={Math.PI * 0.98}
    autoRotate={rotating && !reducedMotion} autoRotateSpeed={0.8}
    onStart={() => { transition.current = null; }} />;
}
function BoardContent(props: Props) {
  const { scene } = useGLTF(modelUrl);
  const entries = useMemo(() => makeEntries(scene), [scene]);
  const [hovered, setHovered] = useState<string | null>(null);
  const gl = useThree(s => s.gl);
  useEffect(() => { props.onReady(); }, [props.onReady]);
  useEffect(() => {
    gl.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    return () => { gl.domElement.style.cursor = ''; };
  }, [gl, hovered]);
  useEffect(() => () => { entries.forEach(e => e.materials.forEach(m => m.material.dispose())); }, [entries]);
  return <>
    <group scale={100} position={[-origin.x, -origin.y, 0]}>
      {entries.filter(e => props.visible[partMap[e.id].category] && (!props.isolated || props.selected === e.id)).map(entry =>
        <InteractivePart key={entry.id} entry={entry} active={props.selected === entry.id} hovered={hovered === entry.id}
          labels={props.labels} explode={props.explode} reducedMotion={props.reducedMotion}
          onSelect={props.onSelect} onHover={setHovered} />)}
    </group>
    <CameraController action={props.cameraAction} entries={entries} explode={props.explode} rotating={props.rotating} reducedMotion={props.reducedMotion} />
  </>;
}
export function BoardViewer(props: Props) {
  return <SceneBoundary><Canvas
    aria-label="STM32 最小系统板三维模型，拖动旋转，滚轮缩放，点击选择元件"
    shadows="percentage" dpr={[1, 1.5]} frameloop={props.rotating && !props.reducedMotion ? 'always' : 'demand'}
    camera={{ position: presets.overview, fov: 36, near: 0.01, far: 100 }}
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: NeutralToneMapping }}
    onPointerMissed={e => { if (e.type === 'click') props.onSelect(null); }}
    fallback={<div className="viewer-failure">浏览器不支持 WebGL，请开启硬件加速后重试。</div>}
  >
    <ambientLight intensity={0.85} />
    <directionalLight position={[-3, 8, 5]} intensity={2.6} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-bias={-0.0002} />
    <directionalLight position={[6, 3, -4]} intensity={1.1} color="#d8e8f8" />
    <Environment resolution={128}>
      <Lightformer position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} intensity={1.5} />
      <Lightformer position={[-6, 3, 4]} scale={[6, 4, 1]} intensity={1.5} />
      <Lightformer position={[6, 2, -4]} rotation={[0, Math.PI, 0]} scale={[6, 4, 1]} intensity={1.2} />
    </Environment>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.54, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} /><shadowMaterial transparent opacity={0.12} />
    </mesh>
    <Suspense fallback={null}><BoardContent {...props} /></Suspense>
  </Canvas><LoadingOverlay /></SceneBoundary>;
}
